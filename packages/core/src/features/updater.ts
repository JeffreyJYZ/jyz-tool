import type { FeatureContext } from "./context.ts";
import { FeatureError } from "./errors.ts";

const MARKER = "// jyz:updater";

export async function applyUpdater(
	dir: string,
	ctx: FeatureContext,
): Promise<"applied" | "already applied"> {
	const cargoPath = "src-tauri/Cargo.toml";
	const libPath = "src-tauri/src/lib.rs";
	const updaterPath = "src-tauri/src/updater.rs";
	const confPath = "src-tauri/tauri.conf.json";
	const readmePath = "README.md";

	if (await ctx.exists(updaterPath)) {
		const existing = await ctx.read(updaterPath);
		if (existing.includes(MARKER)) return "already applied";
	}

	if (await ctx.exists(cargoPath)) {
		let cargo = await ctx.read(cargoPath);
		if (!cargo.includes("tauri-plugin-updater")) {
			cargo = cargo.replace(
				/\[dependencies\]\n/,
				'[dependencies]\ntauri-plugin-updater = "2"\n',
			);
			await ctx.write(cargoPath, cargo);
		}
	}

	const updaterSource = `${MARKER}
use tauri::Manager;
use tauri_plugin_updater::UpdaterExt;

#[derive(serde::Serialize)]
pub struct UpdateOffer {
	pub current: String,
	pub version: String,
	pub notes: Option<String>,
}

#[tauri::command]
pub async fn check_for_update(app: tauri::AppHandle) -> Result<Option<UpdateOffer>, String> {
	let update = app.updater()?.check().await.map_err(|e| e.to_string())?;
	Ok(update.map(|u| UpdateOffer {
		current: u.current_version,
		version: u.version,
		notes: u.body,
	}))
}

#[tauri::command]
pub async fn install_update(app: tauri::AppHandle) -> Result<(), String> {
	let update = app.updater()?.check().await.map_err(|e| e.to_string())?;
	if let Some(update) = update {
		update.download_and_install(|_, _| {}, || {}).await.map_err(|e| e.to_string())?;
	}
	app.restart();
	Ok(())
}
`;
	await ctx.write(updaterPath, updaterSource);

	if (await ctx.exists(libPath)) {
		let lib = await ctx.read(libPath);
		if (!lib.includes("mod updater;")) {
			lib = `mod updater;\n${lib}`;
		}
		if (!lib.includes("updater::check_for_update")) {
			lib = lib.replace(
				"tauri::generate_handler![]",
				"tauri::generate_handler![updater::check_for_update, updater::install_update]",
			);
		}
		if (!lib.includes("tauri_plugin_updater")) {
			lib = lib.replace(
				"tauri::Builder::default()",
				"tauri::Builder::default()\n\t\t.plugin(tauri_plugin_updater::Builder::new().build())",
			);
		}
		await ctx.write(libPath, lib);
	}

	if (await ctx.exists(confPath)) {
		const raw = await ctx.read(confPath);
		let projectName = "owner/repo";
		try {
			const manifest = JSON.parse(await ctx.read("package.json")) as { name?: string };
			if (manifest.name) projectName = manifest.name;
		} catch {
			// ignore
		}
		const endpoint = `https://github.com/${projectName}/${projectName}/releases/latest/download/latest.json`;
		const parsed = JSON.parse(raw) as {
			bundle?: { createUpdaterArtifacts?: boolean };
			plugins?: { updater?: Record<string, unknown> };
		};
		if (parsed.plugins?.updater === undefined) {
			parsed.bundle = { ...(parsed.bundle ?? {}), createUpdaterArtifacts: true };
			parsed.plugins = {
				...(parsed.plugins ?? {}),
				updater: { pubkey: "REPLACE_WITH_PUBKEY", endpoints: [endpoint] },
			};
			await ctx.write(confPath, `${JSON.stringify(parsed, null, "\t")}\n`);
		}
	}

	if (await ctx.exists(readmePath)) {
		const readme = await ctx.read(readmePath);
		if (!readme.includes("## Updater")) {
			await ctx.write(readmePath, `${readme}\n\n## Updater\n\nUpdater feature applied.\n`);
		}
	} else {
		await ctx.write(readmePath, "## Updater\n\nUpdater feature applied.\n");
	}

	return "applied";
}

#!/usr/bin/env bun
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import pkg from "../package.json";

const ROOT = join(import.meta.dir, "..");
const REPO = "JeffreyJYZ/jyz-tool";
const VERSION: string = pkg.version;
const BUNDLE = join(
	ROOT,
	"packages",
	"desktop",
	"src-tauri",
	"target",
	"release",
	"bundle",
	"macos",
);
const ARCHIVE = join(BUNDLE, "jyz.app.tar.gz");
const ARCHIVE_SIG = `${ARCHIVE}.sig`;
const DMG_DIR = join(BUNDLE, "..", "dmg");
const KEY_PATH = join(homedir(), ".config", "jyz", "updater.key");

export function expectedTag(version: string): string {
	return `v${version}`;
}

/** The four assets an installable, self-updating release cannot do without. */
export function requiredAssets(dmgName: string): { name: string }[] {
	return [
		{ name: "jyz.app.tar.gz" },
		{ name: "jyz.app.tar.gz.sig" },
		{ name: dmgName },
		{ name: "latest.json" },
	];
}

/**
 * Every file in `dist/release`, as `gh` wants them: `path#name`. `notes.md` is the release body, not
 * an asset, and the partial manifests are gone by now because the merge consumed them.
 */
export function releaseAssets(distDir = join(ROOT, "dist", "release")): string[] {
	if (!existsSync(distDir)) return [];
	return readdirSync(distDir)
		.filter((name) => name !== "notes.md")
		.sort()
		.map((name) => `${join(distDir, name)}#${name}`);
}

export function signatureVersion(signature: string): string | null {
	const trimmed = signature.trim();
	if (trimmed === "") {
		return null;
	}
	let decoded = "";
	try {
		decoded = Buffer.from(trimmed, "base64").toString("utf8");
	} catch {
		return null;
	}
	const match = /version:(\S+)/.exec(decoded);
	return match?.[1] ?? null;
}

export function assetPlan(_version: string, dmgName: string): { file: string; name: string }[] {
	const tarball = "jyz.app.tar.gz";
	const sig = `${tarball}.sig`;
	return [
		{ file: tarball, name: tarball },
		{ file: sig, name: sig },
		{ file: dmgName, name: dmgName },
		{ file: "latest.json", name: "latest.json" },
	];
}

export function refusals(input: {
	signature: string;
	version: string;
	archiveMtime: number;
	appMtime: number;
	dmgName: string | null;
}): string[] {
	const out: string[] = [];
	const sig = input.signature.trim();
	const sigFile = "jyz.app.tar.gz.sig";
	const archiveFile = "jyz.app.tar.gz";
	if (sig === "") {
		out.push(`${sigFile}: updater signature is empty`);
	} else {
		const signed = signatureVersion(sig);
		if (signed !== input.version) {
			out.push(
				`${sigFile}: signed for ${signed ?? "an unknown version"}, expected ${input.version}`,
			);
		}
	}
	if (input.archiveMtime < input.appMtime) {
		out.push(`${archiveFile}: archive is older than the app binary`);
	}
	if (input.dmgName === null) {
		out.push("dmg: missing");
	}
	return out;
}

function arg(name: string): string | null {
	const index = process.argv.indexOf(name);
	if (index === -1) {
		return null;
	}
	return process.argv[index + 1] ?? null;
}

function run(command: string, args: string[], env?: Record<string, string>): string {
	const result = Bun.spawnSync([command, ...args], {
		cwd: ROOT,
		env: { ...process.env, ...(env ?? {}) },
		stdout: "pipe",
		stderr: "pipe",
	});
	if (result.exitCode !== 0) {
		throw new Error(result.stderr.toString().trim() || result.stdout.toString().trim());
	}
	return result.stdout.toString();
}

function fail(message: string): never {
	console.error(`release-local  FAIL  ${message}`);
	process.exit(1);
}

function log(line: string): void {
	console.log(`release-local  ${line}`);
}

async function main(): Promise<void> {
	const version = VERSION;
	const requestedTag = arg("--tag");
	const tag = requestedTag ?? expectedTag(version);
	if (tag !== expectedTag(version)) {
		fail(`tag ${tag} does not match version ${version}`);
	}

	if (!existsSync(KEY_PATH)) {
		fail(`missing signing key: ${KEY_PATH}`);
	}

	const skipGate = process.argv.includes("--skip-gate");
	if (!skipGate) {
		for (const g of ["typecheck", "lint", "format:check", "test"]) {
			const r = Bun.spawnSync(["bun", "run", g], {
				cwd: ROOT,
				stdio: ["inherit", "inherit", "inherit"],
			});
			if (r.exitCode !== 0) {
				fail(`gate failed: ${g}`);
			}
		}
		log("gate green");
	}

	const skipBuild = process.argv.includes("--skip-build");
	if (!skipBuild) {
		log(`building ${version}`);
		const r = Bun.spawnSync(
			["bun", "run", "--cwd", "packages/desktop", "build", "--", "--bundles", "app"],
			{
				cwd: ROOT,
				env: {
					...process.env,
					TAURI_SIGNING_PRIVATE_KEY: KEY_PATH,
					TAURI_SIGNING_PRIVATE_KEY_PASSWORD: "",
				},
				stdio: ["inherit", "inherit", "inherit"],
			},
		);
		if (r.exitCode !== 0) {
			fail("build failed");
		}
	}

	// The dmg is ours, not Tauri's, and it survives `--skip-build`: build the app once, then publish
	// as many times as needed without paying for another compile.
	const app = join(BUNDLE, "jyz.app");
	if (!existsSync(app)) {
		fail(`missing app bundle: ${app}`);
	}
	Bun.spawnSync(["mkdir", "-p", DMG_DIR], { stdio: ["ignore", "ignore", "ignore"] });
	{
		const arch = process.arch === "arm64" ? "aarch64" : "x86_64";
		const dmgTarget = join(DMG_DIR, `jyz_${version}_${arch}.dmg`);
		const hr = Bun.spawnSync(
			[
				"hdiutil",
				"create",
				"-volname",
				"jyz",
				"-srcfolder",
				app,
				"-ov",
				"-format",
				"UDZO",
				dmgTarget,
			],
			{ stdio: ["ignore", "pipe", "pipe"] },
		);
		if (hr.exitCode !== 0) {
			fail(hr.stderr.toString().trim() || "hdiutil failed");
		}
		log(`dmg ${dmgTarget}`);
		if (existsSync("/Volumes")) {
			for (const name of readdirSync("/Volumes")) {
				if (!name.toLowerCase().startsWith("jyz")) {
					continue;
				}
				try {
					Bun.spawnSync(["hdiutil", "detach", join("/Volumes", name)], {
						stdio: ["ignore", "ignore", "ignore"],
					});
					log(`detached /Volumes/${name}`);
				} catch {
					/* stays mounted */
				}
			}
		}
	}

	Bun.spawnSync(["bun", "scripts/release.ts"], {
		cwd: ROOT,
		stdio: ["inherit", "inherit", "inherit"],
	});
	Bun.spawnSync(["bun", "scripts/updater-manifest.ts"], {
		cwd: ROOT,
		stdio: ["inherit", "inherit", "inherit"],
	});

	const dmgFiles = existsSync(DMG_DIR)
		? readdirSync(DMG_DIR).filter((n) => n.endsWith(".dmg"))
		: [];
	const dmgName = dmgFiles.length > 0 ? (dmgFiles[0] ?? null) : null;
	const signature = existsSync(ARCHIVE_SIG) ? readFileSync(ARCHIVE_SIG, "utf8").trim() : "";
	const archiveMtime = existsSync(ARCHIVE) ? statSync(ARCHIVE).mtimeMs : 0;
	const appMtime = existsSync(join(BUNDLE, "jyz.app", "Contents", "MacOS", "jyz"))
		? statSync(join(BUNDLE, "jyz.app", "Contents", "MacOS", "jyz")).mtimeMs
		: 0;
	const problems = refusals({
		signature,
		version,
		archiveMtime,
		appMtime,
		dmgName,
	});
	if (problems.length > 0) {
		for (const p of problems) {
			fail(p);
		}
	}

	const skipPublish = process.argv.includes("--skip-publish");
	if (!skipPublish) {
		const notesFile = arg("--notes");
		let notes = "Local alpha build.";
		if (notesFile !== null) {
			notes = readFileSync(notesFile, "utf8");
		} else {
			try {
				const prev = run("git", ["describe", "--tags", "--abbrev=0", `${tag}^`]).trim();
				notes = run("git", ["log", "--no-merges", "--pretty=format:- %s", `${prev}..HEAD`]);
			} catch {
				notes = "Local alpha build.";
			}
		}
		const notesTmp = join(ROOT, "dist", "release", "notes.md");
		Bun.spawnSync(["mkdir", "-p", join(ROOT, "dist", "release")], {
			stdio: ["ignore", "ignore", "ignore"],
		});
		writeFileSync(notesTmp, notes);

		let exists = false;
		try {
			run("gh", ["release", "view", tag, "--json", "tagName"]);
			exists = true;
		} catch {
			exists = false;
		}

		const files = releaseAssets();

		if (exists) {
			log(`release ${tag} exists, replacing assets`);
			run("gh", ["release", "upload", tag, ...files, "--clobber"]);
			run("gh", [
				"release",
				"edit",
				tag,
				"--notes-file",
				notesTmp,
				"--prerelease=false",
				"--latest",
			]);
		} else {
			log(`creating release ${tag}`);
			const createArgs = [
				"release",
				"create",
				tag,
				...files,
				"--title",
				tag,
				// Not `--prerelease`: `releases/latest/download/latest.json` is the update endpoint, and
				// GitHub only serves "latest" for a non-prerelease. Quarry ships alphas the same way.
				"--latest",
				"--notes-file",
				notesTmp,
			];
			run("gh", createArgs);
		}

		log("verifying the published release");
		// Verified through the API, not the public asset URL: this repo is private, and GitHub serves
		// release assets only on a public repo, so `releases/latest/download/latest.json` answers 404
		// to an anonymous fetcher no matter what we upload. The updater needs that URL to be public —
		// either the repo goes public or the manifest moves to a public host.
		let tagName = "";
		let assets: string[] = [];
		for (let attempt = 0; attempt < 10; attempt += 1) {
			const latest = run("gh", ["api", `repos/${REPO}/releases/latest`, "--jq", ".tag_name"]);
			if (latest.trim() === tag) {
				tagName = tag;
				const view = run("gh", ["release", "view", tag, "--json", "assets"]);
				assets = (JSON.parse(view) as { assets: { name: string }[] }).assets.map(
					(asset) => asset.name,
				);
				break;
			}
			await new Promise((resolve) => setTimeout(resolve, 5000));
		}
		if (tagName !== tag) {
			fail(
				`the latest release is not ${tag}; gh reports ${tagName === "" ? "nothing" : tagName}`,
			);
		}
		for (const asset of requiredAssets(dmgName as string)) {
			if (!assets.includes(asset.name)) fail(`${tag} is missing asset ${asset.name}`);
		}

		const manifestUrl = `https://github.com/${REPO}/releases/latest/download/latest.json`;
		let publicStatus = 0;
		try {
			const probe = await fetch(manifestUrl, { redirect: "follow" });
			publicStatus = probe.status;
		} catch {
			publicStatus = 0;
		}
		if (publicStatus !== 200) {
			log(
				`WARNING: the public updater endpoint answers ${publicStatus === 0 ? "nothing" : publicStatus}` +
					` — the app cannot self-update until ${manifestUrl} is publicly reachable`,
			);
		}
	}

	log(`published ${tag}`);
	log(`  version  ${version}`);
	log(`  dmg      ${dmgName}`);
	log(`  manifest https://github.com/${REPO}/releases/latest/download/latest.json`);
}

if (import.meta.main) {
	main().catch((error) => {
		console.error(error instanceof Error ? error.message : String(error));
		process.exit(1);
	});
}

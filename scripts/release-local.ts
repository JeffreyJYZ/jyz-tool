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

		const files = [
			`${ARCHIVE}#jyz.app.tar.gz`,
			`${ARCHIVE_SIG}#jyz.app.tar.gz.sig`,
			`${join(DMG_DIR, dmgName as string)}#${dmgName}`,
			`${join(ROOT, "dist", "release", "latest.json")}#latest.json`,
		];

		if (exists) {
			log(`release ${tag} exists, replacing assets`);
			run("gh", ["release", "upload", tag, ...files, "--clobber"]);
			run("gh", ["release", "edit", tag, "--notes-file", notesTmp]);
		} else {
			log(`creating release ${tag}`);
			const createArgs = [
				"release",
				"create",
				tag,
				...files,
				"--title",
				tag,
				"--prerelease",
				"--notes-file",
				notesTmp,
			];
			run("gh", createArgs);
		}

		log("verifying the published manifest");
		let published: {
			version?: string;
			platforms?: Record<string, { signature?: string; url?: string }>;
		} = {};
		let lastError = "";
		for (let attempt = 0; attempt < 10; attempt += 1) {
			try {
				const response = await fetch(
					`https://github.com/${REPO}/releases/latest/download/latest.json`,
					{ redirect: "follow" },
				);
				if (response.ok) {
					published = (await response.json()) as typeof published;
					break;
				}
				lastError = `HTTP ${response.status}`;
			} catch (error) {
				lastError = error instanceof Error ? error.message : String(error);
			}
			await new Promise((resolve) => setTimeout(resolve, 5000));
		}
		if (published.version !== version) {
			fail(
				`latest.json reports ${published.version ?? "nothing"} (${lastError}), expected ${version}`,
			);
		}
		for (const platform of Object.keys(published.platforms ?? {})) {
			const row = published.platforms?.[platform];
			if (
				row === undefined ||
				row.signature === undefined ||
				row.signature.trim() === "" ||
				row.url === undefined ||
				row.url.trim() === ""
			) {
				fail(`latest.json has no usable ${platform} entry`);
			}
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

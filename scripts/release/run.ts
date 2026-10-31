#!/usr/bin/env bun
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import pkg from "../../package.json";
import { expectedTag, refusals, uptodateDmgName } from "./helpers";

const ROOT = join(import.meta.dir, "..", "..");
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

function arg(name: string): string | null {
	const index = process.argv.indexOf(name);
	if (index === -1) {
		return null;
	}
	return process.argv[index + 1] ?? null;
}

export function run(command: string, args: string[], env?: Record<string, string>): string {
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

export async function main(): Promise<void> {
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

	const { buildPhase } = await import("./build");
	buildPhase(version, skipBuild);

	Bun.spawnSync(["bun", "scripts/release.ts"], {
		cwd: ROOT,
		stdio: ["inherit", "inherit", "inherit"],
	});
	Bun.spawnSync(["bun", "scripts/updater-manifest.ts"], {
		cwd: ROOT,
		stdio: ["inherit", "inherit", "inherit"],
	});

	const distDir = join(ROOT, "dist", "release");
	const dmgName =
		uptodateDmgName(existsSync(distDir) ? readdirSync(distDir) : [], version) ?? null;
	const dmgFiles = existsSync(DMG_DIR)
		? readdirSync(DMG_DIR).filter((n) => n.endsWith(".dmg"))
		: [];
	if (dmgFiles.length === 0) fail(`no dmg in ${DMG_DIR}`);
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
		const { publishPhase } = await import("./publish");
		await publishPhase(tag, arg("--notes"), dmgName);
	}

	// Prove the built bundle carries a working CLI before it is published.
	const { installSmoke } = await import("../install-smoke");
	const installed = await installSmoke(join(BUNDLE, "jyz.app"));
	log(`install  ${installed.ok ? "ok" : "FAIL"} ${installed.detail}`);
	if (!installed.ok) fail("the bundled CLI does not run");

	// The desktop plan asks for a size per release; record it where the artefacts already are.
	const { recordSizes } = await import("../bundle-size");
	log(`sizes    ${recordSizes(version.replace(/^v/, ""))}`);

	log(`published ${tag}`);
	log(`  version  ${version}`);
	log(`  dmg      ${dmgName}`);
	log(`  manifest https://github.com/${REPO}/releases/latest/download/latest.json`);
}

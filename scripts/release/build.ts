import { existsSync, readdirSync, rmSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import pkg from "../../package.json";

const ROOT = join(import.meta.dir, "..", "..");
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
const DMG_DIR = join(BUNDLE, "..", "dmg");
const KEY_PATH = join(homedir(), ".config", "jyz", "updater.key");

function fail(message: string): never {
	console.error(`release-local  FAIL  ${message}`);
	process.exit(1);
}

function log(line: string): void {
	console.log(`release-local  ${line}`);
}

export function buildPhase(version: string, skipBuild: boolean): void {
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

	const app = join(BUNDLE, "jyz.app");
	if (!existsSync(app)) {
		fail(`missing app bundle: ${app}`);
	}
	Bun.spawnSync(["mkdir", "-p", DMG_DIR], { stdio: ["ignore", "ignore", "ignore"] });
	for (const name of readdirSync(DMG_DIR)) {
		if (name.endsWith(".dmg")) rmSync(join(DMG_DIR, name), { force: true });
	}
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

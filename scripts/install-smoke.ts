#!/usr/bin/env bun
/**
 * Prove the installer carries a working CLI.
 *
 * The desktop plan promises that installing the app yields a `jyz` too, and that it depends on
 * nothing outside the bundle. So this copies the built bundle to a temp dir — a fresh install with
 * no PATH entry and no checkout nearby — and runs the bundled CLI from there.
 *
 * It also settles the plan's Windows open question: the sidecar ships beside the app binary
 * (`Contents/MacOS/jyz` on macOS, `jyz.exe` next to `jyz-desktop.exe` on Windows) and the app adds
 * nothing to PATH. A CLI-only install therefore needs the CLI package, exactly as the plan says.
 *
 * Usage: `bun scripts/install-smoke.ts [path/to/jyz.app]`.
 */
import { chmodSync, cpSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pkg from "../package.json" with { type: "json" };

const DEFAULT_APP = join(
	import.meta.dir,
	"..",
	"packages",
	"desktop",
	"src-tauri",
	"target",
	"release",
	"bundle",
	"macos",
	"jyz.app",
);

/** The bundled CLI, whatever the platform calls it. */
export function bundledCli(appDir: string): string {
	const candidates =
		process.platform === "win32"
			? [join(appDir, "jyz.exe"), join(appDir, "jyz")]
			: [join(appDir, "Contents", "MacOS", "jyz")];
	for (const candidate of candidates) if (existsSync(candidate)) return candidate;
	throw new Error(`no bundled CLI inside ${appDir}`);
}

/** Retries a run: a bundle can still be settling while the build that made it finishes. */
async function runWithRetry(
	cmd: string[],
	cwd: string,
	attempts = 3,
): Promise<{ ok: boolean; out: string }> {
	let last = { ok: false, out: "never ran" };
	for (let i = 0; i < attempts; i += 1) {
		last = run(cmd, cwd);
		if (last.ok) return last;
		await Bun.sleep(400);
	}
	return last;
}

function run(cmd: string[], cwd: string): { ok: boolean; out: string } {
	const proc = Bun.spawnSync({ cmd, cwd, stdout: "pipe", stderr: "pipe" });
	const out = `${proc.stdout.toString()}${proc.stderr.toString()}`.trim();
	return { ok: proc.exitCode === 0, out: out.split("\n").slice(0, 3).join(" | ") };
}

export async function installSmoke(appPath: string): Promise<{ ok: boolean; detail: string }> {
	if (!existsSync(appPath)) return { ok: false, detail: `no bundle at ${appPath}` };
	const dir = mkdtempSync(join(tmpdir(), "jyz-install-"));
	try {
		// A copy is the point: it has no sibling checkout, and the temp dir is not on PATH.
		const installed = join(dir, "jyz.app");
		cpSync(appPath, installed, { recursive: true, dereference: true });
		const cli = bundledCli(installed);
		chmodSync(cli, 0o755);
		const version = await runWithRetry([cli, "--version"], dir);
		if (!version.ok) return { ok: false, detail: `bundled CLI failed: ${version.out}` };
		if (!version.out.includes(pkg.version)) {
			return { ok: false, detail: `version mismatch: ${version.out} vs ${pkg.version}` };
		}
		const project = join(dir, "project");
		Bun.spawnSync(["mkdir", "-p", project]);
		const config = await runWithRetry([cli, "config", "path"], project);
		if (!config.ok) return { ok: false, detail: `config path failed: ${config.out}` };
		return { ok: true, detail: `${version.out} · ${config.out}` };
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
}

if (import.meta.main) {
	const app = Bun.argv[2] ?? DEFAULT_APP;
	const result = await installSmoke(app);
	console.log(`${result.ok ? "ok" : "FAIL"} install-smoke ${result.detail}`);
	process.exit(result.ok ? 0 : 1);
}

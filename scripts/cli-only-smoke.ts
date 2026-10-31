#!/usr/bin/env bun
/**
 * Prove the CLI-only install.
 *
 * The desktop plan draws a line between the two artefacts: installing the app yields a `jyz`
 * inside the bundle, and installing only the CLI yields the CLI and nothing else. The install smoke
 * covers the first; this covers the second, from the released binary a CLI-only user actually
 * downloads — no package manager, no checkout, nothing on PATH beforehand.
 *
 * Usage: `bun scripts/cli-only-smoke.ts [path/to/cli-binary]`.
 */
import {
	chmodSync,
	copyFileSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pkg from "../package.json" with { type: "json" };

const RELEASE_DIR = join(import.meta.dir, "..", "dist", "release");

/** The released CLI binary for this platform, or null when the release has not been built. */
export function releasedCli(dir: string = RELEASE_DIR): string | null {
	if (!existsSync(dir)) return null;
	const name = readdirSync(dir).find(
		(entry) => entry.startsWith("cli-") && !entry.endsWith(".tgz") && !entry.endsWith(".sig"),
	);
	return name === undefined ? null : join(dir, name);
}

function run(cmd: string, env: Record<string, string>): { ok: boolean; out: string } {
	const proc = Bun.spawnSync({ cmd: [cmd, "--version"], env, stdout: "pipe", stderr: "pipe" });
	return {
		ok: proc.exitCode === 0,
		out: `${proc.stdout.toString()}${proc.stderr.toString()}`.trim(),
	};
}

export function cliOnlySmoke(binary?: string | null): { ok: boolean; detail: string } {
	const source = binary ?? releasedCli();
	if (source === null || !existsSync(source)) {
		return { ok: false, detail: "no released CLI binary in dist/release" };
	}
	const dir = mkdtempSync(join(tmpdir(), "jyz-cli-only-"));
	try {
		const binDir = join(dir, "bin");
		mkdirSync(binDir, { recursive: true });
		const installed = join(binDir, "jyz");
		copyFileSync(source, installed);
		chmodSync(installed, 0o755);
		// PATH holds the installed CLI and the system dirs only: nothing from a desktop bundle.
		const env = { ...process.env, PATH: `${binDir}:/usr/bin:/bin` } as Record<string, string>;
		const version = run(installed, env);
		if (!version.ok) return { ok: false, detail: `install failed: ${version.out}` };
		if (!version.out.includes(pkg.version)) {
			return { ok: false, detail: `version mismatch: ${version.out} vs ${pkg.version}` };
		}
		return { ok: true, detail: version.out };
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
}

if (import.meta.main) {
	const result = cliOnlySmoke(Bun.argv[2]);
	console.log(`${result.ok ? "ok" : "FAIL"} cli-only-smoke ${result.detail}`);
	process.exit(result.ok ? 0 : 1);
}

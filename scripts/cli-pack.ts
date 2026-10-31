#!/usr/bin/env bun
/**
 * Pack the CLI the way npm would deliver it, install it into a temp project, and run it.
 *
 * `scripts/mcp-pack.ts` does this for the MCP server; the CLI had no equivalent, so "install the CLI
 * on its own" was only proven through the compiled binary a release attaches. That leaves the
 * package path — `bun add -g jyz` — untested, and a workspace dependency that fails to rewrite would
 * only show up after a publish.
 *
 * Usage: `bun scripts/cli-pack.ts [--keep]`.
 */

import { mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..");
const KEEP = Bun.argv.includes("--keep");
const DIST = join(ROOT, "dist", "cli-pack");

function run(cmd: string[], cwd?: string): { ok: boolean; out: string } {
	const r = Bun.spawnSync(cmd, { cwd, stdout: "pipe", stderr: "pipe" });
	const out = `${new TextDecoder().decode(r.stdout)}${new TextDecoder().decode(r.stderr)}`;
	return { ok: r.exitCode === 0, out };
}

/** The tarball inside `dir`; `bun add` needs the .tgz, not the directory. */
function tarball(dir: string): string {
	const name = readdirSync(dir).find((entry) => entry.endsWith(".tgz"));
	if (name === undefined) throw new Error(`no tarball in ${dir}`);
	return join(dir, name);
}

function step(name: string, ok: boolean, detail = ""): void {
	console.log(`${ok ? "ok" : "FAIL"}: ${name}`);
	if (!ok && detail.trim()) {
		for (const line of detail.trim().split("\n").slice(0, 20)) console.log(line);
	}
}

mkdirSync(DIST, { recursive: true });
mkdirSync(join(ROOT, "dist", "core"), { recursive: true });

// The published bin is a bundle: core is inlined at build time, so the package installs with no
// @jyz/core entry on the registry.
const build = run(["bun", "run", "build"], join(ROOT, "packages", "cli"));
step("bundle the CLI", build.ok, build.out);

const cli = run(["bun", "pm", "pack", "--destination", DIST], join(ROOT, "packages", "cli"));
step("pack jyz", cli.ok, cli.out);

const temp = mkdtempSync(join(tmpdir(), "jyz-cli-pack-"));
step("create temp dir", true, temp);

const init = run(["bun", "init", "-y"], temp);
step("bun init", init.ok, init.out);

const installCli = run(["bun", "add", tarball(DIST)], temp);
step("install jyz tarball", installCli.ok, installCli.out);

const bin = join(temp, "node_modules", ".bin", process.platform === "win32" ? "jyz.cmd" : "jyz");
const version = run([bin, "--version"], temp);
step(
	"installed bin answers --version",
	version.ok && version.out.includes("jyz/"),
	version.out.trim().slice(0, 120),
);

const config = run([bin, "config", "path"], temp);
step(
	"installed bin answers config path",
	config.ok && config.out.includes("jyz.config.toml"),
	config.out.trim().slice(0, 120),
);

if (!KEEP) rmSync(temp, { recursive: true, force: true });
else console.log(`kept ${temp}`);

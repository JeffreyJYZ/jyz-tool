#!/usr/bin/env bun
// Packs @jyz/mcp, installs the tarball in a temp dir, and smoke-tests the
// stdio initialize handshake. Build is not needed: bun runs the .ts entry
// directly, so the simplest publishable shape keeps src/bin.ts as the bin.

import { mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..");
const KEEP = process.argv.includes("--keep");
const dist = join(ROOT, "dist", "mcp");
mkdirSync(dist, { recursive: true });

function run(cmd: string[], cwd?: string): { ok: boolean; out: string } {
	const r = Bun.spawnSync(cmd, { cwd, stdout: "pipe", stderr: "pipe" });
	const out = `${new TextDecoder().decode(r.stdout)}${new TextDecoder().decode(r.stderr)}`;
	return { ok: r.exitCode === 0, out };
}

function step(name: string, ok: boolean, detail = ""): void {
	console.log(`${ok ? "ok" : "FAIL"}: ${name}`);
	if (!ok && detail.trim()) {
		for (const line of detail.trim().split("\n").slice(0, 20)) console.log(line);
	}
}

// 1. pack core (dependency) and mcp
const corePack = run(
	["bun", "pm", "pack", "--destination", join(ROOT, "dist", "core")],
	join(ROOT, "packages", "core"),
);
mkdirSync(join(ROOT, "dist", "core"), { recursive: true });
step("pack @jyz/core", corePack.ok, corePack.out);
const mcpPack = run(["bun", "pm", "pack", "--destination", dist], join(ROOT, "packages", "mcp"));
step("pack @jyz/mcp", mcpPack.ok, mcpPack.out);

const temp = mkdtempSync(join(tmpdir(), "jyz-mcp-pack-"));
step("create temp dir", true, temp);

// 2. install tarballs
let coreTar = "";
let mcpTar = "";
for (const f of readdirSync(join(ROOT, "dist", "core"))) {
	if (f.endsWith(".tgz")) coreTar = join(ROOT, "dist", "core", f);
}
for (const f of readdirSync(dist)) {
	if (f.endsWith(".tgz")) mcpTar = join(dist, f);
}

const i1 = run(["bun", "init", "-y"], temp);
step("bun init", i1.ok, i1.out);
const i2 = run(["bun", "add", coreTar], temp);
step("install core tarball", i2.ok, i2.out);
// Resolve @jyz/core locally instead of from the registry.
const pkgPath = join(temp, "package.json");
const pkg = JSON.parse(require("node:fs").readFileSync(pkgPath, "utf8"));
pkg.overrides = { "@jyz/core": coreTar };
require("node:fs").writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
const i3 = run(["bun", "add", mcpTar], temp);
step("install mcp tarball", i3.ok, i3.out);

// 3. initialize handshake
const proc = Bun.spawn([join(temp, "node_modules", ".bin", "jyz-mcp")], {
	stdin: "pipe",
	stdout: "pipe",
	stderr: "pipe",
});
const frame = JSON.stringify({
	jsonrpc: "2.0",
	id: 1,
	method: "initialize",
	params: { protocolVersion: "2024-11-05" },
});
proc.stdin.write(frame + "\n");
proc.stdin.end();
const out = await new Response(proc.stdout).text();
await proc.exited;
let ok = false;
try {
	const line = out
		.trim()
		.split("\n")
		.find((l) => l.includes("serverInfo"));
	const obj = JSON.parse(line ?? "{}");
	ok =
		obj?.result?.serverInfo?.name === "jyz-mcp" ||
		typeof obj?.result?.protocolVersion === "string";
} catch {
	ok = false;
}
step("initialize handshake", ok, out);

if (!KEEP) rmSync(temp, { recursive: true, force: true });
console.log(KEEP ? `kept: ${temp}` : "cleaned temp dir");
process.exit(ok && i3.ok && mcpPack.ok ? 0 : 1);

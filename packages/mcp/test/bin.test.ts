import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BIN = join(import.meta.dir, "..", "src", "bin.ts");
const PKG = join(import.meta.dir, "..", "package.json");

test("manifest invariants", () => {
	const pkg = JSON.parse(readFileSync(PKG, "utf8")) as Record<string, unknown>;
	// The package is installable from the registry, so `private` must stay absent; a `true` here
	// silently blocks every publish.
	expect(pkg.private).toBeUndefined();
	expect((pkg.bin as Record<string, string>)["jyz-mcp"]).toBe("./src/bin.ts");
	expect(typeof pkg.description).toBe("string");
	expect(pkg.license).toBe("MIT");
	expect((pkg.engines as Record<string, string>).bun).toBeTruthy();
	expect(pkg.files).toContain("src/**");
	expect((pkg.publishConfig as Record<string, string>).access).toBe("public");
	expect(
		readFileSync(join(import.meta.dir, "..", "src", "bin.ts"), "utf8").startsWith(
			"#!/usr/bin/env bun",
		),
	).toBe(true);
});

async function runBin(args: string[], env: Record<string, string> = {}): Promise<string[]> {
	const proc = Bun.spawn(["bun", BIN, ...args], {
		env: { ...process.env, ...env },
		stdin: "pipe",
		stdout: "pipe",
		stderr: "pipe",
	});
	const writer = proc.stdin as { write: (chunk: string) => number; end: () => void };
	writer.write(
		`${JSON.stringify({
			jsonrpc: "2.0",
			id: 1,
			method: "initialize",
			params: { protocolVersion: "2025-06-18" },
		})}\n`,
	);
	writer.write(`${JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" })}\n`);
	writer.end();
	const out = await new Response(proc.stdout).text();
	await proc.exited;
	return out.split("\n").filter((l) => l.trim() !== "");
}

test("bin answers initialize and lists 15 tools", async () => {
	const lines = await runBin([]);
	const frames = lines.map((l) => JSON.parse(l) as Record<string, unknown>);
	expect(frames).toHaveLength(2);
	expect((frames[0]?.result as Record<string, unknown>)?.serverInfo).toMatchObject({
		name: "jyz",
	});
	const tools = (frames[1]?.result as Record<string, unknown>)?.tools as unknown[];
	expect(tools).toHaveLength(15);
});

test("--cwd wins over JYZ_MCP_CWD", async () => {
	const tmp = mkdtempSync(join(tmpdir(), "jyz-mcp-cwd-"));
	writeFileSync(join(tmp, "package.json"), JSON.stringify({ name: "fixture", version: "1.0.0" }));
	const env = { JYZ_MCP_CWD: process.cwd() };
	const proc = Bun.spawn(["bun", BIN, "--cwd", tmp], {
		env: { ...process.env, ...env },
		stdin: "pipe",
		stdout: "pipe",
		stderr: "pipe",
	});
	const writer = proc.stdin as { write: (chunk: string) => number; end: () => void };
	writer.write(
		`${JSON.stringify({
			jsonrpc: "2.0",
			id: 1,
			method: "tools/call",
			params: { name: "jyz_config", arguments: { action: "show" } },
		})}\n`,
	);
	writer.end();
	const out = await new Response(proc.stdout).text();
	await proc.exited;
	const frame = JSON.parse(out.trim().split("\n")[0] ?? "{}") as Record<string, unknown>;
	const result = frame.result as Record<string, unknown>;
	const payload = JSON.parse(String((result.content as Record<string, unknown>[])[0]?.text));
	expect(payload.packageDir).toBe(tmp);
});

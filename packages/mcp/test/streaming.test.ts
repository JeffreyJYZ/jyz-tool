import { expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { callTool } from "../src/handler.ts";

test("watch streams and cancel stops", async () => {
	const dir = mkdtempSync(join(tmpdir(), "jyz-mcp-"));
	writeFileSync(
		join(dir, "package.json"),
		JSON.stringify({ name: "fixture", version: "1.0.0", scripts: { slow: "sleep 30" } }),
	);
	const frames: unknown[] = [];
	const start = await callTool(
		"jyz_watch",
		{ script: "slow" },
		{ cwd: dir, onProgress: (f: unknown) => frames.push(f) },
	);
	expect((start as unknown as Record<string, unknown>).streaming).toBe(true);
	const handle = (start as unknown as Record<string, unknown>).handle;
	await new Promise((r) => setTimeout(r, 200));
	const cancel = await callTool("jyz_cancel", { handle }, dir);
	expect((cancel as unknown as Record<string, unknown>).cancelled).toBe(true);
	expect(frames.length).toBeGreaterThan(0);
});

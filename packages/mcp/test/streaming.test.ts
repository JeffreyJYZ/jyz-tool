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
	const frames: any[] = [];
	const start = await callTool(
		"jyz_watch",
		{ script: "slow" },
		{ cwd: dir, onProgress: (f: any) => frames.push(f) },
	);
	expect((start as any).streaming).toBe(true);
	const handle = (start as any).handle;
	await new Promise((r) => setTimeout(r, 200));
	const cancel = await callTool("jyz_cancel", { handle }, dir);
	expect((cancel as any).cancelled).toBe(true);
	expect(frames.some((f) => f.type === "start")).toBe(true);
});

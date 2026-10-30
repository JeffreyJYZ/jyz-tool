import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveExecutable, runCommand } from "../src/funcs/exec.ts";

test("resolveExecutable prefers .bin", () => {
	const root = mkdtempSync(join(tmpdir(), "jyz-"));
	const binDir = join(root, "node_modules", ".bin");
	mkdirSync(binDir, { recursive: true });
	writeFileSync(join(binDir, "foo"), "#!/bin/sh\necho hi\n");
	expect(resolveExecutable("bun", root, "foo")).toBe(join(binDir, "foo"));
});

test("resolveExecutable falls back to runner", () => {
	const root = mkdtempSync(join(tmpdir(), "jyz-"));
	expect(resolveExecutable("bun", root, "foo")).toBe("bunx");
	expect(resolveExecutable("pnpm", root, "foo")).toBe("pnpm");
});

test("runCommand mirrors exit code", async () => {
	const spec = { file: "bun", argv: ["-e", "process.exit(3)"], cwd: process.cwd() };
	const res = await runCommand(spec, { stdio: "pipe" });
	expect(res.exitCode).toBe(3);
});

test("runCommand captures stdout in pipe mode", async () => {
	const spec = { file: "bun", argv: ["-e", "console.log('hello')"], cwd: process.cwd() };
	const res = await runCommand(spec, { stdio: "pipe" });
	expect(res.stdout.trim()).toBe("hello");
});

test("runCommand inherit returns empty strings", async () => {
	const spec = { file: "bun", argv: ["-e", "process.exit(0)"], cwd: process.cwd() };
	const res = await runCommand(spec);
	expect(res.stdout).toBe("");
	expect(res.stderr).toBe("");
});

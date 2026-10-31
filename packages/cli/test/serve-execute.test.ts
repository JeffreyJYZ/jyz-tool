import { expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRpcServer } from "../src/rpc.ts";

function fixture(): string {
	const dir = mkdtempSync(join(tmpdir(), "jyz-rpc-exec-"));
	writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "rpc-fixture" }));
	writeFileSync(join(dir, "bun.lock"), "");
	return dir;
}

test("execute false: dispatch answer carries argv and no stdout", async () => {
	const server = createRpcServer({ cwd: fixture(), execute: false });
	const result = await server.call("install", {});
	expect(result.exitCode).toBe(0);
	expect(result.argv).toEqual(["bun", "install"]);
	expect(result.stdout).toBeUndefined();
});

test("execute true: runs the resolved command", async () => {
	const server = createRpcServer({ cwd: fixture(), execute: true });
	const result = await server.call("install", {});
	expect(result.argv).toEqual(["bun", "install"]);
	expect(typeof result.exitCode).toBe("number");
});

test("execute true: unknown method still -32601", async () => {
	const server = createRpcServer({ cwd: fixture(), execute: true });
	let caught: unknown;
	try {
		await server.call("nope", {});
	} catch (error) {
		caught = error;
	}
	expect((caught as { code: number }).code).toBe(-32601);
});

test("execute true: timeout resolves", async () => {
	const server = createRpcServer({ cwd: fixture(), execute: true, timeoutMs: 1 });
	const result = await server.call("install", {});
	expect(result.exitCode).toBeDefined();
});

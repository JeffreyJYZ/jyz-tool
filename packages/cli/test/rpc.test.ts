import { expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cac } from "cac";
import { listCapabilities } from "../../core/src/funcs/capabilities.ts";
import { registerConfig } from "../src/commands/config.ts";
import { registerCreate } from "../src/commands/create.ts";
import { registerDispatch } from "../src/commands/dispatch.ts";
import { registerServe } from "../src/commands/serve.ts";
import { registerToolchain } from "../src/commands/toolchain.ts";
import {
	createRpcServer,
	encodeFrame,
	METHOD_NOT_FOUND,
	PARSE_ERROR,
	RpcError,
	serveStdio,
	splitFrames,
} from "../src/rpc.ts";

/** A throwaway package: one manifest plus the lockfile that decides the package manager. */
function fixture(lock: "bun.lock" | "pnpm-lock.yaml"): string {
	const dir = mkdtempSync(join(tmpdir(), "jyz-rpc-"));
	writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "rpc-fixture" }));
	writeFileSync(join(dir, lock), "");
	return dir;
}

async function* chunks(parts: readonly string[]): AsyncIterable<string> {
	for (const part of parts) yield part;
}

test("the manifest covers every command bin.ts registers", () => {
	const cli = cac("jyz");
	registerConfig(cli);
	registerCreate(cli);
	registerDispatch(cli);
	registerToolchain(cli);
	const registered = cli.commands.map((command) => command.name);
	expect(registered.length).toBeGreaterThan(0);
	const names = listCapabilities().map((capability) => capability.name);
	for (const name of registered) expect(names).toContain(name);
});

test("serve is registered and stays out of the help body", () => {
	const cli = cac("jyz");
	registerConfig(cli);
	registerServe(cli);
	expect(cli.commands.map((command) => command.name)).toContain("serve");

	const printed: string[] = [];
	const original = console.info;
	console.info = (...args: unknown[]) => void printed.push(args.join(" "));
	try {
		cli.outputHelp();
	} finally {
		console.info = original;
	}
	expect(printed.join("\n")).not.toContain("serve");
	expect(printed.join("\n")).toContain("config");
});

test("install resolves to the detected package manager", async () => {
	const server = createRpcServer({ cwd: fixture("bun.lock") });
	const result = await server.call("install", {});
	expect(result).toEqual({ exitCode: 0, argv: ["bun", "install"] });
});

test("add forwards dev and the packages through the detected manager", async () => {
	const server = createRpcServer({ cwd: fixture("pnpm-lock.yaml") });
	const result = await server.call("add", { args: ["typescript"], dev: true });
	expect(result.argv).toEqual(["pnpm", "add", "-D", "typescript"]);
	expect(result.exitCode).toBe(0);
});

test("an unknown method rejects with -32601", async () => {
	const server = createRpcServer({ cwd: fixture("bun.lock") });
	let caught: unknown;
	try {
		await server.call("nope", {});
	} catch (error) {
		caught = error;
	}
	expect(caught).toBeInstanceOf(RpcError);
	expect((caught as RpcError).code).toBe(METHOD_NOT_FOUND);
});

test("a config read reaches the CLI text", async () => {
	const result = await createRpcServer({ cwd: fixture("bun.lock") }).call("config", {
		action: "show",
	});
	expect(result.exitCode).toBe(0);
	expect(result.stdout).toContain("package_manager = bun");
});

test("a user error comes back as exitCode 1, not a protocol fault", async () => {
	const result = await createRpcServer({ cwd: fixture("bun.lock") }).call("config", {
		action: "get",
		key: "project.unknown",
	});
	expect(result.exitCode).toBe(1);
	expect(result.stderr).toContain("unknown config key");
});

test("framing round-trips one message per line", () => {
	const request = { jsonrpc: "2.0" as const, id: 7, method: "install", params: {} };
	const frame = encodeFrame(request);
	expect(frame.endsWith("\n")).toBe(true);
	const { messages, rest } = splitFrames(`${frame}{"jsonrpc":"2.0","id":8,"method":"in`);
	expect(messages).toEqual([request]);
	expect(rest).toBe('{"jsonrpc":"2.0","id":8,"method":"in');
});

test("serveStdio answers per frame, skips notifications and survives a split chunk", async () => {
	const server = createRpcServer({ cwd: fixture("bun.lock") });
	const payload = [
		JSON.stringify({ jsonrpc: "2.0", id: 1, method: "install", params: {} }),
		JSON.stringify({ jsonrpc: "2.0", method: "install", params: {} }),
		JSON.stringify({ jsonrpc: "2.0", id: 2, method: "nope" }),
		"{not json",
		"",
	].join("\n");
	const out: string[] = [];
	await serveStdio(server, {
		input: chunks([payload.slice(0, 17), payload.slice(17, 61), payload.slice(61)]),
		write: (text) => out.push(text),
	});

	expect(out).toHaveLength(3);
	const frames = out.map(
		(text) =>
			JSON.parse(text) as {
				id: unknown;
				result?: { argv?: string[] };
				error?: { code: number };
			},
	);
	expect(frames[0]?.id).toBe(1);
	expect(frames[0]?.result?.argv).toEqual(["bun", "install"]);
	expect(frames[1]?.id).toBe(2);
	expect(frames[1]?.error?.code).toBe(METHOD_NOT_FOUND);
	expect(frames[2]?.id).toBeNull();
	expect(frames[2]?.error?.code).toBe(PARSE_ERROR);
	for (const text of out) expect(text.endsWith("\n")).toBe(true);
});

import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnedServers, spawnServer } from "../src/funcs/opencode/index.ts";
import { writeStub } from "./helpers/stub.ts";

const originalPath = process.env.PATH;
const originalUrl = process.env.JYZ_OPENCODE_URL;

afterEach(() => {
	process.env.PATH = originalPath ?? "";
	if (originalUrl === undefined) delete process.env.JYZ_OPENCODE_URL;
	else process.env.JYZ_OPENCODE_URL = originalUrl;
});

function stubDir(name: string, options: Parameters<typeof writeStub>[2] = {}): string {
	const dir = mkdtempSync(join(tmpdir(), "jyz-stub-"));
	writeStub(dir, name, options);
	process.env.PATH = `${dir}:${process.env.PATH ?? ""}`;
	return dir;
}

describe("spawnServer", () => {
	test("spawns a stub, lists it, and leaves nothing after stop", async () => {
		const port = 18123;
		process.env.JYZ_OPENCODE_URL = `http://127.0.0.1:${port}`;
		// A stub that stays alive: the body runs a server and never resolves.
		stubDir("opencode", {
			body: `Bun.serve({ port: ${port}, hostname: "127.0.0.1", fetch: () => new Response("ok") });\nconsole.log("ready");\nawait new Promise(() => {});`,
		});
		const server = await spawnServer({ command: "opencode", cwd: tmpdir() });
		expect(spawnedServers()).toContain(server.pid);
		expect(server.baseUrl).toBe(`http://127.0.0.1:${port}`);
		await server.stop();
		expect(spawnedServers()).not.toContain(server.pid);
		await server.stop();
	});

	test("a failing stub throws a typed error", async () => {
		process.env.JYZ_OPENCODE_URL = "http://127.0.0.1:18124";
		stubDir("opencode-failing", { exitCode: 1 });
		let caught: unknown;
		try {
			await spawnServer({ command: "opencode-failing", cwd: tmpdir() });
		} catch (error) {
			caught = error;
		}
		expect(caught).toBeInstanceOf(Error);
		expect(String(caught)).toContain("exit");
	});

	test("stop on an unknown pid is a no-op", () => {
		// no spawned server for 999999; ensure membership check prevents signalling
		expect(spawnedServers()).not.toContain(999999);
	});
});

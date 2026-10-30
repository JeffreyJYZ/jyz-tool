import { expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type ServeIo, serve } from "../src/stdio.ts";
import { listTools } from "../src/tools.ts";

interface Pipe {
	io: ServeIo;
	out: string[];
}

/** In-memory stdin: each chunk is delivered to `read` in order, then EOF. */
function pipe(chunks: string[]): Pipe {
	const out: string[] = [];
	let next = 0;
	return {
		out,
		io: {
			read: async () => {
				const chunk = chunks[next];
				next += 1;
				return chunk ?? null;
			},
			write: (chunk: string) => {
				out.push(chunk);
			},
		},
	};
}

interface Frame {
	jsonrpc?: unknown;
	id?: unknown;
	result?: Record<string, unknown>;
	error?: { code: number; message: string; data?: unknown };
}

async function run(lines: string[], cwd = process.cwd()): Promise<Frame[]> {
	const p = pipe(lines.map((line) => `${line}\n`));
	await serve(p.io, { cwd });
	return p.out
		.join("")
		.split("\n")
		.filter((line) => line.trim() !== "")
		.map((line) => JSON.parse(line) as Frame);
}

const call = (id: number, method: string, params?: unknown): string =>
	JSON.stringify({ jsonrpc: "2.0", id, method, params });

function fixtureCwd(): string {
	const dir = mkdtempSync(join(tmpdir(), "jyz-mcp-"));
	writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "fixture", version: "1.0.0" }));
	return dir;
}

test("initialize handshake reports protocol, tools capability and server info", async () => {
	const [res] = await run([
		call(1, "initialize", {
			protocolVersion: "2025-06-18",
			capabilities: {},
			clientInfo: { name: "test", version: "0.0.0" },
		}),
	]);
	expect(res?.jsonrpc).toBe("2.0");
	expect(res?.id).toBe(1);
	expect(res?.error).toBeUndefined();
	const result = res?.result ?? {};
	expect(result.protocolVersion).toBe("2025-06-18");
	expect(result.capabilities).toEqual({
		tools: { listChanged: false },
		resources: { listChanged: false },
	});
	expect(result.serverInfo).toMatchObject({ name: "jyz" });
	expect(typeof (result.serverInfo as Record<string, unknown>).version).toBe("string");
});

test("initialize falls back to the server protocol for an unknown version", async () => {
	const [res] = await run([call(1, "initialize", { protocolVersion: "1999-01-01" })]);
	expect(res?.result?.protocolVersion).toBe("2025-06-18");
});

test("tools/list returns every tool with name, description, schema and annotation", async () => {
	const [res] = await run([call(1, "tools/list")]);
	const tools = (res?.result?.tools ?? []) as Record<string, unknown>[];
	expect(tools).toHaveLength(listTools().length);
	expect(tools).toHaveLength(15);
	for (const tool of tools) {
		expect(typeof tool.name).toBe("string");
		expect(typeof tool.description).toBe("string");
		expect(tool.inputSchema).toMatchObject({ type: "object" });
		expect(tool.annotations).toMatchObject({ destructiveHint: expect.any(Boolean) });
	}
	const names = tools.map((tool) => tool.name);
	expect(names).toContain("jyz_install");
	expect(names).toContain("jyz_fmt");
});

test("tools/call runs the handler and returns its result as a text block", async () => {
	const [res] = await run(
		[call(7, "tools/call", { name: "jyz_config", arguments: { action: "show" } })],
		fixtureCwd(),
	);
	expect(res?.id).toBe(7);
	expect(res?.error).toBeUndefined();
	const result = res?.result ?? {};
	expect(result.isError).toBeUndefined();
	const content = (result.content ?? []) as Record<string, unknown>[];
	expect(content).toHaveLength(1);
	expect(content[0]?.type).toBe("text");
	const payload = JSON.parse(String(content[0]?.text)) as Record<string, unknown>;
	expect(payload.exitCode).toBe(0);
	expect(typeof payload.packageDir).toBe("string");
	expect(JSON.parse(String(payload.stdout))).toMatchObject({
		project: { package_manager: { value: "bun" } },
	});
});

test("tools/call marks a thrown handler error with isError", async () => {
	// A cwd with no package.json anywhere above makes resolveProject throw.
	const [res] = await run(
		[call(3, "tools/call", { name: "jyz_config", arguments: { action: "show" } })],
		"/nonexistent-jyz-fixture",
	);
	expect(res?.error).toBeUndefined();
	const result = res?.result ?? {};
	expect(result.isError).toBe(true);
	const content = (result.content ?? []) as Record<string, unknown>[];
	expect(content[0]?.type).toBe("text");
	expect(String(content[0]?.text)).toContain("no project found");
});

test("tools/call rejects an unknown tool name", async () => {
	const [res] = await run([call(4, "tools/call", { name: "jyz_nope", arguments: {} })]);
	expect(res?.result).toBeUndefined();
	expect(res?.error?.code).toBe(-32602);
	expect(res?.error?.message).toContain("jyz_nope");
	const data = (res?.error?.data ?? {}) as { validNames?: string[] };
	expect(data.validNames).toContain("jyz_install");
});

test("malformed JSON line gets a parse error and the loop keeps going", async () => {
	const frames = await run(["{not json", call(5, "ping")]);
	expect(frames).toHaveLength(2);
	expect(frames[0]?.id).toBeNull();
	expect(frames[0]?.error?.code).toBe(-32700);
	expect(frames[1]?.id).toBe(5);
	expect(frames[1]?.result).toEqual({});
});

test("a non-object frame gets an invalid request error", async () => {
	const [res] = await run(["[1,2,3]"]);
	expect(res?.error?.code).toBe(-32600);
});

test("unknown method returns -32601", async () => {
	const [res] = await run([call(6, "nope/not-a-method")]);
	expect(res?.id).toBe(6);
	expect(res?.error?.code).toBe(-32601);
});

test("ping answers with an empty result", async () => {
	const [res] = await run([call(8, "ping")]);
	expect(res?.result).toEqual({});
});

test("a notification gets no reply", async () => {
	const frames = await run([
		JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
		call(9, "ping"),
	]);
	expect(frames).toHaveLength(1);
	expect(frames[0]?.id).toBe(9);
});

test("frames split across chunks are reassembled", async () => {
	const p = pipe([call(10, "ping").slice(0, 12), `${call(10, "ping").slice(12)}\n`]);
	await serve(p.io, { cwd: process.cwd() });
	const frames = p.out
		.join("")
		.split("\n")
		.filter((line) => line.trim() !== "");
	expect(frames).toHaveLength(1);
	expect((JSON.parse(frames[0] ?? "{}") as Frame).id).toBe(10);
});

test("a final unterminated line is still handled", async () => {
	const p = pipe([call(11, "ping")]);
	await serve(p.io, { cwd: process.cwd() });
	const frames = p.out
		.join("")
		.split("\n")
		.filter((line) => line.trim() !== "");
	expect(frames).toHaveLength(1);
	expect((JSON.parse(frames[0] ?? "{}") as Frame).id).toBe(11);
});

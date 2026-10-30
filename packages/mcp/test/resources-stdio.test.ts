import { expect, test } from "bun:test";
import { type ServeIo, serve } from "../src/stdio.ts";

interface Pipe {
	io: ServeIo;
	out: string[];
}

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
	error?: { code: number; message: string };
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

test("initialize advertises resources capability", async () => {
	const [res] = await run([
		call(1, "initialize", { protocolVersion: "2025-06-18", capabilities: {} }),
	]);
	const result = res?.result ?? {};
	expect(result.capabilities).toMatchObject({ resources: { listChanged: false } });
});

test("resources/list returns both URIs", async () => {
	const [res] = await run([call(1, "resources/list")]);
	const resources = (res?.result?.resources ?? []) as Record<string, unknown>[];
	expect(resources).toHaveLength(2);
	expect(resources.map((r) => r.uri)).toEqual(["jyz://config", "jyz://capabilities"]);
	for (const r of resources) {
		expect(typeof r.name).toBe("string");
		expect(typeof r.description).toBe("string");
		expect(typeof r.mimeType).toBe("string");
	}
});

test("resources/read returns contents for a known URI", async () => {
	const [res] = await run([call(2, "resources/read", { uri: "jyz://capabilities" })]);
	const contents = (res?.result?.contents ?? []) as Record<string, unknown>[];
	expect(contents).toHaveLength(1);
	expect(contents[0]?.uri).toBe("jyz://capabilities");
	expect(contents[0]?.mimeType).toBe("application/json");
	expect(typeof contents[0]?.text).toBe("string");
});

test("resources/read unknown URI returns -32602 and loop stays alive", async () => {
	const frames = await run([call(3, "resources/read", { uri: "jyz://nope" }), call(4, "ping")]);
	expect(frames).toHaveLength(2);
	expect(frames[0]?.error?.code).toBe(-32602);
	expect(frames[0]?.error?.message).toContain("unknown resource");
	expect(frames[1]?.result).toEqual({});
});

test("resources/read malformed params returns -32602 and loop stays alive", async () => {
	const frames = await run([
		call(5, "resources/read", {}),
		call(6, "resources/read", { uri: 42 }),
		call(7, "ping"),
	]);
	expect(frames).toHaveLength(3);
	expect(frames[0]?.error?.code).toBe(-32602);
	expect(frames[1]?.error?.code).toBe(-32602);
	expect(frames[2]?.result).toEqual({});
});

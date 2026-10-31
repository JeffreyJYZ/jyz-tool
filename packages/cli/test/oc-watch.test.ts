import { afterEach, describe, expect, test } from "bun:test";
import { cac } from "cac";

import { registerOc } from "../src/commands/oc.ts";

const realFetch = globalThis.fetch;
const _realExitCode = process.exitCode;

afterEach(() => {
	globalThis.fetch = realFetch;
	process.exitCode = 0;
});

function captureLogs(): { lines: string[]; restore: () => void } {
	const lines: string[] = [];
	const info = console.info;
	const log = console.log;
	const error = console.error;
	const push = (...args: unknown[]) => void lines.push(args.join(" "));
	console.info = push;
	console.log = push;
	console.error = push;
	return {
		lines,
		restore: () => {
			console.info = info;
			console.log = log;
			console.error = error;
		},
	};
}

describe("registerOc watch", () => {
	test("a dead server exits non-zero naming the url", async () => {
		globalThis.fetch = (async () => {
			throw new TypeError("fetch failed");
		}) as unknown as typeof fetch;
		const logs = captureLogs();
		const cli = cac("jyz");
		registerOc(cli);
		try {
			cli.parse(["bun", "jyz", "oc", "watch", "--once", "--url", "http://127.0.0.1:4096"], {
				run: false,
			});
			const returned = cli.runMatchedCommand();
			if (returned instanceof Promise) await returned;
		} finally {
			logs.restore();
		}
		expect(process.exitCode).toBe(1);
		expect(logs.lines.join("\n")).toContain("http://127.0.0.1:4096");
	});

	test("watch --json --once emits one parseable frame", async () => {
		const body = `data: ${JSON.stringify({ type: "session.idle", data: { sessionID: "s1" } })}\n\n`;
		globalThis.fetch = (async () =>
			new Response(body, {
				status: 200,
				headers: { "content-type": "text/event-stream" },
			})) as unknown as typeof fetch;
		const logs = captureLogs();
		const cli = cac("jyz");
		registerOc(cli);
		try {
			cli.parse(
				["bun", "jyz", "oc", "watch", "--json", "--once", "--url", "http://127.0.0.1:4096"],
				{
					run: false,
				},
			);
			const returned = cli.runMatchedCommand();
			if (returned instanceof Promise) await returned;
		} finally {
			logs.restore();
		}
		expect(process.exitCode).toBe(0);
		expect(logs.lines).toHaveLength(1);
		expect(() => JSON.parse(logs.lines[0] ?? "")).not.toThrow();
	});

	test("--timeout exits 0 with no events on a silent stream", async () => {
		globalThis.fetch = (async () =>
			new Response(new ReadableStream({}), {
				status: 200,
				headers: { "content-type": "text/event-stream" },
			})) as unknown as typeof fetch;
		const logs = captureLogs();
		const cli = cac("jyz");
		registerOc(cli);
		try {
			cli.parse(
				[
					"bun",
					"jyz",
					"oc",
					"watch",
					"--json",
					"--timeout",
					"50",
					"--url",
					"http://127.0.0.1:4096",
				],
				{
					run: false,
				},
			);
			const returned = cli.runMatchedCommand();
			if (returned instanceof Promise) await returned;
		} finally {
			logs.restore();
		}
		expect(process.exitCode).toBe(0);
		expect(logs.lines).toEqual([]);
	});
});

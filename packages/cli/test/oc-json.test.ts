import { afterEach, describe, expect, test } from "bun:test";
import { cac } from "cac";

import { registerOc } from "../src/commands/oc.ts";

const realFetch = globalThis.fetch;
const realExitCode = process.exitCode;

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

function fakeFetch(handler: (request: Request) => Response): typeof fetch {
	return (async (input: string | URL | Request, init?: RequestInit) => {
		const request = input instanceof Request ? input : new Request(String(input), init);
		return handler(request);
	}) as typeof fetch;
}

describe("registerOc json", () => {
	test("oc sessions --json prints compact array", async () => {
		globalThis.fetch = fakeFetch(() =>
			Response.json({
				data: [
					{ id: "ses_a", title: "fix the parser", time: { updated: 1_700_000_000_000 } },
				],
				cursor: {},
			}),
		);
		const logs = captureLogs();
		const cli = cac("jyz");
		registerOc(cli);
		try {
			cli.parse(
				["bun", "jyz", "oc", "sessions", "--json", "--url", "http://127.0.0.1:4096"],
				{ run: false },
			);
			const returned = cli.runMatchedCommand();
			if (returned instanceof Promise) await returned;
		} finally {
			logs.restore();
		}
		expect(logs.lines).toEqual([
			JSON.stringify([
				{
					id: "ses_a",
					title: "fix the parser",
					updatedAt: new Date(1_700_000_000_000).toISOString(),
				},
			]),
		]);
	});

	test("oc prompt --json prints envelope", async () => {
		globalThis.fetch = fakeFetch(() => Response.json({ ok: true }));
		const logs = captureLogs();
		const cli = cac("jyz");
		registerOc(cli);
		try {
			cli.parse(["bun", "jyz", "oc", "prompt", "hi", "--json", "--session", "ses_a"], {
				run: false,
			});
			const returned = cli.runMatchedCommand();
			if (returned instanceof Promise) await returned;
		} finally {
			logs.restore();
		}
		expect(logs.lines).toEqual([JSON.stringify({ session: "ses_a", sent: true })]);
	});

	test("failing request leaves no partial json on stdout", async () => {
		globalThis.fetch = fakeFetch(() => new Response("boom", { status: 503 }));
		const logs = captureLogs();
		const cli = cac("jyz");
		registerOc(cli);
		try {
			cli.parse(["bun", "jyz", "oc", "sessions", "--json"], { run: false });
			const returned = cli.runMatchedCommand();
			if (returned instanceof Promise) await returned;
		} finally {
			logs.restore();
		}
		expect(process.exitCode).toBe(1);
		for (const line of logs.lines) {
			expect(() => JSON.parse(line)).toThrow();
		}
	});
});

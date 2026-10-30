import { afterEach, describe, expect, test } from "bun:test";
import { cac } from "cac";

import { registerConfig } from "../src/commands/config.ts";
import { registerOc } from "../src/commands/oc.ts";

const realFetch = globalThis.fetch;
const realExitCode = process.exitCode;

afterEach(() => {
	globalThis.fetch = realFetch;
	// Never restore a non-zero exit code: bun exits 1 when process.exitCode stays set, even with
	// every test passing, so the capture above cannot be trusted as the baseline.
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

describe("registerOc", () => {
	test("registers both oc subcommands", () => {
		const cli = cac("jyz");
		registerOc(cli);

		const names = cli.commands.map((command) => command.name);

		expect(names).toContain("oc");
		expect(names).toHaveLength(1);
	});

	test("oc commands stay out of the help body", () => {
		const cli = cac("jyz");
		registerConfig(cli);
		registerOc(cli);

		const printed: string[] = [];
		const original = console.info;
		console.info = (...args: unknown[]) => void printed.push(args.join(" "));
		try {
			cli.outputHelp();
		} finally {
			console.info = original;
		}

		const help = printed.join("\n");
		expect(help).not.toContain("oc sessions");
		expect(help).not.toContain("oc prompt");
		expect(help).toContain("config");
	});

	test("oc sessions prints the mapped fixtures", async () => {
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
			cli.parse(["bun", "jyz", "oc", "sessions", "--url", "http://127.0.0.1:4096"], {
				run: false,
			});
			const returned = cli.runMatchedCommand();
			if (returned instanceof Promise) await returned;
		} finally {
			logs.restore();
		}

		expect(logs.lines).toEqual([
			`ses_a  fix the parser  ${new Date(1_700_000_000_000).toISOString()}`,
		]);
	});

	test("oc prompt posts the joined text and reports the session", async () => {
		let path = "";
		globalThis.fetch = fakeFetch((request) => {
			path = new URL(request.url).pathname;
			return Response.json({ ok: true });
		});
		const logs = captureLogs();
		const cli = cac("jyz");
		registerOc(cli);
		try {
			cli.parse(["bun", "jyz", "oc", "prompt", "hello", "there", "--session", "ses_a"], {
				run: false,
			});
			const returned = cli.runMatchedCommand();
			if (returned instanceof Promise) await returned;
		} finally {
			logs.restore();
		}

		expect(path).toBe("/api/session/ses_a/prompt");
		expect(logs.lines).toEqual(["sent to ses_a"]);
	});

	test("oc prompt without a session prints the error and exits non-zero", async () => {
		const logs = captureLogs();
		const cli = cac("jyz");
		registerOc(cli);
		try {
			cli.parse(["bun", "jyz", "oc", "prompt", "hi"], { run: false });
			const returned = cli.runMatchedCommand();
			if (returned instanceof Promise) await returned;
		} finally {
			logs.restore();
		}

		expect(process.exitCode).toBe(1);
		expect(logs.lines.join("\n")).toContain("--session <id> is required");
	});

	test("a server failure prints the status and exits non-zero", async () => {
		globalThis.fetch = fakeFetch(() => new Response("boom", { status: 503 }));
		const logs = captureLogs();
		const cli = cac("jyz");
		registerOc(cli);
		try {
			const returned = (() => {
				cli.parse(["bun", "jyz", "oc", "sessions"], { run: false });
				return cli.runMatchedCommand();
			})();
			if (returned instanceof Promise) await returned;
		} finally {
			logs.restore();
		}

		expect(process.exitCode).toBe(1);
		expect(logs.lines.join("\n")).toContain("503");
	});
});

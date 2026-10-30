import { afterEach, describe, expect, test } from "bun:test";

import {
	DEFAULT_OPENCODE_URL,
	listSessions,
	OpencodeError,
	resolveServer,
	sendPrompt,
} from "../src/funcs/opencode.ts";

type FakeServer = ReturnType<typeof Bun.serve>;

let servers: FakeServer[] = [];

/** A throwaway HTTP server on an ephemeral port; the fetcher under test points at it. */
function serve(handler: (request: Request) => Response | Promise<Response>): string {
	const server = Bun.serve({ port: 0, hostname: "127.0.0.1", fetch: handler });
	servers.push(server);
	return `http://127.0.0.1:${server.port}`;
}

afterEach(() => {
	for (const server of servers) server.stop(true);
	servers = [];
});

const SESSIONS = [
	{ id: "ses_a", title: "fix the parser", time: { updated: 1_700_000_000_000 }, extra: true },
	{ id: "ses_b", title: "write the docs", time: { updated: 1_700_000_100_000 } },
];

describe("resolveServer", () => {
	test("defaults to the stock local address with no token", () => {
		expect(resolveServer({ env: {} })).toEqual({
			baseUrl: DEFAULT_OPENCODE_URL,
			source: "default",
		});
	});

	test("reads the url and token from the environment", () => {
		expect(
			resolveServer({
				env: { JYZ_OPENCODE_URL: "http://10.0.0.2:5000", JYZ_OPENCODE_TOKEN: "tok" },
			}),
		).toEqual({ baseUrl: "http://10.0.0.2:5000", token: "tok", source: "env" });
	});

	test("a flag beats the environment", () => {
		expect(
			resolveServer({
				url: "http://127.0.0.1:9000",
				env: { JYZ_OPENCODE_URL: "http://10.0.0.2:5000", JYZ_OPENCODE_TOKEN: "tok" },
			}),
		).toEqual({ baseUrl: "http://127.0.0.1:9000", token: "tok", source: "flag" });
	});

	test("a blank flag falls through to the environment", () => {
		expect(
			resolveServer({ url: "   ", env: { JYZ_OPENCODE_URL: "http://10.0.0.2:5000" } }),
		).toEqual({ baseUrl: "http://10.0.0.2:5000", source: "env" });
	});

	test("a blank environment value falls through to the default", () => {
		expect(resolveServer({ env: { JYZ_OPENCODE_URL: "  " } })).toEqual({
			baseUrl: DEFAULT_OPENCODE_URL,
			source: "default",
		});
	});

	test("strips a trailing slash so paths never double up", () => {
		expect(resolveServer({ url: "http://127.0.0.1:4096/" }).baseUrl).toBe(
			"http://127.0.0.1:4096",
		);
	});
});

describe("listSessions", () => {
	test("maps a session array through the fixture shape", async () => {
		const seen: string[] = [];
		const baseUrl = serve((request) => {
			seen.push(new URL(request.url).pathname);
			return Response.json({ data: SESSIONS, cursor: {} });
		});

		const sessions = await listSessions(baseUrl);

		expect(seen).toEqual(["/api/session"]);
		expect(sessions).toEqual([
			{
				id: "ses_a",
				title: "fix the parser",
				updatedAt: new Date(1_700_000_000_000).toISOString(),
			},
			{
				id: "ses_b",
				title: "write the docs",
				updatedAt: new Date(1_700_000_100_000).toISOString(),
			},
		]);
	});

	test("falls back to the id when a session has no title", async () => {
		const baseUrl = serve(() => Response.json({ data: [{ id: "ses_c" }], cursor: {} }));

		expect(await listSessions(baseUrl)).toEqual([
			{ id: "ses_c", title: "ses_c", updatedAt: "" },
		]);
	});

	test("sends the resolved token as a bearer header", async () => {
		let authorization: string | null = null;
		const baseUrl = serve((request) => {
			authorization = request.headers.get("authorization");
			return Response.json({ data: [], cursor: {} });
		});

		await listSessions(baseUrl, fetch, { token: "tok" });

		expect(authorization ?? "").toBe("Bearer tok");
	});

	test("a 500 throws OpencodeError carrying the status and url", async () => {
		const baseUrl = serve(() => new Response("boom", { status: 500 }));

		let caught: unknown;
		try {
			await listSessions(baseUrl);
		} catch (error) {
			caught = error;
		}

		expect(caught).toBeInstanceOf(OpencodeError);
		expect((caught as OpencodeError).status).toBe(500);
		expect((caught as OpencodeError).url).toBe(`${baseUrl}/api/session`);
		expect((caught as OpencodeError).message).toContain("500");
	});

	test("a non-array body is a payload error, not a crash", async () => {
		const baseUrl = serve(() => Response.json({ sessions: [] }));

		expect(listSessions(baseUrl)).rejects.toBeInstanceOf(OpencodeError);
	});

	test("an unreachable server throws OpencodeError with no status", async () => {
		const fetcher = (() =>
			Promise.reject(new Error("connection refused"))) as unknown as typeof fetch;

		let caught: unknown;
		try {
			await listSessions("http://127.0.0.1:1", fetcher);
		} catch (error) {
			caught = error;
		}

		expect(caught).toBeInstanceOf(OpencodeError);
		expect((caught as OpencodeError).status).toBeUndefined();
		expect((caught as OpencodeError).message).toContain("connection refused");
	});
});

describe("sendPrompt", () => {
	test("posts one text part as JSON to the session message endpoint", async () => {
		let method = "";
		let path = "";
		let contentType: string | null = null;
		let body = "";
		const baseUrl = serve(async (request) => {
			method = request.method;
			path = new URL(request.url).pathname;
			contentType = request.headers.get("content-type");
			body = await request.text();
			return Response.json({ ok: true });
		});

		const result = await sendPrompt(baseUrl, "ses_a", "hello world");

		expect(result).toEqual({ ok: true });
		expect(method).toBe("POST");
		expect(path).toBe("/api/session/ses_a/prompt");
		expect(contentType ?? "").toBe("application/json");
		expect(JSON.parse(body)).toEqual({ text: "hello world" });
	});

	test("encodes a session id that carries a slash", async () => {
		let path = "";
		const baseUrl = serve((request) => {
			path = new URL(request.url).pathname;
			return new Response(JSON.stringify({}), {
				status: 200,
				headers: { "content-type": "application/json" },
			});
		});

		await sendPrompt(baseUrl, "a/b", "hi");

		expect(path).toBe("/api/session/a%2Fb/prompt");
	});

	test("a rejected prompt throws OpencodeError with the status", async () => {
		const baseUrl = serve(() => new Response("nope", { status: 404 }));

		let caught: unknown;
		try {
			await sendPrompt(baseUrl, "ses_missing", "hi");
		} catch (error) {
			caught = error;
		}

		expect(caught).toBeInstanceOf(OpencodeError);
		expect((caught as OpencodeError).status).toBe(404);
	});
});

import { afterEach, describe, expect, test } from "bun:test";

import { listSessions, OpencodeError } from "../src/funcs/opencode/index.ts";

type FakeServer = ReturnType<typeof Bun.serve>;

let servers: FakeServer[] = [];

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

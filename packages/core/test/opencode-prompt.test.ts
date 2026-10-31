import { afterEach, describe, expect, test } from "bun:test";

import { OpencodeError, sendPrompt } from "../src/funcs/opencode/index.ts";

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

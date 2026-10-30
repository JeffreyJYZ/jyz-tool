import { describe, expect, test } from "bun:test";

import { headersFor, listSessions, OpencodeError, sendPrompt } from "../src/funcs/opencode.ts";

describe("opencode sdk seam", () => {
	test("maps time.updated epoch milliseconds to an ISO string", async () => {
		const baseUrl = "http://example.test";
		const fetcher = (async () =>
			new Response(
				JSON.stringify({ data: [{ id: "s1", time: { updated: 1_700_000_000_000 } }] }),
				{
					status: 200,
					headers: { "content-type": "application/json" },
				},
			)) as unknown as typeof fetch;

		const sessions = await listSessions(baseUrl, fetcher);

		expect(sessions).toEqual([
			{ id: "s1", title: "s1", updatedAt: new Date(1_700_000_000_000).toISOString() },
		]);
	});

	test("a session with no title falls back to its id", async () => {
		const baseUrl = "http://example.test";
		const fetcher = (async () =>
			new Response(
				JSON.stringify({ data: [{ id: "ses_c", time: { updated: 1_700_000_000_000 } }] }),
				{
					status: 200,
					headers: { "content-type": "application/json" },
				},
			)) as unknown as typeof fetch;

		const sessions = await listSessions(baseUrl, fetcher);

		expect(sessions[0]?.title).toBe("ses_c");
	});

	test("the token rides as an authorization header", async () => {
		const baseUrl = "http://example.test";
		let captured: { headers?: RequestInit["headers"] } | undefined;
		const fetcher = (async (_input: unknown, init?: RequestInit) => {
			captured = { headers: init?.headers };
			return new Response(JSON.stringify({ data: [] }), {
				status: 200,
				headers: { "content-type": "application/json" },
			});
		}) as unknown as typeof fetch;

		await listSessions(baseUrl, fetcher, { token: "tok" });

		const headers = new Headers(captured?.headers as RequestInit["headers"]);
		expect(headers.get("authorization")).toBe("Bearer tok");
	});

	test("a 500 response becomes an OpencodeError with status 500", async () => {
		const baseUrl = "http://example.test";
		const fetcher = (async () =>
			new Response("boom", { status: 500 })) as unknown as typeof fetch;

		let caught: unknown;
		try {
			await listSessions(baseUrl, fetcher);
		} catch (error) {
			caught = error;
		}

		expect(caught).toBeInstanceOf(OpencodeError);
		expect((caught as OpencodeError).status).toBe(500);
		expect((caught as OpencodeError).url).toBe(`${baseUrl}/api/session`);
	});

	test("a non-array payload is a payload error, not a crash", async () => {
		const baseUrl = "http://example.test";
		const fetcher = (async () =>
			new Response(JSON.stringify({ data: null }), {
				status: 200,
				headers: { "content-type": "application/json" },
			})) as unknown as typeof fetch;

		await expect(listSessions(baseUrl, fetcher)).rejects.toBeInstanceOf(OpencodeError);
	});

	test("a throwing fetcher yields an OpencodeError naming the base url", async () => {
		const baseUrl = "http://example.test";
		const fetcher = (async () => {
			throw new Error("ECONNREFUSED");
		}) as unknown as typeof fetch;

		let caught: unknown;
		try {
			await listSessions(baseUrl, fetcher);
		} catch (error) {
			caught = error;
		}

		expect(caught).toBeInstanceOf(OpencodeError);
		expect((caught as OpencodeError).message).toContain(baseUrl);
	});

	test("sendPrompt sends the flat body and returns ok", async () => {
		const baseUrl = "http://example.test";
		let body = "";
		const fetcher = (async (_input: unknown, init?: RequestInit) => {
			body = typeof init?.body === "string" ? init.body : "";
			return new Response(JSON.stringify({}), {
				status: 200,
				headers: { "content-type": "application/json" },
			});
		}) as unknown as typeof fetch;

		const result = await sendPrompt(baseUrl, "ses_a", "hello", fetcher);

		expect(result).toEqual({ ok: true });
		expect(JSON.parse(body)).toEqual({ text: "hello" });
	});

	test("a service password rides as HTTP Basic on the SDK request", async () => {
		const baseUrl = "http://example.test";
		let captured: { headers?: RequestInit["headers"] } | undefined;
		const fetcher = (async (_input: unknown, init?: RequestInit) => {
			captured = { headers: init?.headers };
			return new Response(JSON.stringify({ data: [] }), {
				status: 200,
				headers: { "content-type": "application/json" },
			});
		}) as unknown as typeof fetch;

		await listSessions(baseUrl, fetcher, { password: "secret" });

		const headers = new Headers(captured?.headers as RequestInit["headers"]);
		expect(headers.get("authorization")).toBe(`Basic ${btoa("opencode:secret")}`);
	});

	test("headersFor prefers a bearer token over a password", () => {
		expect(headersFor({ token: "tok", password: "secret" })).toEqual({
			authorization: "Bearer tok",
		});
	});
});

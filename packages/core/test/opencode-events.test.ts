import { afterEach, describe, expect, test } from "bun:test";

import { subscribeEvents } from "../src/funcs/opencode.ts";

describe("opencode events", () => {
	test("yields mapped frames and filters by sessionID", async () => {
		const events = [
			{ type: "session.text.delta", data: { sessionID: "s1", delta: "hello" } },
			{ type: "session.text.delta", data: { sessionID: "s2", delta: "world!!" } },
			{ type: "session.idle", data: { sessionID: "s1" } },
		];
		const body = events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join("");
		const fetcher = async () =>
			new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } });
		const collected: Array<{ type: string; sessionID: string | null; summary: string }> = [];
		for await (const ev of subscribeEvents({
			baseUrl: "http://x",
			fetch: fetcher as unknown as typeof fetch,
			sessionID: "s1",
		})) {
			collected.push(ev);
		}
		expect(collected).toHaveLength(2);
		expect(collected[0]!.summary).toBe("text delta: 5 chars");
		expect(collected[1]!.summary).toBe("idle");
	});

	test("stops on abort", async () => {
		const controller = new AbortController();
		const body = new ReadableStream({
			start(c) {
				c.enqueue(
					new TextEncoder().encode(
						`data: ${JSON.stringify({ type: "session.idle", data: { sessionID: "s1" } })}\n\n`,
					),
				);
				setTimeout(() => controller.abort(), 10);
			},
		});
		const fetcher = async () =>
			new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } });
		const collected: unknown[] = [];
		try {
			for await (const ev of subscribeEvents({
				baseUrl: "http://x",
				fetch: fetcher as unknown as typeof fetch,
				signal: controller.signal,
			})) {
				collected.push(ev);
			}
		} catch {
			// abort may throw
		}
		expect(collected.length).toBeLessThanOrEqual(1);
	});
});

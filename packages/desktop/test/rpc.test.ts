import { describe, expect, test } from "bun:test";
import { decodeFrame, encodeFrame, splitFrames } from "../src/rpc.ts";

describe("rpc framing", () => {
	test("encodeFrame adds a trailing newline", () => {
		const frame = encodeFrame({ jsonrpc: "2.0", id: 1, method: "ping" });
		expect(frame.endsWith("\n")).toBe(true);
		expect(frame).toBe('{"jsonrpc":"2.0","id":1,"method":"ping"}\n');
	});

	test("decodeFrame parses a request", () => {
		const msg = decodeFrame('{"jsonrpc":"2.0","id":2,"method":"echo","params":{"x":3}}');
		expect(msg).toEqual({ jsonrpc: "2.0", id: 2, method: "echo", params: { x: 3 } });
	});

	test("decodeFrame parses a response", () => {
		const msg = decodeFrame('{"jsonrpc":"2.0","id":2,"result":7}');
		expect(msg).toEqual({ jsonrpc: "2.0", id: 2, result: 7 });
	});

	test("decodeFrame rejects a frame without jsonrpc 2.0", () => {
		expect(() => decodeFrame('{"id":1,"method":"ping"}')).toThrow();
	});

	test("splitFrames returns complete messages and a partial tail", () => {
		const buf =
			'{"jsonrpc":"2.0","id":1,"method":"a"}\n{"jsonrpc":"2.0","id":2,"result":5}\n{"jsonrpc":"2.0"';
		const { messages, rest } = splitFrames(buf);
		expect(messages).toHaveLength(2);
		expect(rest).toBe('{"jsonrpc":"2.0"');
	});

	test("splitFrames ignores blank lines", () => {
		const buf = '\n{"jsonrpc":"2.0","id":1,"method":"a"}\n\n';
		const { messages, rest } = splitFrames(buf);
		expect(messages).toHaveLength(1);
		expect(rest).toBe("");
	});

	test("round-trip encode then split", () => {
		const a = encodeFrame({ jsonrpc: "2.0", id: 1, method: "ping" });
		const b = encodeFrame({ jsonrpc: "2.0", id: 2, result: "pong" });
		const { messages } = splitFrames(a + b);
		expect(messages).toHaveLength(2);
	});
});

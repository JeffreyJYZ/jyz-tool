import { expect, test } from "bun:test";
import { listenUpdateCheck, unwrapResult } from "../src/events.ts";

test("an Ok payload yields the offer", () => {
	const offer = { current: "0.1.0", version: "0.1.1", notes: null };
	expect(unwrapResult({ Ok: offer })).toEqual({ offer });
});

test("an Ok null means no update", () => {
	expect(unwrapResult({ Ok: null })).toEqual({ offer: null });
});

test("an Err payload becomes an error string", () => {
	expect(unwrapResult({ Err: "network down" })).toEqual({ error: "network down" });
});

test("a bare payload passes through", () => {
	expect(unwrapResult(null)).toEqual({ offer: null });
});

test("no internals means no subscription", () => {
	expect(listenUpdateCheck(() => {})).toBeNull();
});

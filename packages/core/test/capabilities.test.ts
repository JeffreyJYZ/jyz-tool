import { expect, test } from "bun:test";
import { listCapabilities } from "../src/funcs/capabilities.ts";

/**
 * Registration order is part of the contract: two surfaces reading the same manifest must list the
 * same capabilities in the same order, so a diff between them is never noise.
 */
const EXPECTED_NAMES = [
	"config",
	"create",
	"install",
	"add",
	"remove",
	"run",
	"exec",
	"update",
	"outdated",
	"lint",
	"typecheck",
	"check",
	"fmt",
];

test("the capability list is non-empty and covers every dispatch verb", () => {
	const capabilities = listCapabilities();
	expect(capabilities.length).toBeGreaterThan(0);
	const dispatch = capabilities.filter((capability) => capability.kind === "dispatch");
	expect(dispatch.map((capability) => capability.name)).toEqual([
		"install",
		"add",
		"remove",
		"run",
		"exec",
		"update",
		"outdated",
	]);
});

test("the order is fixed and every name is unique", () => {
	const first = listCapabilities();
	expect(first.map((capability) => capability.name)).toEqual(EXPECTED_NAMES);
	expect(listCapabilities()).toEqual(first);
	expect(new Set(first.map((capability) => capability.name)).size).toBe(first.length);
});

test("every capability is well formed", () => {
	for (const capability of listCapabilities()) {
		expect(capability.name).not.toBe("");
		expect(["dispatch", "config", "create", "toolchain"]).toContain(capability.kind);
		for (const param of capability.params) expect(typeof param).toBe("string");
	}
});

test("a returned list is a copy, so a caller cannot rewrite the manifest", () => {
	const first = listCapabilities();
	const second = listCapabilities();
	const [head] = first;
	expect(head).toBeDefined();
	if (head !== undefined) {
		head.name = "tampered";
		head.params.push("tampered");
	}
	expect(second[0]?.name).toBe("config");
	expect(second[0]?.params).toEqual(["action", "key", "value"]);
	expect(listCapabilities()).toEqual(second);
});

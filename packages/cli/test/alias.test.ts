import { expect, test } from "bun:test";
import { AliasError, assertAliases, expandAlias, formatAliases } from "../src/lib/verbs.ts";

test("an alias replaces the first token and keeps the rest", () => {
	expect(expandAlias(["a", "typescript"], { a: "add" })).toEqual(["add", "typescript"]);
});

test("an alias can expand to a verb plus arguments", () => {
	expect(expandAlias(["dev", "--watch"], { dev: "run dev" })).toEqual(["run", "dev", "--watch"]);
});

test("chained aliases resolve to the verb", () => {
	expect(expandAlias(["i"], { i: "install", ins: "install" })).toEqual(["install"]);
	expect(expandAlias(["a"], { a: "b", b: "install" })).toEqual(["install"]);
});

test("a recursive alias is refused by name", () => {
	expect(() => expandAlias(["a"], { a: "b", b: "a" })).toThrow(/alias "a"/);
});

test("an alias that expands to nothing is refused", () => {
	expect(() => expandAlias(["e"], { e: "   " })).toThrow(/alias "e"/);
});

test("an unknown first token is left alone", () => {
	expect(expandAlias(["test", "--run"], { a: "add" })).toEqual(["test", "--run"]);
	expect(expandAlias([], { a: "add" })).toEqual([]);
});

test("an alias shadowing a core verb fails and names the alias", () => {
	expect(() => assertAliases({ install: "i" })).toThrow(AliasError);
	try {
		assertAliases({ lint: "run lint" });
		throw new Error("expected a refusal");
	} catch (error) {
		expect(error).toBeInstanceOf(AliasError);
		expect((error as AliasError).alias).toBe("lint");
		expect((error as Error).message).toContain('"lint"');
	}
});

test("a clean alias table passes validation", () => {
	expect(() => assertAliases({ a: "add", i: "install", r: "run", dev: "run dev" })).not.toThrow();
});

test("aliases print under their own help section", () => {
	expect(formatAliases({ r: "run", a: "add" })).toBe("  a -> add\n  r -> run");
	expect(formatAliases({})).toBe("");
});

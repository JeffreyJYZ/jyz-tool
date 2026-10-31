import { expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { countLines, findViolations } from "../check-file-size.ts";

test("countLines: empty string", () => {
	expect(countLines("")).toBe(0);
});

test("countLines: one-liner", () => {
	expect(countLines("hello")).toBe(1);
});

test("countLines: trailing newline", () => {
	expect(countLines("hello\n")).toBe(1);
});

test("countLines: CRLF", () => {
	expect(countLines("a\r\nb\r\n")).toBe(2);
});

test("findViolations: clean temp dir", () => {
	const root = join(tmpdir(), `cfs-clean-${Math.random().toString(36).slice(2)}`);
	mkdirSync(join(root, "scripts"), { recursive: true });
	try {
		expect(findViolations(root, [])).toEqual([]);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("findViolations: new 201-line file", () => {
	const root = join(tmpdir(), `cfs-new-${Math.random().toString(36).slice(2)}`);
	mkdirSync(join(root, "scripts"), { recursive: true });
	const file = join(root, "scripts", "big.ts");
	writeFileSync(file, `${Array(201).fill("x").join("\n")}\n`);
	try {
		const v = findViolations(root, []);
		expect(v.length).toBe(1);
		expect(v[0]?.file).toBe(join("scripts", "big.ts"));
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("findViolations: listed file shrunk below limit", () => {
	const root = join(tmpdir(), `cfs-shrink-${Math.random().toString(36).slice(2)}`);
	mkdirSync(join(root, "scripts"), { recursive: true });
	const file = join(root, "scripts", "small.ts");
	writeFileSync(file, "x\n");
	try {
		const v = findViolations(root, ["scripts/small.ts"]);
		expect(v.length).toBe(1);
		expect(v[0]?.kind).toBe("stale");
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

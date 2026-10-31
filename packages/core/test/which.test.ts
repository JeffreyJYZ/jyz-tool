import { expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { resolveCommand, which } from "../src/funcs/which.ts";

function dir(): string {
	return mkdtempSync(join(tmpdir(), "jyz-which-"));
}

test("finds an executable on PATH", () => {
	const root = dir();
	try {
		writeFileSync(join(root, "tool"), "#!/bin/sh\n");
		expect(which("tool", root, "darwin")).toBe(join(root, "tool"));
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("searches every PATH entry", () => {
	const first = dir();
	const second = dir();
	try {
		writeFileSync(join(second, "tool"), "#!/bin/sh\n");
		expect(which("tool", `${first}${delimiter}${second}`, "darwin")).toBe(join(second, "tool"));
	} finally {
		rmSync(first, { recursive: true, force: true });
		rmSync(second, { recursive: true, force: true });
	}
});

test("a missing command is null, not an error", () => {
	const root = dir();
	try {
		expect(which("nope", root, "darwin")).toBeNull();
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("windows finds the .cmd shim behind a bare name", () => {
	const root = dir();
	const saved = process.env.PATHEXT;
	try {
		process.env.PATHEXT = ".COM;.EXE;.BAT;.CMD";
		writeFileSync(join(root, "tool.cmd"), "@echo off\r\n");
		expect(which("tool", root, "win32")).toBe(join(root, "tool.cmd"));
	} finally {
		if (saved === undefined) delete process.env.PATHEXT;
		else process.env.PATHEXT = saved;
		rmSync(root, { recursive: true, force: true });
	}
});

test("resolveCommand leaves a name alone when PATH has no match", () => {
	expect(resolveCommand("definitely-not-installed-xyz")).toBe("definitely-not-installed-xyz");
});

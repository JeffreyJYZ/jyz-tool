import { expect, test } from "bun:test";
import {
	buildScriptSpec,
	formatScripts,
	mergeScripts,
	readPackageScripts,
	splitCommand,
} from "../src/lib/scripts.ts";

test("a config script wins over the manifest script of the same name", () => {
	const entries = mergeScripts(
		{ e2e: "bun test --timeout 60000" },
		{ e2e: "playwright test", build: "bun build src/bin.ts" },
	);
	expect(entries).toEqual([
		{ name: "build", command: "bun build src/bin.ts", source: "package.json" },
		{ name: "e2e", command: "bun test --timeout 60000", source: "config" },
	]);
});

test("scripts split into argv without a shell", () => {
	expect(splitCommand("bun test --timeout 60000")).toEqual(["bun", "test", "--timeout", "60000"]);
	expect(splitCommand(`echo "two words" 'and one'`)).toEqual(["echo", "two words", "and one"]);
	expect(splitCommand("   ")).toEqual([]);
	expect(splitCommand("")).toEqual([]);
});

test("a config script runs its own argv and keeps extra arguments", () => {
	const spec = buildScriptSpec("bun", "/tmp/pkg", "e2e", { e2e: "bun test --timeout 60000" }, [
		"--bail",
	]);
	expect(spec).toEqual({
		file: "bun",
		argv: ["test", "--timeout", "60000", "--bail"],
		cwd: "/tmp/pkg",
	});
});

test("a manifest script delegates to the package manager", () => {
	expect(buildScriptSpec("bun", "/tmp/pkg", "build", {}, [])).toEqual({
		file: "bun",
		argv: ["run", "build"],
		cwd: "/tmp/pkg",
	});
	expect(buildScriptSpec("pnpm", "/tmp/pkg", "build", {}, ["--watch"])).toEqual({
		file: "pnpm",
		argv: ["run", "build", "--watch"],
		cwd: "/tmp/pkg",
	});
});

test("an empty config script is refused by name", () => {
	expect(() => buildScriptSpec("bun", "/tmp/pkg", "blank", { blank: "   " })).toThrow(/blank/);
});

test("the listing aligns one script per line", () => {
	const entries = mergeScripts({}, { build: "bun build", test: "bun test" });
	expect(formatScripts(entries)).toBe("build  bun build\ntest   bun test");
});

test("a package without scripts reads as an empty table", () => {
	expect(readPackageScripts("/definitely/not/a/package")).toEqual({});
});

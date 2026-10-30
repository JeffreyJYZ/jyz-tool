import { expect, test } from "bun:test";
import { buildArgv } from "../src/funcs/argv.ts";

test("install", () => {
	expect(buildArgv("bun", { verb: "install", args: ["react"] })).toEqual(["install", "react"]);
	expect(buildArgv("pnpm", { verb: "install", args: [] })).toEqual(["install"]);
});

test("add dev flag", () => {
	expect(buildArgv("bun", { verb: "add", args: ["zod"], dev: true })).toEqual([
		"add",
		"-d",
		"zod",
	]);
	expect(buildArgv("pnpm", { verb: "add", args: ["zod"], dev: true })).toEqual([
		"add",
		"-D",
		"zod",
	]);
	expect(buildArgv("bun", { verb: "add", args: ["zod"] })).toEqual(["add", "zod"]);
});

test("remove/run/outdated", () => {
	expect(buildArgv("bun", { verb: "remove", args: ["x"] })).toEqual(["remove", "x"]);
	expect(buildArgv("pnpm", { verb: "run", args: ["dev"] })).toEqual(["run", "dev"]);
	expect(buildArgv("bun", { verb: "outdated", args: [] })).toEqual(["outdated"]);
});

test("exec", () => {
	expect(buildArgv("bun", { verb: "exec", args: ["tsc"] })).toEqual(["bunx", "tsc"]);
	expect(buildArgv("pnpm", { verb: "exec", args: ["tsc"] })).toEqual(["exec", "tsc"]);
});

test("update latest", () => {
	expect(buildArgv("bun", { verb: "update", args: ["pkg"], latest: true })).toEqual([
		"update",
		"--latest",
		"pkg",
	]);
	expect(buildArgv("pnpm", { verb: "update", args: ["pkg"] })).toEqual(["update", "pkg"]);
});

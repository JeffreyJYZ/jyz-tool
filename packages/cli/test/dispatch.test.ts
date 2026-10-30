import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { PackageManager } from "@jyz/core";
import { resolveProject } from "@jyz/core";
import { buildDispatchSpec } from "../src/lib/dispatch.ts";
import { fakeContext } from "./fixtures.ts";

interface Case {
	pm: PackageManager;
	verb: "install" | "add" | "remove" | "run" | "exec" | "update" | "outdated";
	args: string[];
	dev?: boolean;
	latest?: boolean;
	file: string;
	argv: string[];
}

const CASES: Case[] = [
	{ pm: "bun", verb: "install", args: [], file: "bun", argv: ["install"] },
	{ pm: "pnpm", verb: "install", args: [], file: "pnpm", argv: ["install"] },
	{
		pm: "bun",
		verb: "install",
		args: ["--frozen-lockfile"],
		file: "bun",
		argv: ["install", "--frozen-lockfile"],
	},
	{
		pm: "bun",
		verb: "add",
		args: ["typescript"],
		dev: true,
		file: "bun",
		argv: ["add", "-d", "typescript"],
	},
	{
		pm: "pnpm",
		verb: "add",
		args: ["typescript"],
		dev: true,
		file: "pnpm",
		argv: ["add", "-D", "typescript"],
	},
	{ pm: "bun", verb: "add", args: ["react"], file: "bun", argv: ["add", "react"] },
	{ pm: "bun", verb: "remove", args: ["react"], file: "bun", argv: ["remove", "react"] },
	{ pm: "pnpm", verb: "remove", args: ["react"], file: "pnpm", argv: ["remove", "react"] },
	{
		pm: "bun",
		verb: "run",
		args: ["build", "--watch"],
		file: "bun",
		argv: ["run", "build", "--watch"],
	},
	{ pm: "pnpm", verb: "run", args: ["build"], file: "pnpm", argv: ["run", "build"] },
	{ pm: "bun", verb: "exec", args: ["tsc", "--noEmit"], file: "bunx", argv: ["tsc", "--noEmit"] },
	{
		pm: "pnpm",
		verb: "exec",
		args: ["tsc", "--noEmit"],
		file: "pnpm",
		argv: ["exec", "tsc", "--noEmit"],
	},
	{
		pm: "bun",
		verb: "update",
		args: ["react"],
		latest: true,
		file: "bun",
		argv: ["update", "--latest", "react"],
	},
	{ pm: "pnpm", verb: "update", args: [], file: "pnpm", argv: ["update"] },
	{ pm: "bun", verb: "outdated", args: [], file: "bun", argv: ["outdated"] },
	{ pm: "pnpm", verb: "outdated", args: [], file: "pnpm", argv: ["outdated"] },
];

test("every verb produces the documented argv", () => {
	for (const entry of CASES) {
		const ctx = fakeContext(entry.pm, "/tmp/jyz-fixture");
		const spec = buildDispatchSpec(ctx, {
			verb: entry.verb,
			args: entry.args,
			dev: entry.dev,
			latest: entry.latest,
		});
		expect({ verb: entry.verb, pm: entry.pm, file: spec.file, argv: spec.argv }).toEqual({
			verb: entry.verb,
			pm: entry.pm,
			file: entry.file,
			argv: entry.argv,
		});
		expect(spec.cwd).toBe("/tmp/jyz-fixture");
	}
});

test("exec prefers a real node_modules/.bin entry", () => {
	const dir = mkdtempSync(join(tmpdir(), "jyz-exec-"));
	writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "exec-fixture" }));
	writeFileSync(join(dir, "bun.lock"), "");
	const bin = join(dir, "node_modules", ".bin", "fake");
	mkdirSync(join(dir, "node_modules", ".bin"), { recursive: true });
	writeFileSync(bin, "#!/bin/sh\n");
	const ctx = resolveProject(dir);
	const spec = buildDispatchSpec(ctx, { verb: "exec", args: ["fake", "--flag"] });
	expect(spec.file).toBe(bin);
	expect(spec.argv).toEqual(["--flag"]);
	expect(spec.cwd).toBe(dir);
});

test("exec falls back to the package manager runner when .bin is empty", () => {
	const dir = mkdtempSync(join(tmpdir(), "jyz-exec-"));
	writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "exec-fixture" }));
	writeFileSync(join(dir, "bun.lock"), "");
	const ctx = resolveProject(dir);
	const spec = buildDispatchSpec(ctx, { verb: "exec", args: ["missing-bin"] });
	expect(spec.file).toBe("bunx");
	expect(spec.argv).toEqual(["missing-bin"]);
});

test("the package manager comes from the fixture project, not a guess", () => {
	const dir = mkdtempSync(join(tmpdir(), "jyz-pnpm-"));
	writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "pnpm-fixture" }));
	writeFileSync(join(dir, "pnpm-lock.yaml"), "");
	const ctx = resolveProject(dir);
	expect(ctx.config.project.package_manager.value).toBe("pnpm");
	expect(ctx.config.project.package_manager.source).toBe("detected");
	const spec = buildDispatchSpec(ctx, { verb: "install", args: [] });
	expect(spec.file).toBe("pnpm");
	expect(spec.argv).toEqual(["install"]);
});

test("a filter moves the spec into the named member", () => {
	const root = mkdtempSync(join(tmpdir(), "jyz-mono-"));
	mkdirSync(join(root, ".git"));
	writeFileSync(join(root, "package.json"), JSON.stringify({ name: "root" }));
	mkdirSync(join(root, "packages", "app"), { recursive: true });
	writeFileSync(join(root, "packages", "app", "package.json"), JSON.stringify({ name: "app" }));
	const ctx = resolveProject(root, { filter: "app" });
	expect(ctx.packageDir).toBe(join(root, "packages", "app"));
	const spec = buildDispatchSpec(ctx, { verb: "run", args: ["build"] });
	expect(spec.file).toBe("bun");
	expect(spec.cwd).toBe(join(root, "packages", "app"));
});

import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildArgv } from "../src/funcs/argv.ts";
import { findConfigPath, loadConfig } from "../src/funcs/config.ts";
import { resolveProject } from "../src/funcs/project.ts";

test("resolveProject handles spaces", () => {
	const root = mkdtempSync(join(tmpdir(), "sp ace-"));
	mkdirSync(join(root, ".git"));
	const pkg = join(root, "my dir");
	mkdirSync(pkg, { recursive: true });
	writeFileSync(join(pkg, "package.json"), JSON.stringify({ name: "space-pkg" }));
	const ctx = resolveProject(pkg);
	expect(ctx.packageDir).toBe(pkg);
	expect(ctx.packageName).toBe("space-pkg");
});

test("resolveProject handles unicode", () => {
	const root = mkdtempSync(join(tmpdir(), "üni-"));
	mkdirSync(join(root, ".git"));
	const pkg = join(root, "πρότζεκτ");
	mkdirSync(pkg, { recursive: true });
	writeFileSync(join(pkg, "package.json"), JSON.stringify({ name: "unicode-pkg" }));
	const ctx = resolveProject(pkg);
	expect(ctx.packageDir).toBe(pkg);
});

test("findConfigPath handles spaces", () => {
	const root = mkdtempSync(join(tmpdir(), "sp ace-"));
	const cfg = join(root, "jyz.config.toml");
	writeFileSync(cfg, "[project]\n");
	const nested = join(root, "a b", "c d");
	mkdirSync(nested, { recursive: true });
	expect(findConfigPath(nested)).toBe(cfg);
});

test("findConfigPath handles unicode", () => {
	const root = mkdtempSync(join(tmpdir(), "üni-"));
	const cfg = join(root, "jyz.config.toml");
	writeFileSync(cfg, "[project]\n");
	const nested = join(root, "λ", "μ");
	mkdirSync(nested, { recursive: true });
	expect(findConfigPath(nested)).toBe(cfg);
});

test("buildArgv preserves spaces and unicode in args", () => {
	const args = ["file with space.txt", "αβγ"];
	expect(buildArgv("bun", { verb: "run", args })).toEqual(["run", "file with space.txt", "αβγ"]);
});

test("loadConfig path with spaces", () => {
	const root = mkdtempSync(join(tmpdir(), "sp ace-"));
	const cfg = join(root, "jyz.config.toml");
	writeFileSync(cfg, '[project]\nlinter = "biome"\n');
	const ctx = loadConfig(root);
	expect(ctx.path).toBe(cfg);
});

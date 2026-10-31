import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { CONFIG_FILENAME, DEFAULT_CONFIG } from "../src/const/defaults.ts";
import { loadConfig } from "../src/funcs/config.ts";

const ENV_NAMES = [
	"JYZ_PACKAGE_MANAGER",
	"JYZ_TYPECHECKER",
	"JYZ_LINTER",
	"JYZ_FORMATTER",
] as const;

let dirs: string[] = [];

function tempDir(): string {
	const dir = mkdtempSync(join(tmpdir(), "jyz-config-"));
	dirs.push(dir);
	return dir;
}

function writeConfig(text: string, dir: string = tempDir()): string {
	const path = join(dir, CONFIG_FILENAME);
	writeFileSync(path, text);
	return path;
}

function clearEnv(): void {
	for (const name of ENV_NAMES) delete process.env[name];
}

afterEach(() => {
	for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
	dirs = [];
	clearEnv();
});

describe("loadConfig", () => {
	test("defaults when nothing is configured anywhere", () => {
		const config = loadConfig(tempDir());

		expect(config.path).toBeNull();
		expect(config.layers).toEqual([]);
		expect(config.project.package_manager).toEqual({ value: "bun", source: "default" });
		expect(config.project.typechecker).toEqual({ value: "bun-check", source: "default" });
		expect(config.project.linter).toEqual({ value: "biome", source: "default" });
		expect(config.project.formatter).toEqual({ value: "biome", source: "default" });
		expect(config.create).toEqual(DEFAULT_CONFIG.create);
		expect(config.monorepo).toEqual(DEFAULT_CONFIG.monorepo);
		expect(config.aliases).toEqual({});
		expect(config.scripts).toEqual({});
	});

	test("config beats detected", () => {
		const dir = tempDir();
		const path = writeConfig('[project]\npackage_manager = "pnpm"\nlinter = "eslint"\n', dir);

		const config = loadConfig(dir, {
			detected: { package_manager: "bun", linter: "biome" },
		});

		expect(config.project.package_manager).toEqual({ value: "pnpm", source: "config" });
		expect(config.project.linter).toEqual({ value: "eslint", source: "config" });
		expect(config.path).toBe(path);
		expect(config.layers).toEqual([path]);
	});

	test("env beats config", () => {
		const dir = tempDir();
		writeConfig('[project]\nlinter = "eslint"\n', dir);
		process.env.JYZ_LINTER = "biome";

		const config = loadConfig(dir);

		expect(config.project.linter).toEqual({ value: "biome", source: "env" });
	});

	test("flag beats env", () => {
		const dir = tempDir();
		writeConfig('[project]\nlinter = "eslint"\n', dir);
		process.env.JYZ_LINTER = "biome";

		const config = loadConfig(dir, { flags: { linter: "none" } });

		expect(config.project.linter).toEqual({ value: "none", source: "flag" });
	});

	test("detected is used when the config is silent", () => {
		const dir = tempDir();
		writeConfig('[aliases]\ni = "install"\n', dir);

		const config = loadConfig(dir, {
			detected: { package_manager: "pnpm", formatter: "prettier" },
		});

		expect(config.project.package_manager).toEqual({ value: "pnpm", source: "detected" });
		expect(config.project.formatter).toEqual({ value: "prettier", source: "detected" });
		expect(config.project.linter).toEqual({ value: "biome", source: "default" });
		expect(config.aliases).toEqual({ i: "install" });
	});

	test('resolves "auto" through detection', () => {
		const dir = tempDir();
		writeConfig('[project]\npackage_manager = "auto"\ntypechecker = "auto"\n', dir);

		const config = loadConfig(dir, {
			detected: { package_manager: "pnpm", typechecker: "tsc" },
		});

		expect(config.project.package_manager).toEqual({ value: "pnpm", source: "detected" });
		expect(config.project.typechecker).toEqual({ value: "tsc", source: "detected" });
	});

	test('resolves "auto" to the built-in default without detection', () => {
		const dir = tempDir();
		writeConfig('[project]\npackage_manager = "auto"\n', dir);

		const config = loadConfig(dir);

		expect(config.project.package_manager).toEqual({ value: "bun", source: "default" });
	});

	test('a flag of "auto" carries no opinion, so the config wins', () => {
		const dir = tempDir();
		writeConfig('[project]\npackage_manager = "pnpm"\n', dir);

		const config = loadConfig(dir, { flags: { package_manager: "auto" } });

		expect(config.project.package_manager).toEqual({ value: "pnpm", source: "config" });
	});

	test("an invalid env value warns and falls through", () => {
		const dir = tempDir();
		writeConfig('[project]\nlinter = "eslint"\n', dir);
		process.env.JYZ_LINTER = "jshint";

		const config = loadConfig(dir);

		expect(config.project.linter).toEqual({ value: "eslint", source: "config" });
		expect(config.warnings).toHaveLength(1);
		expect(config.warnings[0]).toContain("JYZ_LINTER");
	});

	test("file warnings are passed through", () => {
		const dir = tempDir();
		writeConfig('[project]\nlint = "biome"\n', dir);

		const config = loadConfig(dir);

		expect(config.warnings).toEqual(['unknown config key "project.lint"']);
		expect(config.project.linter).toEqual({ value: "biome", source: "default" });
	});

	test("merges create and monorepo over the defaults", () => {
		const dir = tempDir();
		writeConfig('[create]\ngit = "commit"\n[monorepo]\ndefault_filter = true\n', dir);

		const config = loadConfig(dir);

		expect(config.create).toEqual({ ...DEFAULT_CONFIG.create, git: "commit" });
		expect(config.monorepo).toEqual({ default_filter: true });
	});
});

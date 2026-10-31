import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { CONFIG_FILENAME } from "../src/const/defaults.ts";
import { ConfigError, readConfigFile } from "../src/funcs/config.ts";

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

afterEach(() => {
	for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
	dirs = [];
});

describe("readConfigFile", () => {
	test("reads every section", () => {
		const path = writeConfig(
			[
				"[project]",
				'package_manager = "pnpm"',
				'typechecker = "tsc"',
				'formatter = "prettier"',
				"",
				"[aliases]",
				'i = "install"',
				"",
				"[scripts]",
				'lint = "biome check ."',
				"",
				"[create]",
				'default_template = "lib"',
				'git = "commit"',
				"",
				"[monorepo]",
				"default_filter = true",
				"",
			].join("\n"),
		);

		const { config, warnings } = readConfigFile(path);

		expect(warnings).toEqual([]);
		expect(config.project).toEqual({
			package_manager: "pnpm",
			typechecker: "tsc",
			formatter: "prettier",
		});
		expect(config.aliases).toEqual({ i: "install" });
		expect(config.scripts).toEqual({ lint: "biome check ." });
		expect(config.create).toEqual({ default_template: "lib", git: "commit" });
		expect(config.monorepo).toEqual({ default_filter: true });
	});

	test("leaves absent keys absent instead of filling defaults", () => {
		const path = writeConfig('[project]\nlinter = "eslint"\n');

		const { config } = readConfigFile(path);

		expect(config.project).toEqual({ linter: "eslint" });
		expect(config.aliases).toBeUndefined();
	});

	test("warns on an unknown key, naming the dotted path", () => {
		const path = writeConfig('[project]\nlint = "biome"\n[scripts]\nlint = "biome check ."\n');

		const { warnings } = readConfigFile(path);

		expect(warnings).toEqual(['unknown config key "project.lint"']);
	});

	test("warns on an unknown section", () => {
		const path = writeConfig('[toolchain]\nmanager = "bun"\n');

		const { warnings } = readConfigFile(path);

		expect(warnings).toEqual(['unknown config section "toolchain"']);
	});

	test("warns on a value outside its enum and ignores it", () => {
		const path = writeConfig('[project]\nlinter = "jshint"\n');

		const { config, warnings } = readConfigFile(path);

		expect(config.project).toBeUndefined();
		expect(warnings).toEqual([
			'config key "project.linter" must be one of biome, eslint, bun-lint, cargo-clippy, clang-tidy, none, got "jshint"; ignoring',
		]);
	});

	test("throws ConfigError naming the path on malformed TOML", () => {
		const path = writeConfig("[project\n");

		let error: unknown;
		try {
			readConfigFile(path);
		} catch (err) {
			error = err;
		}

		expect(error).toBeInstanceOf(ConfigError);
		expect((error as ConfigError).path).toBe(path);
	});
});

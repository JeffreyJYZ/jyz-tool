import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { CONFIG_FILENAME, DEFAULT_CONFIG } from "../src/const/defaults.ts";
import {
	ConfigError,
	ConfigWriteError,
	findConfigPath,
	loadConfig,
	readConfigFile,
	writeConfigValue,
} from "../src/funcs/config.ts";

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

const COMMENTED = `# jyz settings for this project
[project]
package_manager = "auto"   # detect from the lockfile
typechecker = "auto"
linter = "biome"   # one tool owns linting

[aliases]
i = "install"

# scripts last
[scripts]
lint = "biome check ."
`;

describe("findConfigPath", () => {
	test("returns the nearest config walking up", () => {
		const root = tempDir();
		const path = writeConfig("[project]\n", root);
		const nested = join(root, "packages", "app", "src");
		mkdirSync(nested, { recursive: true });

		expect(findConfigPath(nested)).toBe(path);
		expect(findConfigPath(root)).toBe(path);
	});

	test("returns null when no ancestor has a config", () => {
		const nested = join(tempDir(), "a", "b");
		mkdirSync(nested, { recursive: true });

		expect(findConfigPath(nested)).toBeNull();
	});
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

describe("writeConfigValue", () => {
	test("returns a byte-identical file when the value is unchanged", () => {
		const path = writeConfig(COMMENTED);

		expect(writeConfigValue(path, "project.linter", '"biome"').text).toBe(COMMENTED);
		expect(writeConfigValue(path, "project.linter", "biome").text).toBe(COMMENTED);
	});

	test("replaces a value in place and keeps the trailing comment", () => {
		const path = writeConfig(COMMENTED);

		const { text } = writeConfigValue(path, "project.linter", "eslint");

		expect(text).toBe(
			COMMENTED.replace(
				'linter = "biome"   # one tool owns linting',
				'linter = "eslint"   # one tool owns linting',
			),
		);
		expect(readConfigFile(path).config.project?.linter).toBe("biome");
	});

	test("does not write the file", () => {
		const path = writeConfig(COMMENTED);

		writeConfigValue(path, "project.linter", "eslint");

		expect(readFileSync(path, "utf8")).toBe(COMMENTED);
	});

	test("appends a missing key to an existing section", () => {
		const path = writeConfig(COMMENTED);

		const { text } = writeConfigValue(path, "project.formatter", "prettier");

		expect(text).toBe(
			`${COMMENTED.replace(
				'linter = "biome"   # one tool owns linting\n',
				'linter = "biome"   # one tool owns linting\nformatter = "prettier"\n',
			)}`,
		);
	});

	test("creates a missing section at the end of the file", () => {
		const path = writeConfig(COMMENTED);

		const { text } = writeConfigValue(path, "monorepo.default_filter", "true");

		expect(text).toBe(`${COMMENTED}\n[monorepo]\ndefault_filter = true\n`);
	});

	test("creates a missing file with just the new section", () => {
		const path = join(tempDir(), CONFIG_FILENAME);

		const { text } = writeConfigValue(path, "monorepo.default_filter", "true");

		expect(text).toBe("[monorepo]\ndefault_filter = true\n");
	});

	test("writes a bare value as a TOML string", () => {
		const path = writeConfig(COMMENTED);

		const { text } = writeConfigValue(path, "aliases.a", "add");

		expect(text).toBe(COMMENTED.replace('i = "install"\n', 'i = "install"\na = "add"\n'));
	});

	test("does not treat a # inside a quoted value as a comment", () => {
		const path = writeConfig('[scripts]\nlint = "biome check . # not a comment"\n');

		expect(writeConfigValue(path, "scripts.lint", '"eslint ."').text).toBe(
			'[scripts]\nlint = "eslint ."\n',
		);
	});

	test("preserves CRLF line endings", () => {
		const text = '[project]\r\nlinter = "biome"\r\n';

		const path = writeConfig(text);

		expect(writeConfigValue(path, "project.formatter", '"prettier"').text).toBe(
			'[project]\r\nlinter = "biome"\r\nformatter = "prettier"\r\n',
		);
	});

	test("refuses a duplicate definition", () => {
		const path = writeConfig('[project]\nlinter = "biome"\nlinter = "eslint"\n');

		let error: unknown;
		try {
			writeConfigValue(path, "project.linter", "biome");
		} catch (err) {
			error = err;
		}

		expect(error).toBeInstanceOf(ConfigWriteError);
		expect((error as ConfigWriteError).path).toBe(path);
		expect((error as ConfigWriteError).message).toContain("2 definitions");
	});

	test("refuses a rewrite that would not round-trip", () => {
		const path = writeConfig('[project]\nlinter = [\n\t"biome",\n]\n');

		let error: unknown;
		try {
			writeConfigValue(path, "project.linter", '"eslint"');
		} catch (err) {
			error = err;
		}

		expect(error).toBeInstanceOf(ConfigWriteError);
		expect((error as ConfigWriteError).message).toContain("round-trip");
	});

	test("refuses a key with no section", () => {
		const path = writeConfig(COMMENTED);

		expect(() => writeConfigValue(path, "linter", "biome")).toThrow(ConfigWriteError);
	});

	test("rewrites a root dotted key in place", () => {
		const path = writeConfig('project.linter = "biome"\n');

		expect(writeConfigValue(path, "project.linter", "eslint").text).toBe(
			'project.linter = "eslint"\n',
		);
	});

	test("appends to a file with no trailing newline and keeps it that way", () => {
		const path = writeConfig('[project]\nlinter = "biome"');

		expect(writeConfigValue(path, "project.formatter", "prettier").text).toBe(
			'[project]\nlinter = "biome"\nformatter = "prettier"',
		);
	});

	test("fills an empty section under its header", () => {
		const path = writeConfig("[monorepo]\n\n# trailing note\n");

		expect(writeConfigValue(path, "monorepo.default_filter", "true").text).toBe(
			"[monorepo]\ndefault_filter = true\n\n# trailing note\n",
		);
	});

	test("rewrites a quoted key without unquoting it", () => {
		const path = writeConfig('[aliases]\n"a.b" = "add"\n');

		expect(writeConfigValue(path, "aliases.a.b", "append").text).toBe(
			'[aliases]\n"a.b" = "append"\n',
		);
	});
});

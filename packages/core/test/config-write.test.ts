import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { CONFIG_FILENAME } from "../src/const/defaults.ts";
import { ConfigWriteError, readConfigFile, writeConfigValue } from "../src/funcs/config.ts";

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

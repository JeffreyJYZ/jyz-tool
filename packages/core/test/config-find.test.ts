import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { CONFIG_FILENAME } from "../src/const/defaults.ts";
import { findConfigPath } from "../src/funcs/config.ts";

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

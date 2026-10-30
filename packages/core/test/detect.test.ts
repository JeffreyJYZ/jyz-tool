import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	detectFormatter,
	detectLinter,
	detectPackageManager,
	detectTypechecker,
} from "../src/funcs/detect.ts";

test("bun-only pm", () => {
	const dir = mkdtempSync(join(tmpdir(), "d-"));
	writeFileSync(join(dir, "bun.lock"), "");
	expect(detectPackageManager(dir)).toBe("bun");
});

test("pnpm-only pm", () => {
	const dir = mkdtempSync(join(tmpdir(), "d-"));
	writeFileSync(join(dir, "pnpm-lock.yaml"), "");
	expect(detectPackageManager(dir)).toBe("pnpm");
});

test("conflicting lockfiles throws", () => {
	const dir = mkdtempSync(join(tmpdir(), "d-"));
	writeFileSync(join(dir, "bun.lock"), "");
	writeFileSync(join(dir, "pnpm-lock.yaml"), "");
	let err: unknown;
	try {
		detectPackageManager(dir);
	} catch (e) {
		err = e;
	}
	expect(err).toMatchObject({ code: "ambiguous" });
});

test("biome formatter/linter", () => {
	const dir = mkdtempSync(join(tmpdir(), "d-"));
	writeFileSync(join(dir, "biome.json"), "{}");
	expect(detectLinter(dir)).toBe("biome");
	expect(detectFormatter(dir)).toBe("biome");
});

test("cargo typechecker", () => {
	const dir = mkdtempSync(join(tmpdir(), "d-"));
	writeFileSync(join(dir, "Cargo.toml"), "");
	expect(detectTypechecker(dir)).toBe("cargo");
});

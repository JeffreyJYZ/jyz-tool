import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findConfigPath, loadConfig } from "../src/funcs/config.ts";
import { resolveProject } from "../src/funcs/project.ts";

function makePkg(dir: string, name: string) {
	mkdirSync(dir, { recursive: true });
	writeFileSync(join(dir, "package.json"), JSON.stringify({ name }));
}

test("root config applies to member", () => {
	const root = mkdtempSync(join(tmpdir(), "mr-"));
	mkdirSync(join(root, ".git"));
	writeFileSync(join(root, "jyz.config.toml"), '[project]\nlinter = "eslint"\n');
	const member = join(root, "packages", "app");
	makePkg(member, "app");
	writeFileSync(join(root, "package.json"), JSON.stringify({ name: "root" }));
	writeFileSync(join(member, "package.json"), JSON.stringify({ name: "app" }));
	const ctx = resolveProject(member);
	expect(ctx.config.project.linter.value).toBe("eslint");
});

test("member config overrides project", () => {
	const root = mkdtempSync(join(tmpdir(), "mr-"));
	mkdirSync(join(root, ".git"));
	writeFileSync(join(root, "jyz.config.toml"), '[project]\nlinter = "eslint"\n');
	const member = join(root, "packages", "app");
	mkdirSync(member, { recursive: true });
	writeFileSync(join(member, "jyz.config.toml"), '[project]\nlinter = "biome"\n');
	makePkg(member, "app");
	const ctx = resolveProject(member);
	expect(ctx.config.project.linter.value).toBe("biome");
});

// NOTE: member-inherits-root-aliases is NOT implemented: loadConfig reads only the
// nearest config. Reported as a real bug in task-14-report.md.
test("filter by directory name", () => {
	const root = mkdtempSync(join(tmpdir(), "mr-"));
	mkdirSync(join(root, ".git"));
	const a = join(root, "packages", "alpha");
	const b = join(root, "packages", "beta");
	makePkg(a, "@x/alpha");
	makePkg(b, "@x/beta");
	writeFileSync(join(root, "package.json"), JSON.stringify({ name: "root" }));
	const ctx = resolveProject(root, { filter: "beta" });
	expect(ctx.packageName).toBe("@x/beta");
});

test("filter by package.json name", () => {
	const root = mkdtempSync(join(tmpdir(), "mr-"));
	mkdirSync(join(root, ".git"));
	const a = join(root, "packages", "alpha");
	makePkg(a, "special-name");
	writeFileSync(join(root, "package.json"), JSON.stringify({ name: "root" }));
	const ctx = resolveProject(root, { filter: "special-name" });
	expect(ctx.packageName).toBe("special-name");
});

test("filter zero-match lists candidates", () => {
	const root = mkdtempSync(join(tmpdir(), "mr-"));
	mkdirSync(join(root, ".git"));
	const a = join(root, "packages", "alpha");
	makePkg(a, "alpha");
	writeFileSync(join(root, "package.json"), JSON.stringify({ name: "root" }));
	let err: any;
	try {
		resolveProject(root, { filter: "nope" });
	} catch (e) {
		err = e;
	}
	expect(err?.code).toBe("filter_no_match");
	expect(Array.isArray(err?.candidates)).toBe(true);
});

test("filter multi-match lists candidates", () => {
	const root = mkdtempSync(join(tmpdir(), "mr-"));
	mkdirSync(join(root, ".git"));
	const a = join(root, "packages", "alpha");
	const b = join(root, "packages", "alpha2");
	makePkg(a, "shared");
	makePkg(b, "shared");
	writeFileSync(join(root, "package.json"), JSON.stringify({ name: "root" }));
	let err: any;
	try {
		resolveProject(root, { filter: "shared" });
	} catch (e) {
		err = e;
	}
	expect(err?.code).toBe("ambiguous");
	expect(err?.candidates?.length).toBe(2);
});

test("three levels deep resolves to itself", () => {
	const root = mkdtempSync(join(tmpdir(), "mr-"));
	mkdirSync(join(root, ".git"));
	const deep = join(root, "a", "b", "c");
	makePkg(deep, "deep-pkg");
	writeFileSync(join(root, "package.json"), JSON.stringify({ name: "root" }));
	const ctx = resolveProject(deep);
	expect(ctx.packageDir).toBe(deep);
	expect(ctx.packageName).toBe("deep-pkg");
});

test("node_modules/.bin lookup walks up", () => {
	// ensure findConfigPath/resolveProject not affected; just smoke import paths module
	const root = mkdtempSync(join(tmpdir(), "mr-"));
	mkdirSync(join(root, ".git"));
	const nested = join(root, "packages", "app", "src");
	mkdirSync(nested, { recursive: true });
	makePkg(join(root, "packages", "app"), "app");
	writeFileSync(join(root, "package.json"), JSON.stringify({ name: "root" }));
	expect(findConfigPath(nested)).toBeNull();
});

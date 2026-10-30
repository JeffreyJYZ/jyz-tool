import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveProject } from "../src/funcs/project.ts";

function makePkg(dir: string, name: string) {
	mkdirSync(dir, { recursive: true });
	writeFileSync(join(dir, "package.json"), JSON.stringify({ name }));
}

test("monorepo filter by dir name", () => {
	const root = mkdtempSync(join(tmpdir(), "p-"));
	mkdirSync(join(root, ".git"));
	const a = join(root, "packages", "alpha");
	const b = join(root, "packages", "beta");
	makePkg(a, "@x/alpha");
	makePkg(b, "@x/beta");
	writeFileSync(
		join(root, "package.json"),
		JSON.stringify({ name: "root", workspaces: ["packages/*"] }),
	);
	const ctx = resolveProject(root, { filter: "beta" });
	expect(ctx.packageName).toBe("@x/beta");
});

test("monorepo filter by package name", () => {
	const root = mkdtempSync(join(tmpdir(), "p-"));
	mkdirSync(join(root, ".git"));
	const a = join(root, "packages", "alpha");
	makePkg(a, "special-name");
	writeFileSync(join(root, "package.json"), JSON.stringify({ name: "root" }));
	const ctx = resolveProject(root, { filter: "special-name" });
	expect(ctx.packageName).toBe("special-name");
});

test("no-match filter throws", () => {
	const root = mkdtempSync(join(tmpdir(), "p-"));
	mkdirSync(join(root, ".git"));
	const a = join(root, "packages", "alpha");
	makePkg(a, "alpha");
	writeFileSync(join(root, "package.json"), JSON.stringify({ name: "root" }));
	let err: unknown;
	try {
		resolveProject(root, { filter: "nope" });
	} catch (e) {
		err = e;
	}
	expect(err).toMatchObject({ code: "filter_no_match" });
});

test("src layout resolves", () => {
	const root = mkdtempSync(join(tmpdir(), "p-"));
	mkdirSync(join(root, ".git"));
	const src = join(root, "src");
	mkdirSync(src, { recursive: true });
	writeFileSync(join(src, "index.ts"), "");
	writeFileSync(join(root, "package.json"), JSON.stringify({ name: "srcproj" }));
	const ctx = resolveProject(src);
	expect(ctx.packageName).toBe("srcproj");
});

test("rust root", () => {
	const root = mkdtempSync(join(tmpdir(), "p-"));
	mkdirSync(join(root, ".git"));
	writeFileSync(join(root, "Cargo.toml"), '[package]\nname = "rustproj"\n');
	const ctx = resolveProject(root);
	expect(ctx.packageName).toBe("rustproj");
});

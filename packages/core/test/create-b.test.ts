import { afterEach, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createProject } from "../src/create/index.ts";
import type { Template } from "../src/types/create.ts";

const roots: string[] = [];

async function tempRoot(): Promise<string> {
	const dir = await mkdtemp(join(tmpdir(), "jyz-create-"));
	roots.push(dir);
	return dir;
}

async function text(path: string): Promise<string> {
	return await readFile(path, "utf8");
}

afterEach(async () => {
	await Promise.all(roots.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

test("an unknown template throws and lists what is available", async () => {
	const cwd = await tempRoot();
	const call = createProject({ name: "demo", template: "rails" as Template }, cwd);
	await expect(call).rejects.toThrow(/Unknown template "rails"/);
	await expect(call).rejects.toThrow("cli");
});

test("an unknown template throws before writing anything", async () => {
	const cwd = await tempRoot();
	await expect(
		createProject({ name: "demo", template: "dots" as Template }, cwd),
	).rejects.toThrow(/Unknown template/);
	expect(existsSync(join(cwd, "demo"))).toBe(false);
});

test("an existing non-empty target directory throws", async () => {
	const cwd = await tempRoot();
	await mkdir(join(cwd, "demo"), { recursive: true });
	await writeFile(join(cwd, "demo", "keep.txt"), "mine\n");

	await expect(createProject({ name: "demo", template: "cli" }, cwd)).rejects.toThrow(
		/not empty/,
	);
	expect(await text(join(cwd, "demo", "keep.txt"))).toBe("mine\n");
});

test("an incompatible linter and formatter throw before any file is written", async () => {
	const cwd = await tempRoot();
	await expect(
		createProject({ name: "demo", template: "cli", linter: "bun-lint" }, cwd),
	).rejects.toThrow(/--linter bun-lint requires --formatter bun-fmt/);
	expect(existsSync(join(cwd, "demo"))).toBe(false);
});

test("rust-bin maps to the cargo-bin template", async () => {
	const cwd = await tempRoot();
	const result = await createProject({ name: "flint", template: "rust-bin" }, cwd);
	const cargo = await text(join(result.dir, "Cargo.toml"));

	expect(cargo).toContain('name = "flint"');
	expect(cargo).toContain("[[bin]]");
	expect(result.files).toContain("rustfmt.toml");
	expect(result.files).toContain("src/main.rs");
	expect(result.files).not.toContain("jyz.config.toml");

	const agents = await text(join(result.dir, "AGENTS.md"));
	expect(agents).toContain("cargo fmt");
	expect(agents).toContain("cargo-clippy");
});

test("the c template ships a Makefile with tab recipes and a justfile", async () => {
	const cwd = await tempRoot();
	const result = await createProject({ name: "beacon", template: "c" }, cwd);
	const makefile = await text(join(result.dir, "Makefile"));

	expect(makefile).toContain("\n\t@mkdir -p dist\n");
	expect(makefile).toContain("dist/beacon");
	expect(result.files).toContain("justfile");
	expect(result.files).toContain(".clang-format");
	expect(existsSync(join(result.dir, "src/greeter.h"))).toBe(true);
});

test("the monorepo template names members after the project", async () => {
	const cwd = await tempRoot();
	const result = await createProject({ name: "orchard", template: "monorepo" }, cwd);
	const member = JSON.parse(await text(join(result.dir, "packages/core/package.json"))) as {
		name: string;
	};

	expect(member.name).toBe("@orchard/core");
	expect(result.files).toContain("packages/cli/src/bin.ts");
	expect(result.files).toContain("jyz.config.toml");

	const root = JSON.parse(await text(join(result.dir, "package.json"))) as {
		workspaces: string[];
	};
	expect(root.workspaces).toEqual(["packages/*"]);
});

test("--publishable writes the release fields and drops private", async () => {
	const cwd = await tempRoot();
	const result = await createProject({ name: "acme", template: "cli", publishable: true }, cwd);
	const manifest = JSON.parse(await text(join(result.dir, "package.json"))) as {
		private?: boolean;
		files?: string[];
		bin?: Record<string, string>;
		engines?: Record<string, string>;
		packageManager?: string;
		publishConfig?: { access: string };
	};

	expect(manifest.private).toBeUndefined();
	expect(manifest.files).toEqual(["dist"]);
	expect(manifest.bin).toEqual({ acme: "./dist/bin.js" });
	expect(manifest.publishConfig?.access).toBe("public");
	expect(manifest.engines?.bun).toBeString();
	expect(manifest.packageManager).toBe("bun@1.4.4");
});

test("--publishable on a non-JS template warns instead of pretending", async () => {
	const cwd = await tempRoot();
	const result = await createProject({ name: "beacon", template: "c", publishable: true }, cwd);

	expect(result.warnings.join("\n")).toContain("--publishable");
});

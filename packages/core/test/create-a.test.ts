import { afterEach, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CreateError } from "../src/create/errors.ts";
import { createProject } from "../src/create/index.ts";
import type { CreateOptions } from "../src/types/create.ts";

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

test("renders the cli template with substituted name, package manager and version", async () => {
	const cwd = await tempRoot();
	const result = await createProject({ name: "acme", template: "cli" }, cwd);
	const dir = join(cwd, "acme");

	expect(result.dir).toBe(dir);
	expect(result.files).toContain("src/bin.ts");
	expect(result.files).toEqual([...result.files].sort());

	const manifest = JSON.parse(await text(join(dir, "package.json"))) as {
		name: string;
		version: string;
		scripts: Record<string, string>;
		devDependencies: Record<string, string>;
	};
	expect(manifest.name).toBe("acme");
	expect(manifest.version).toBe("0.1.0");
	expect(manifest.devDependencies["@biomejs/biome"]).toBeString();
	expect(manifest.scripts.lint).toBe("biome check .");
	expect(manifest.scripts.format).toBe("biome format --write .");
	expect(manifest.scripts.typecheck).toBe("bun check");

	const agents = await text(join(dir, "AGENTS.md"));
	expect(agents).toContain("# acme");
	expect(agents).toContain("bun install");
	expect(agents).toContain("bun-check");
	expect(agents).not.toContain("__NAME__");

	const config = await text(join(dir, "jyz.config.toml"));
	expect(config).toContain('package_manager = "bun"');
	expect(config).toContain('formatter = "biome"');

	const bin = await text(join(dir, "src/bin.ts"));
	expect(bin.startsWith("#!/usr/bin/env bun")).toBe(true);
});

test("honours an explicit package manager, linter and formatter", async () => {
	const cwd = await tempRoot();
	const result = await createProject(
		{
			name: "acme",
			template: "cli",
			packageManager: "pnpm",
			linter: "eslint",
			formatter: "prettier",
		},
		cwd,
	);
	const dir = join(cwd, "acme");
	const agents = await text(join(dir, "AGENTS.md"));

	expect(agents).toContain("pnpm install");
	expect(result.files).toContain("eslint.config.js");
	expect(result.files).toContain(".prettierrc");
	expect(result.files).not.toContain("biome.json");

	const manifest = JSON.parse(await text(join(dir, "package.json"))) as {
		scripts: Record<string, string>;
		devDependencies: Record<string, string>;
	};
	expect(manifest.scripts.lint).toBe("eslint .");
	expect(manifest.scripts.format).toBe("prettier --write .");
	expect(manifest.devDependencies.eslint).toBeString();
	expect(manifest.devDependencies["@biomejs/biome"]).toBeUndefined();
});

test("skips docs unless requested, then renders the scaffold", async () => {
	const bare = await tempRoot();
	const plain = await createProject({ name: "acme", template: "cli" }, bare);
	expect(existsSync(join(plain.dir, "docs"))).toBe(false);
	expect(plain.files.some((file) => file.startsWith("docs/"))).toBe(false);

	const withDocs = await tempRoot();
	const documented = await createProject({ name: "acme", template: "cli", docs: true }, withDocs);
	expect(documented.files).toContain("docs/plan/agent/main.md");
	expect(existsSync(join(documented.dir, "docs/progress/log"))).toBe(true);
});

test("--yes fills every unspecified option from the template defaults", async () => {
	const cwd = await tempRoot();
	const result = await createProject({ name: "demo", template: "cli", yes: true }, cwd);

	expect(result.files).toContain("biome.json");
	expect(result.files).toContain("jyz.config.toml");
	const config = await text(join(result.dir, "jyz.config.toml"));
	expect(config).toContain('typechecker = "bun-check"');
	expect(config).toContain('linter = "biome"');
});

test("a missing template throws naming the flag and writes nothing", async () => {
	const cwd = await tempRoot();
	await expect(createProject({ name: "demo" } as unknown as CreateOptions, cwd)).rejects.toThrow(
		CreateError,
	);
	await expect(createProject({ name: "demo" } as unknown as CreateOptions, cwd)).rejects.toThrow(
		"--template",
	);
	expect(existsSync(join(cwd, "demo"))).toBe(false);
});

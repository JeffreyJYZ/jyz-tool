import { afterEach, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CreateError } from "../src/create/errors.ts";
import { createProject } from "../src/create/index.ts";

const roots: string[] = [];

async function tempRoot(): Promise<string> {
	const dir = await mkdtemp(join(tmpdir(), "jyz-monorepo-"));
	roots.push(dir);
	return dir;
}

async function text(path: string): Promise<string> {
	return await readFile(path, "utf8");
}

afterEach(async () => {
	await Promise.all(roots.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

test("monorepo writes a root with members rendered from their own templates", async () => {
	const cwd = await tempRoot();
	const result = await createProject({ name: "orchard", template: "monorepo" }, cwd);
	const dir = join(cwd, "orchard");

	expect(result.dir).toBe(dir);
	expect(result.files).toContain("package.json");
	expect(result.files).toContain("packages/core/package.json");
	expect(result.files).toContain("packages/core/src/index.ts");
	expect(result.files).toContain("packages/cli/package.json");
	expect(result.files).toContain("packages/cli/src/bin.ts");

	const core = JSON.parse(await text(join(dir, "packages/core/package.json"))) as {
		name: string;
	};
	const cli = JSON.parse(await text(join(dir, "packages/cli/package.json"))) as {
		name: string;
		dependencies: Record<string, string>;
	};
	expect(core.name).toBe("@orchard/core");
	expect(cli.name).toBe("@orchard/cli");
	expect(cli.dependencies["@orchard/core"]).toBe("workspace:*");

	const coreIndex = await text(join(dir, "packages/core/src/index.ts"));
	const cliBin = await text(join(dir, "packages/cli/src/bin.ts"));
	expect(coreIndex).toContain("@orchard/core");
	expect(cliBin).toContain("@orchard/core");
	expect(coreIndex).not.toContain("__NAME__");
	expect(cliBin).not.toContain("__NAME__");
});

test("monorepo root carries jyz.config.toml and a root package.json", async () => {
	const cwd = await tempRoot();
	const result = await createProject({ name: "orchard", template: "monorepo" }, cwd);
	const dir = join(cwd, "orchard");

	expect(result.files).toContain("jyz.config.toml");
	expect(existsSync(join(dir, "jyz.config.toml"))).toBe(true);
	expect(existsSync(join(dir, "package.json"))).toBe(true);

	const root = JSON.parse(await text(join(dir, "package.json"))) as {
		workspaces: string[];
		private: boolean;
	};
	expect(root.workspaces).toEqual(["packages/*"]);
	expect(root.private).toBe(true);
});

test("monorepo skips docs unless requested, once at the root", async () => {
	const bare = await tempRoot();
	const plain = await createProject({ name: "orchard", template: "monorepo" }, bare);
	expect(existsSync(join(plain.dir, "docs"))).toBe(false);
	expect(plain.files.some((file) => file.startsWith("docs/"))).toBe(false);
	expect(existsSync(join(plain.dir, "packages/core/docs"))).toBe(false);
	expect(existsSync(join(plain.dir, "packages/cli/docs"))).toBe(false);

	const withDocs = await tempRoot();
	const documented = await createProject(
		{ name: "orchard", template: "monorepo", docs: true },
		withDocs,
	);
	expect(documented.files).toContain("docs/plan/agent/main.md");
	expect(existsSync(join(documented.dir, "docs/progress/log"))).toBe(true);
	const docFiles = documented.files.filter((file) => file.startsWith("docs/"));
	expect(docFiles.length).toBeGreaterThan(0);
});

test("an existing non-empty target directory throws before writing", async () => {
	const cwd = await tempRoot();
	await mkdir(join(cwd, "orchard"), { recursive: true });
	await writeFile(join(cwd, "orchard", "keep.txt"), "mine\n");

	await expect(createProject({ name: "orchard", template: "monorepo" }, cwd)).rejects.toThrow(
		CreateError,
	);
	await expect(createProject({ name: "orchard", template: "monorepo" }, cwd)).rejects.toThrow(
		/not empty/,
	);
	expect(await text(join(cwd, "orchard", "keep.txt"))).toBe("mine\n");
});

test("two runs into different temp dirs produce identical file lists", async () => {
	const first = await tempRoot();
	const second = await tempRoot();
	const a = await createProject({ name: "orchard", template: "monorepo" }, first);
	const b = await createProject({ name: "orchard", template: "monorepo" }, second);

	expect(a.files).toEqual(b.files);
});

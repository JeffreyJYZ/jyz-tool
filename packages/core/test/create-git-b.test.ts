import { afterEach, expect, test } from "bun:test";
import { existsSync, realpathSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, dirname, join } from "node:path";
import { createProject } from "../src/create/index.ts";
import type { CreateOptions } from "../src/types/create.ts";
import { writeStub } from "./helpers/stub.ts";

const roots: string[] = [];
const realPath = process.env.PATH;
const realRecord = process.env.JYZ_RECORD;

interface Invocation {
	cmd: string;
	cwd: string;
	argv: string[];
}

async function tempRoot(): Promise<string> {
	const dir = await mkdtemp(join(tmpdir(), "jyz-create-git-"));
	roots.push(dir);
	return dir;
}

const GIT_STUB: string | undefined = undefined;
const BUN_STUB: string | undefined = undefined;
const PNPM_STUB: string | undefined = undefined;

const _GH_OK =
	'(argv) => { if (argv[0] === "auth") return { exitCode: 0 }; if (argv[0] === "repo") return { stdout: "https://github.com/tester/" + argv[2] + "\\n", exitCode: 0 }; return { exitCode: 1 }; }';

const _GH_UNAUTHENTICATED =
	'(argv) => { if (argv[0] === "auth") return { stderr: "You are not logged into any GitHub hosts. Run gh auth login to authenticate.\\n", exitCode: 1 }; return { exitCode: 0 }; }';

const GH_REJECTS =
	'(argv) => { if (argv[0] === "auth") return { exitCode: 0 }; return { stderr: "HTTP 422: repository already exists.\\n", exitCode: 1 }; }';

/** Installs the stubs into a fresh directory and prepends it to PATH, replacing the original. */
async function stubPath(scripts: Record<string, string | undefined>): Promise<string> {
	const dir = await tempRoot();
	for (const [name, behaviour] of Object.entries(scripts)) {
		writeStub(dir, name, { record: process.env.JYZ_RECORD, format: "block", behaviour });
	}
	process.env.PATH = `${dir}${delimiter}${dirname(process.execPath)}`;
	return dir;
}

async function invocations(record: string): Promise<Invocation[]> {
	if (!existsSync(record)) return [];
	const text = await readFile(record, "utf8");
	return text
		.split("--\n")
		.filter((block) => block.trim() !== "")
		.map((block) => ({
			cmd: /^cmd=(.*)$/m.exec(block)?.[1] ?? "",
			cwd: /^cwd=(.*)$/m.exec(block)?.[1] ?? "",
			argv: [...block.matchAll(/^arg=(.*)$/gm)].map((match) => match[1] ?? ""),
		}));
}

async function fixture(
	scripts: Record<string, string | undefined>,
): Promise<{ cwd: string; record: string }> {
	const cwd = await tempRoot();
	const record = join(cwd, "calls.log");
	process.env.JYZ_RECORD = record;
	await stubPath(scripts);
	return { cwd, record };
}

afterEach(async () => {
	process.env.PATH = realPath;
	if (realRecord === undefined) delete process.env.JYZ_RECORD;
	else process.env.JYZ_RECORD = realRecord;
	await Promise.all(roots.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

test("a gh that rejects after the tree is written leaves the project intact and names the step", async () => {
	const { cwd } = await fixture({ git: GIT_STUB, gh: GH_REJECTS });
	const call = createProject({ name: "acme", template: "cli", git: "github" }, cwd);

	await expect(call).rejects.toThrow(/gh repo create failed: HTTP 422/);
	await expect(call).rejects.toThrow(/is written/);

	const dir = join(cwd, "acme");
	expect(existsSync(join(dir, "package.json"))).toBe(true);
	expect(existsSync(join(dir, "src/bin.ts"))).toBe(true);
	expect(existsSync(join(dir, "AGENTS.md"))).toBe(true);
});

test("--install runs the detected package manager's install after writing", async () => {
	const { cwd, record } = await fixture({ bun: BUN_STUB });
	const result = await createProject(
		{ name: "acme", template: "cli", git: "skip", install: true },
		cwd,
	);

	expect(await invocations(record)).toEqual([
		{ cmd: "bun", cwd: realpathSync(result.dir), argv: ["install"] },
	]);
	expect(result.files).toContain("package.json");
});

test("--install with pnpm records pnpm install and pins pnpm when publishable", async () => {
	const { cwd, record } = await fixture({ pnpm: PNPM_STUB });
	const result = await createProject(
		{
			name: "acme",
			template: "cli",
			packageManager: "pnpm",
			linter: "eslint",
			formatter: "prettier",
			git: "skip",
			install: true,
			publishable: true,
		},
		cwd,
	);

	expect(await invocations(record)).toEqual([
		{ cmd: "pnpm", cwd: realpathSync(result.dir), argv: ["install"] },
	]);

	const manifest = JSON.parse(await readFile(join(result.dir, "package.json"), "utf8")) as {
		private?: boolean;
		bin?: Record<string, string>;
		files?: string[];
		engines?: Record<string, string>;
		packageManager?: string;
		publishConfig?: { access: string };
	};
	expect(manifest.private).toBeUndefined();
	expect(manifest.files).toEqual(["dist"]);
	expect(manifest.bin).toEqual({ acme: "./dist/bin.js" });
	expect(manifest.publishConfig).toEqual({ access: "public" });
	expect(manifest.engines).toEqual({ node: ">=22.0.0" });
	expect(manifest.packageManager).toBe("pnpm@10.15.0");
});

test("--install runs before the git steps so the lockfile is staged", async () => {
	const { cwd, record } = await fixture({ bun: BUN_STUB, git: GIT_STUB });
	const result = await createProject(
		{ name: "acme", template: "cli", git: "commit", install: true },
		cwd,
	);

	const calls = await invocations(record);
	expect(calls.map((call) => call.cmd)).toEqual(["bun", "git", "git", "git"]);
	expect(calls[0]?.cwd).toBe(realpathSync(result.dir));
});

test("--install on a template without a package manager warns instead of running", async () => {
	const { cwd, record } = await fixture({});
	const result = await createProject(
		{ name: "beacon", template: "c", git: "skip", install: true } as CreateOptions,
		cwd,
	);

	expect(await invocations(record)).toEqual([]);
	expect(result.warnings.join("\n")).toContain("--install");
});

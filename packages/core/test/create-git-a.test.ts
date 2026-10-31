import { afterEach, expect, spyOn, test } from "bun:test";
import { existsSync, realpathSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, dirname, join } from "node:path";
import { createProject } from "../src/create/index.ts";
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
const _BUN_STUB: string | undefined = undefined;
const _PNPM_STUB: string | undefined = undefined;

const GH_OK =
	'(argv) => { if (argv[0] === "auth") return { exitCode: 0 }; if (argv[0] === "repo") return { stdout: "https://github.com/tester/" + argv[2] + "\\n", exitCode: 0 }; return { exitCode: 1 }; }';

const GH_UNAUTHENTICATED =
	'(argv) => { if (argv[0] === "auth") return { stderr: "You are not logged into any GitHub hosts. Run gh auth login to authenticate.\\n", exitCode: 1 }; return { exitCode: 0 }; }';

const _GH_REJECTS =
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

test("--git init runs git init inside the new directory and nothing else", async () => {
	const { cwd, record } = await fixture({ git: GIT_STUB });
	const result = await createProject({ name: "acme", template: "cli", git: "init" }, cwd);

	expect(await invocations(record)).toEqual([
		{ cmd: "git", cwd: realpathSync(result.dir), argv: ["init"] },
	]);
	expect(result.dir).toBe(join(cwd, "acme"));
});

test("--git commit also stages everything and commits with the scaffold message", async () => {
	const { cwd, record } = await fixture({ git: GIT_STUB });
	const result = await createProject({ name: "acme", template: "cli", git: "commit" }, cwd);

	expect(await invocations(record)).toEqual([
		{ cmd: "git", cwd: realpathSync(result.dir), argv: ["init"] },
		{ cmd: "git", cwd: realpathSync(result.dir), argv: ["add", "-A"] },
		{
			cmd: "git",
			cwd: realpathSync(result.dir),
			argv: ["commit", "-m", "chore: scaffold acme"],
		},
	]);
});

test("--git skip leaves git alone", async () => {
	const { cwd, record } = await fixture({ git: GIT_STUB });
	await createProject({ name: "acme", template: "cli", git: "skip" }, cwd);

	expect(await invocations(record)).toEqual([]);
});

test("--git github checks gh first, then commits and creates the private repository", async () => {
	const { cwd, record } = await fixture({ git: GIT_STUB, gh: GH_OK });
	const log = spyOn(console, "log");
	const result = await createProject({ name: "acme", template: "cli", git: "github" }, cwd);

	const calls = await invocations(record);
	expect(calls).toEqual([
		{ cmd: "gh", cwd: realpathSync(cwd), argv: ["auth", "status"] },
		{ cmd: "git", cwd: realpathSync(result.dir), argv: ["init"] },
		{ cmd: "git", cwd: realpathSync(result.dir), argv: ["add", "-A"] },
		{
			cmd: "git",
			cwd: realpathSync(result.dir),
			argv: ["commit", "-m", "chore: scaffold acme"],
		},
		{
			cmd: "gh",
			cwd: realpathSync(result.dir),
			argv: [
				"repo",
				"create",
				"acme",
				"--private",
				"--source",
				".",
				"--remote",
				"origin",
				"--push",
			],
		},
	]);

	const printed = log.mock.calls.flat().join("\n");
	expect(printed).toContain("https://github.com/tester/acme");
	log.mockRestore();
});

test("a missing gh fails before any file is written and names the remedy", async () => {
	const { cwd, record } = await fixture({ git: GIT_STUB });
	const call = createProject({ name: "acme", template: "cli", git: "github" }, cwd);

	await expect(call).rejects.toThrow(/gh.*not found on PATH/);
	await expect(call).rejects.toThrow(/gh auth login/);
	expect(existsSync(join(cwd, "acme"))).toBe(false);
	expect(await invocations(record)).toEqual([]);
});

test("an unauthenticated gh fails before any file is written and names the remedy", async () => {
	const { cwd, record } = await fixture({ git: GIT_STUB, gh: GH_UNAUTHENTICATED });
	const call = createProject({ name: "acme", template: "cli", git: "github" }, cwd);

	await expect(call).rejects.toThrow(/not authenticated/);
	await expect(call).rejects.toThrow(/gh auth login/);
	expect(existsSync(join(cwd, "acme"))).toBe(false);
	expect((await invocations(record)).map((call) => call.argv)).toEqual([["auth", "status"]]);
});

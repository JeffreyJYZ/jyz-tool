import { runCommand } from "../funcs/exec.ts";
import type { GitMode } from "../types/create.ts";
import { CreateError } from "./errors.ts";

const GH_MISSING =
	"`gh` is required for --git github but was not found on PATH. Install the GitHub CLI (https://cli.github.com), run `gh auth login`, then retry.";

const GH_UNAUTHENTICATED =
	"`gh` is not authenticated, so --git github cannot create a repository. Run `gh auth login`, or use --git commit to keep the repository local.";

interface RunResult {
	exitCode: number;
	stdout: string;
	stderr: string;
}

/**
 * Fails a `github` run before anything is written when `gh` cannot create a repository: a missing
 * binary and a logged-out account are the two states a user can fix, so each names its remedy.
 */
export async function assertGithubReady(cwd: string): Promise<void> {
	let result: RunResult;
	try {
		result = await runCommand({ file: "gh", argv: ["auth", "status"], cwd }, { stdio: "pipe" });
	} catch {
		throw new CreateError(GH_MISSING);
	}
	if (result.exitCode !== 0) {
		throw new CreateError(GH_UNAUTHENTICATED);
	}
}

/**
 * Runs the git steps of `mode` inside the freshly written project and prints the URL `gh` reports.
 * Steps run in order so `commit` picks up the lockfile a prior install wrote; a failure names the
 * step and leaves the tree intact.
 */
export async function applyGitSteps(dir: string, name: string, mode: GitMode): Promise<void> {
	if (mode === "skip") return;

	await runStep(dir, "git init", "git", ["init"]);
	if (mode === "init") return;

	await runStep(dir, "git add", "git", ["add", "-A"]);
	await runStep(dir, "git commit", "git", ["commit", "-m", `chore: scaffold ${name}`]);
	if (mode === "commit") return;

	const created = await runStep(dir, "gh repo create", "gh", [
		"repo",
		"create",
		name,
		"--private",
		"--source",
		".",
		"--remote",
		"origin",
		"--push",
	]);
	const url = findUrl(created.stdout);
	if (url !== undefined) console.log(url);
}

async function runStep(
	dir: string,
	label: string,
	file: string,
	argv: string[],
): Promise<RunResult> {
	let result: RunResult;
	try {
		result = await runCommand({ file, argv, cwd: dir }, { stdio: "pipe" });
	} catch (error) {
		const reason = error instanceof Error ? error.message : String(error);
		throw new CreateError(
			`${label} could not start: ${reason}\nThe project tree at ${dir} is already written; install the tool and run the step again.`,
		);
	}
	if (result.exitCode !== 0) {
		throw new CreateError(
			`${label} failed: ${detail(result)}.\nThe project tree at ${dir} is written; fix the cause and run the step again.`,
		);
	}
	return result;
}

/** Last line the failing tool said, so the error quotes the tool rather than only an exit code. */
function detail(result: RunResult): string {
	const lines = (result.stderr.trim() || result.stdout.trim()).split("\n").filter(Boolean);
	return lines.pop() ?? `exit code ${result.exitCode}`;
}

function findUrl(stdout: string): string | undefined {
	for (const line of stdout.split("\n")) {
		const trimmed = line.trim();
		if (/^https?:\/\/\S+$/.test(trimmed)) return trimmed;
	}
	return undefined;
}

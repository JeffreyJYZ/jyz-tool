import type { CommandSpec } from "@jyz/core";
import { resolveCommand, runCommand, spawnArgv } from "@jyz/core";
import { formatSpec } from "./dispatch.ts";

export interface RunOptions {
	/** Print the resolved command before spawning it. */
	verbose?: boolean;
	/** How the executable was chosen, named when the spawn itself fails. */
	origin?: string;
}

/**
 * Spawns one resolved command with inherited stdio and returns its exit code.
 *
 * A missing binary is reported with the executable's name and the detection that chose it, because
 * a bare `ENOENT` on a machine with two package managers says nothing actionable.
 */
export interface CapturedRun {
	exitCode: number;
	stdout: string;
	stderr: string;
}

export async function runSpec(spec: CommandSpec, options: RunOptions = {}): Promise<number> {
	if (options.verbose === true) console.log(formatSpec(spec));
	try {
		const result = await runCommand(spec);
		return result.exitCode;
	} catch (error) {
		const reason = error instanceof Error ? error.message : String(error);
		console.error(`jyz: cannot run ${spec.file}: ${reason}`);
		if (options.origin !== undefined) console.error(`jyz: ${options.origin}`);
		return 127;
	}
}

/** Spawns with captured stdio for `--json` mode and returns the captured output. */
export async function runSpecCaptured(
	spec: CommandSpec,
	options: RunOptions = {},
): Promise<CapturedRun> {
	if (options.verbose === true) console.error(formatSpec(spec));
	try {
		const proc = Bun.spawn(spawnArgv(resolveCommand(spec.file), spec.argv), {
			cwd: spec.cwd,
			stdout: "pipe",
			stderr: "pipe",
		});
		const [stdout, stderr, exitCode] = await Promise.all([
			new Response(proc.stdout).text(),
			new Response(proc.stderr).text(),
			proc.exited,
		]);
		if (exitCode !== 0 && options.origin !== undefined) {
			// keep origin informational only
		}
		return { exitCode, stdout, stderr };
	} catch (error) {
		const reason = error instanceof Error ? error.message : String(error);
		return { exitCode: 127, stdout: "", stderr: `jyz: cannot run ${spec.file}: ${reason}` };
	}
}

/** Runs each spec in order, stopping at the first failure, and returns the code to exit with. */
export async function runSpecs(
	specs: readonly CommandSpec[],
	options: RunOptions = {},
): Promise<number> {
	for (const spec of specs) {
		const code = await runSpec(spec, options);
		if (code !== 0) return code;
	}
	return 0;
}

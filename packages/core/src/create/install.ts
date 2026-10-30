import { runCommand } from "../funcs/exec.ts";
import { CreateError } from "./errors.ts";

/** Install command per package manager a template profile can select. */
const INSTALL_ARGV: Record<string, string[]> = {
	bun: ["install"],
	pnpm: ["install"],
	cargo: ["fetch"],
};

/**
 * Runs the chosen package manager's install command in the new project. Returns a warning instead
 * of running anything when the template has nothing to install, so `--install` never pretends.
 */
export async function installDependencies(
	dir: string,
	packageManager: string,
): Promise<string | undefined> {
	const argv = INSTALL_ARGV[packageManager];
	if (argv === undefined) {
		return `--install has no effect: no install command is known for "${packageManager}".`;
	}

	const command = `${packageManager} ${argv.join(" ")}`;
	let exitCode: number;
	try {
		exitCode = (await runCommand({ file: packageManager, argv, cwd: dir })).exitCode;
	} catch (error) {
		const reason = error instanceof Error ? error.message : String(error);
		throw new CreateError(
			`${command} could not start: ${reason}\nThe project tree at ${dir} is written; install ${packageManager} and run the command again.`,
		);
	}
	if (exitCode !== 0) {
		throw new CreateError(
			`${command} failed with exit code ${exitCode}.\nThe project tree at ${dir} is written; run \`${command}\` in it to finish.`,
		);
	}
	return undefined;
}

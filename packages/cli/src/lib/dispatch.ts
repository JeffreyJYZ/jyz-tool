import type { CommandSpec, PackageManager, ProjectContext, Verb } from "@jyz/core";
import { buildArgv, resolveExecutable } from "@jyz/core";

export interface DispatchRequest {
	verb: Verb;
	args: string[];
	dev?: boolean;
	latest?: boolean;
}

/**
 * Turns one dispatch verb into the child command for the resolved package.
 *
 * Every verb goes through `buildArgv`, so the table in dispatch.md lives in core and the CLI only
 * chooses the executable and the working directory.
 */
export function buildDispatchSpec(ctx: ProjectContext, req: DispatchRequest): CommandSpec {
	const pm = ctx.config.project.package_manager.value;
	const cwd = ctx.packageDir;

	if (req.verb === "exec") return buildExecSpec(pm, cwd, req.args);

	const argv = buildArgv(pm, req);
	return { file: pm, argv, cwd };
}

/**
 * `exec` prefers a real `node_modules/.bin` entry and only then the package manager's runner.
 * `resolveExecutable` reports the fallback by returning the runner name itself, which is the only
 * sentinel it has, so the two names are compared exactly.
 */
function buildExecSpec(pm: PackageManager, cwd: string, args: string[]): CommandSpec {
	const bin = args[0];
	if (bin !== undefined) {
		const resolved = resolveExecutable(pm, cwd, bin);
		if (resolved !== "bunx" && resolved !== "pnpm") {
			return { file: resolved, argv: args.slice(1), cwd };
		}
	}
	// buildArgv names the runner: `bunx` is an executable, `exec` is a pnpm subcommand.
	const argv = buildArgv(pm, { verb: "exec", args });
	if (pm === "bun") return { file: argv[0] ?? "bunx", argv: argv.slice(1), cwd };
	return { file: "pnpm", argv, cwd };
}

/** The `--verbose` block: what jyz is about to spawn, and where. */
export function formatSpec(spec: CommandSpec): string {
	return [`file: ${spec.file}`, `argv: ${spec.argv.join(" ")}`, `cwd:  ${spec.cwd}`].join("\n");
}

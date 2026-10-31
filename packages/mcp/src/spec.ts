import type { ArgvRequest, CommandSpec, ProjectContext } from "@jyz/core";
import {
	buildArgv,
	buildCheckCommand,
	buildFmtCommand,
	buildLintCommand,
	buildTypecheckCommand,
	createProject,
	findConfigPath,
	readConfigFile,
	resolveExecutable,
	resolveProject,
	runCommand,
	writeConfigValue,
} from "@jyz/core";

export function asRecord(input: unknown): Record<string, unknown> {
	if (input !== null && typeof input === "object" && !Array.isArray(input)) {
		return input as Record<string, unknown>;
	}
	return {};
}

export function strArray(v: unknown): string[] {
	return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

export function resolveCtx(cwd: string, filter?: string): ProjectContext {
	return filter === undefined ? resolveProject(cwd) : resolveProject(cwd, { filter });
}

export async function runSpec(
	spec: CommandSpec,
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
	const r = await runCommand(spec, { stdio: "pipe" });
	return { exitCode: r.exitCode, stdout: r.stdout, stderr: r.stderr };
}

export async function runSpecs(
	specs: CommandSpec[],
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
	let exitCode = 0;
	let stdout = "";
	let stderr = "";
	for (const spec of specs) {
		const r = await runSpec(spec);
		exitCode = r.exitCode;
		stdout += r.stdout;
		stderr += r.stderr;
		if (exitCode !== 0) break;
	}
	return { exitCode, stdout, stderr };
}

export function dispatchSpec(
	ctx: ProjectContext,
	verb: string,
	input: Record<string, unknown>,
): CommandSpec {
	const pm = ctx.config.project.package_manager.value;
	const cwd = ctx.packageDir;
	const req: ArgvRequest = {
		verb: verb as ArgvRequest["verb"],
		args: strArray(input.args),
		dev: input.dev === true,
		latest: input.latest === true,
	};
	if (verb === "exec") {
		const args = strArray(input.args);
		const bin = args[0];
		if (bin !== undefined) {
			const resolved = resolveExecutable(pm, cwd, bin);
			if (resolved !== "bunx" && resolved !== "pnpm") {
				return { file: resolved, argv: args.slice(1), cwd };
			}
		}
		const argv = buildArgv(pm, { verb: "exec", args });
		if (pm === "bun") return { file: argv[0] ?? "bunx", argv: argv.slice(1), cwd };
		return { file: "pnpm", argv, cwd };
	}
	const argv = buildArgv(pm, req);
	return { file: pm, argv, cwd };
}

export {
	buildCheckCommand,
	buildFmtCommand,
	buildLintCommand,
	buildTypecheckCommand,
	createProject,
	findConfigPath,
	readConfigFile,
	writeConfigValue,
};

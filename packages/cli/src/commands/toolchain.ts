import type { CommandSpec, ProjectContext } from "@jyz/core";
import {
	buildCheckCommand,
	buildFmtCommand,
	buildLintCommand,
	buildTypecheckCommand,
	resolveProject,
} from "@jyz/core";
import type { CAC } from "cac";
import { formatSpec } from "../lib/dispatch.ts";
import { runSpec } from "../lib/run.ts";

/** One half of `jyz check`, paired with the command that runs it. */
export interface CheckStep {
	half: "typecheck" | "lint";
	spec: CommandSpec;
}

export interface ToolchainRunOptions {
	/** Print each resolved command before spawning it, as the dispatch verbs do. */
	verbose?: boolean;
	/** Where the verbose block and the check headings go. */
	log?: (line: string) => void;
	/** Replaces the spawn, for tests that must not run a real tool. */
	run?: (spec: CommandSpec) => Promise<number>;
}

function forwarded(args: string[]): string[] {
	return args.filter((arg) => arg !== "--verbose");
}

async function execute(spec: CommandSpec, options: ToolchainRunOptions): Promise<number> {
	if (options.verbose === true) (options.log ?? console.log)(formatSpec(spec));
	if (options.run !== undefined) return options.run(spec);
	return runSpec(spec);
}

/** Builds the ordered list of halves `jyz check` will run, one entry per applicable tool. */
export function buildCheckSteps(ctx: ProjectContext, args: string[] = []): CheckStep[] {
	const specs = buildCheckCommand(ctx, forwarded(args));
	const halves: Array<"typecheck" | "lint"> = [];
	if (ctx.config.project.typechecker.value !== "none") halves.push("typecheck");
	if (ctx.config.project.linter.value !== "none") halves.push("lint");
	const steps: CheckStep[] = [];
	for (const [index, spec] of specs.entries()) {
		const half = halves[index];
		if (half === undefined) continue;
		steps.push({ half, spec });
	}
	return steps;
}

/** Runs every half in order, even after a failure, and returns the exit code to use. */
export async function runCheckPlan(
	steps: readonly CheckStep[],
	options: ToolchainRunOptions = {},
): Promise<number> {
	const log = options.log ?? ((line: string) => console.log(line));
	let code = 0;
	for (const { half, spec } of steps) {
		log(`jyz check: ${half}`);
		const result = await execute(spec, { ...options, log });
		if (result !== 0) code = result;
	}
	return code;
}

export function registerToolchain(cli: CAC): void {
	cli.command("lint [args...]", "run the configured linter")
		.option("--verbose", "print the resolved command before running")
		.action(async (args: string[], options: { verbose?: boolean }) => {
			const ctx = resolveProject(process.cwd());
			const spec = buildLintCommand(ctx, forwarded(args));
			const r = await execute(spec, { verbose: options?.verbose });
			process.exitCode = r;
		});

	cli.command("typecheck [args...]", "run the configured typechecker")
		.option("--verbose", "print the resolved command before running")
		.action(async (args: string[], options: { verbose?: boolean }) => {
			const ctx = resolveProject(process.cwd());
			const spec = buildTypecheckCommand(ctx, forwarded(args));
			const r = await execute(spec, { verbose: options?.verbose });
			process.exitCode = r;
		});

	cli.command("check [args...]", "run typecheck then lint")
		.option("--verbose", "print the resolved command before running")
		.action(async (args: string[], options: { verbose?: boolean }) => {
			const ctx = resolveProject(process.cwd());
			const steps = buildCheckSteps(ctx, forwarded(args));
			const code = await runCheckPlan(steps, { verbose: options?.verbose });
			process.exitCode = code;
		});

	cli.command("fmt", "format the project")
		.option("--check", "check only")
		.option("--verbose", "print the resolved command before running")
		.action(async (options: { check?: boolean; verbose?: boolean }) => {
			const ctx = resolveProject(process.cwd());
			const spec = buildFmtCommand(ctx, { check: options?.check });
			const r = await execute(spec, { verbose: options?.verbose });
			process.exitCode = r;
		});
}

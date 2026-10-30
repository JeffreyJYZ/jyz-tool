import {
	buildCheckCommand,
	buildFmtCommand,
	buildLintCommand,
	buildTypecheckCommand,
	resolveProject,
	runCommand,
} from "@jyz/core";
import type { CAC } from "cac";

export function registerToolchain(cli: CAC): void {
	cli.command("lint [args...]", "run the configured linter").action(async (args: string[]) => {
		const ctx = resolveProject(process.cwd());
		const spec = buildLintCommand(ctx, args);
		const r = await runCommand(spec);
		process.exitCode = r.exitCode;
	});

	cli.command("typecheck [args...]", "run the configured typechecker").action(
		async (args: string[]) => {
			const ctx = resolveProject(process.cwd());
			const spec = buildTypecheckCommand(ctx, args);
			const r = await runCommand(spec);
			process.exitCode = r.exitCode;
		},
	);

	cli.command("check [args...]", "run typecheck then lint").action(async (args: string[]) => {
		const ctx = resolveProject(process.cwd());
		const specs = buildCheckCommand(ctx, args);
		let code = 0;
		for (const spec of specs) {
			const r = await runCommand(spec);
			if (r.exitCode !== 0) code = r.exitCode;
		}
		process.exitCode = code;
	});

	cli.command("fmt", "format the project")
		.option("--check", "check only")
		.action(async (options: { check?: boolean }) => {
			const ctx = resolveProject(process.cwd());
			const spec = buildFmtCommand(ctx, { check: options?.check });
			const r = await runCommand(spec);
			process.exitCode = r.exitCode;
		});
}

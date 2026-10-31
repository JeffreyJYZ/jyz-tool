import type { CommandSpec } from "../types/command.ts";
import type { ProjectContext } from "../types/project.ts";
import { buildLintCommand } from "./build-lint.ts";
import { buildTypecheckCommand } from "./build-typecheck.ts";
import type { PathsInput } from "./toolchain-helpers.ts";
import { ToolchainError } from "./toolchain-helpers.ts";

export { buildFmtCommand } from "./build-fmt.ts";
export { buildLintCommand } from "./build-lint.ts";
export { buildTypecheckCommand } from "./build-typecheck.ts";
export { ToolchainError };

export function buildCheckCommand(
	ctx: ProjectContext,
	paths?: PathsInput,
	extra?: string[],
): CommandSpec[] {
	const tc = ctx.config.project.typechecker.value;
	const linter = ctx.config.project.linter.value;
	const specs: CommandSpec[] = [];
	if (tc !== "none") {
		specs.push(buildTypecheckCommand(ctx, paths, extra));
	}
	if (linter !== "none") {
		specs.push(buildLintCommand(ctx, paths, extra));
	}
	if (specs.length === 0) {
		throw new ToolchainError(
			"none",
			"project.typechecker/project.linter",
			"nothing to check: no typechecker and no linter configured (config keys: project.typechecker, project.linter)",
		);
	}
	return specs;
}

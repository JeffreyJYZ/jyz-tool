import type { CommandSpec } from "../types/command.ts";
import type { ProjectContext } from "../types/project.ts";
import type { PathsInput } from "./toolchain-helpers.ts";
import { requireBin, splitPaths, ToolchainError } from "./toolchain-helpers.ts";

export function buildLintCommand(
	ctx: ProjectContext,
	paths?: PathsInput,
	extra?: string[],
): CommandSpec {
	const linter = ctx.config.project.linter.value;
	const configKey = "project.linter";
	if (linter === "none") {
		throw new ToolchainError(
			"none",
			configKey,
			`no linter configured (config key: ${configKey})`,
		);
	}
	const { paths: p, extra: e } = splitPaths(paths, extra);
	switch (linter) {
		case "biome": {
			const bin = requireBin(ctx, "biome", configKey, "biome");
			return { file: bin, argv: ["check", ...p, ...e], cwd: ctx.packageDir };
		}
		case "eslint": {
			const bin = requireBin(ctx, "eslint", configKey, "eslint");
			return { file: bin, argv: [...p, ...e], cwd: ctx.packageDir };
		}
		case "bun-lint": {
			const bin = requireBin(ctx, "bun", configKey, "bun");
			return { file: bin, argv: ["lint", ...e], cwd: ctx.packageDir };
		}
		case "cargo-clippy": {
			const bin = requireBin(ctx, "cargo", configKey, "cargo");
			return {
				file: bin,
				argv: ["clippy", "--", "-D", "warnings", ...e],
				cwd: ctx.packageDir,
			};
		}
		case "clang-tidy": {
			const bin = requireBin(ctx, "clang-tidy", configKey, "clang-tidy");
			return { file: bin, argv: [...p, ...e], cwd: ctx.packageDir };
		}
		default:
			throw new ToolchainError(
				String(linter),
				configKey,
				`${linter} does not resolve (config key: ${configKey})`,
			);
	}
}

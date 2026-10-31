import type { CommandSpec } from "../types/command.ts";
import type { ProjectContext } from "../types/project.ts";
import type { PathsInput } from "./toolchain-helpers.ts";
import { requireBin, splitPaths, ToolchainError } from "./toolchain-helpers.ts";

export function buildTypecheckCommand(
	ctx: ProjectContext,
	paths?: PathsInput,
	extra?: string[],
): CommandSpec {
	const tc = ctx.config.project.typechecker.value;
	const configKey = "project.typechecker";
	if (tc === "none") {
		throw new ToolchainError(
			"none",
			configKey,
			`no typechecker configured (config key: ${configKey})`,
		);
	}
	const { paths: p, extra: e } = splitPaths(paths, extra);
	switch (tc) {
		case "bun-check": {
			const bin = requireBin(ctx, "bun", configKey, "bun");
			return { file: bin, argv: ["check", ...e], cwd: ctx.packageDir };
		}
		case "tsc": {
			const bin = requireBin(ctx, "tsc", configKey, "tsc");
			return { file: bin, argv: ["--noEmit", ...e], cwd: ctx.packageDir };
		}
		case "tsgo": {
			const bin = requireBin(ctx, "tsgo", configKey, "tsgo");
			return { file: bin, argv: ["--noEmit", ...e], cwd: ctx.packageDir };
		}
		case "tsrs": {
			const bin = requireBin(ctx, "tsrs", configKey, "tsrs");
			return { file: bin, argv: ["--noEmit", ...e], cwd: ctx.packageDir };
		}
		case "cargo": {
			const bin = requireBin(ctx, "cargo", configKey, "cargo");
			return { file: bin, argv: ["check", ...e], cwd: ctx.packageDir };
		}
		case "clang": {
			const bin = requireBin(ctx, "clang", configKey, "clang");
			return { file: bin, argv: ["-fsyntax-only", ...p, ...e], cwd: ctx.packageDir };
		}
		default:
			throw new ToolchainError(
				String(tc),
				configKey,
				`${tc} does not resolve (config key: ${configKey})`,
			);
	}
}

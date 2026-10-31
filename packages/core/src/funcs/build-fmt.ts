import type { CommandSpec } from "../types/command.ts";
import type { ProjectContext } from "../types/project.ts";
import type { PathsInput } from "./toolchain-helpers.ts";
import { requireBin, splitPaths, ToolchainError } from "./toolchain-helpers.ts";

export function buildFmtCommand(
	ctx: ProjectContext,
	options: { check?: boolean; paths?: string[]; args?: string[] } = {},
	paths?: PathsInput,
	extra?: string[],
): CommandSpec {
	const fmt = ctx.config.project.formatter.value;
	const configKey = "project.formatter";
	if (fmt === "none") {
		throw new ToolchainError(
			"none",
			configKey,
			`no formatter configured (config key: ${configKey})`,
		);
	}
	const merged = splitPaths(paths ?? options.paths ?? options.args, extra);
	const p = merged.paths;
	const e = merged.extra;
	const check = options.check === true;
	switch (fmt) {
		case "biome": {
			const bin = requireBin(ctx, "biome", configKey, "biome");
			return {
				file: bin,
				argv: check ? ["check"] : ["check", "--write"],
				cwd: ctx.packageDir,
			};
		}
		case "bun-fmt": {
			const bin = requireBin(ctx, "bun", configKey, "bun");
			return { file: bin, argv: check ? ["fmt", "--check"] : ["fmt"], cwd: ctx.packageDir };
		}
		case "prettier": {
			const bin = requireBin(ctx, "prettier", configKey, "prettier");
			return {
				file: bin,
				argv: check ? ["--check", ...p, ...e] : ["--write", ...p, ...e],
				cwd: ctx.packageDir,
			};
		}
		case "clang-format": {
			const bin = requireBin(ctx, "clang-format", configKey, "clang-format");
			return {
				file: bin,
				argv: check ? ["--dry-run", "--Werror", ...p, ...e] : ["-i", ...p, ...e],
				cwd: ctx.packageDir,
			};
		}
		case "rustfmt": {
			const bin = requireBin(ctx, "cargo", configKey, "cargo");
			return {
				file: bin,
				argv: check ? ["fmt", "--all", "--", "--check"] : ["fmt", "--all"],
				cwd: ctx.packageDir,
			};
		}
		default:
			throw new ToolchainError(
				String(fmt),
				configKey,
				`${fmt} does not resolve (config key: ${configKey})`,
			);
	}
}

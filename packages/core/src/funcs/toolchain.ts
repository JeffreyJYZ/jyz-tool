import type { CommandSpec } from "../types/command.ts";
import type { ProjectContext } from "../types/project.ts";
import { resolveExecutable } from "./exec.ts";

export class ToolchainError extends Error {
	tool: string;
	configKey: string;
	constructor(tool: string, configKey: string, message: string) {
		super(message);
		this.name = "ToolchainError";
		this.tool = tool;
		this.configKey = configKey;
	}
}

function resolveBin(ctx: ProjectContext, bin: string): string {
	try {
		return resolveExecutable(ctx.config.project.package_manager.value, ctx.packageDir, bin);
	} catch {
		const found = Bun.which(bin);
		if (found) return found;
		throw new Error("not found");
	}
}

function requireBin(ctx: ProjectContext, tool: string, configKey: string, bin: string): string {
	let resolved: string;
	try {
		resolved = resolveBin(ctx, bin);
	} catch {
		resolved = "";
	}
	if (!resolved) {
		const fallback = Bun.which(bin);
		if (fallback) resolved = fallback;
	}
	// walk node_modules/.bin manually
	if (!resolved) {
		let dir = ctx.packageDir;
		for (let i = 0; i < 20; i++) {
			const cand = `${dir}/node_modules/.bin/${bin}`;
			try {
				if (Bun.file(cand).size >= 0) {
					resolved = cand;
					break;
				}
			} catch {
				// ignore
			}
			const parent = dir.replace(/\/[^/]+$/, "");
			if (parent === dir) break;
			dir = parent;
		}
	}
	if (!resolved) {
		throw new ToolchainError(
			tool,
			configKey,
			`${tool} does not resolve (config key: ${configKey})`,
		);
	}
	return resolved;
}

type PathsInput = string[] | { paths?: string[]; args?: string[] } | undefined;

function splitPaths(input: PathsInput, extra?: string[]): { paths: string[]; extra: string[] } {
	let paths = ["."];
	let rest = extra ? [...extra] : [];
	if (Array.isArray(input)) {
		if (input.length > 0) paths = [...input];
	} else if (input && typeof input === "object") {
		if (Array.isArray(input.paths) && input.paths.length > 0) paths = [...input.paths];
		if (Array.isArray(input.args)) rest = [...rest, ...input.args];
	}
	return { paths, extra: rest };
}

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

/**
 * Runs typecheck first and then lint, one spec per applicable half. Skips any half whose tool is
 * `none`; throws `ToolchainError` naming both keys when neither half applies. The order is part
 * of the contract: `jyz check` labels each spec by its position (typecheck, then lint).
 */
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

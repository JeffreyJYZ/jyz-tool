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

export function requireBin(
	ctx: ProjectContext,
	tool: string,
	configKey: string,
	bin: string,
): string {
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

export function resolveBin(ctx: ProjectContext, bin: string): string {
	try {
		return resolveExecutable(ctx.config.project.package_manager.value, ctx.packageDir, bin);
	} catch {
		const found = Bun.which(bin);
		if (found) return found;
		throw new Error("not found");
	}
}

export type PathsInput = string[] | { paths?: string[]; args?: string[] } | undefined;

export function splitPaths(
	input: PathsInput,
	extra?: string[],
): { paths: string[]; extra: string[] } {
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

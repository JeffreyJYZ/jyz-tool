import { statSync } from "node:fs";

import { CONFIG_FILENAME } from "../../const/defaults.ts";
import type { JyzConfig, Source } from "../../types/config.ts";

export interface LoadConfigOptions {
	flags?: Partial<
		Pick<JyzConfig["project"], "package_manager" | "typechecker" | "linter" | "formatter">
	>;
	detected?: {
		package_manager?: import("../../types/config.ts").PackageManager;
		typechecker?: import("../../types/config.ts").Typechecker;
		linter?: import("../../types/config.ts").Linter;
		formatter?: import("../../types/config.ts").Formatter;
	};
}

export function existsAsFile(path: string): boolean {
	try {
		return statSync(path).isFile();
	} catch {
		return false;
	}
}

export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function includesString(values: readonly string[], value: string): boolean {
	return values.includes(value);
}

export function messageOf(err: unknown): string {
	return err instanceof Error ? err.message : String(err);
}

export function isNotFound(err: unknown): boolean {
	return typeof err === "object" && err !== null && "code" in err && err.code === "ENOENT";
}

export function describe(value: unknown): string {
	return typeof value === "string" ? JSON.stringify(value) : String(value);
}

export function tableAt(
	root: Record<string, unknown>,
	section: string,
	warnings: string[],
): Record<string, unknown> | undefined {
	const value = root[section];
	if (value === undefined) return undefined;
	if (!isRecord(value)) {
		warnings.push(`config section "${section}" must be a table; ignoring`);
		return undefined;
	}
	return value;
}

export function warnUnknownKeys(
	prefix: string,
	table: Record<string, unknown>,
	known: readonly string[],
	warnings: string[],
): void {
	for (const key of Object.keys(table)) {
		if (includesString(known, key)) continue;
		warnings.push(`unknown config key "${prefix}.${key}"`);
	}
}

export function pickEnum<T extends string>(
	dotted: string,
	value: unknown,
	allowed: readonly T[],
	warnings: string[],
): T | undefined {
	if (value === undefined) return undefined;
	if (typeof value === "string" && includesString(allowed, value)) return value as T;
	warnings.push(
		`config key "${dotted}" must be one of ${allowed.join(", ")}, got ${describe(value)}; ignoring`,
	);
	return undefined;
}

export function pickString(dotted: string, value: unknown, warnings: string[]): string | undefined {
	if (value === undefined) return undefined;
	if (typeof value === "string") return value;
	warnings.push(`config key "${dotted}" must be a string, got ${describe(value)}; ignoring`);
	return undefined;
}

export function pickBoolean(
	dotted: string,
	value: unknown,
	warnings: string[],
): boolean | undefined {
	if (value === undefined) return undefined;
	if (typeof value === "boolean") return value;
	warnings.push(`config key "${dotted}" must be a boolean, got ${describe(value)}; ignoring`);
	return undefined;
}

export function readStringMap(
	root: Record<string, unknown>,
	section: string,
	warnings: string[],
): Record<string, string> | undefined {
	const table = tableAt(root, section, warnings);
	if (table === undefined) return undefined;
	const out: Record<string, string> = {};
	for (const [key, value] of Object.entries(table)) {
		if (typeof value === "string") out[key] = value;
		else
			warnings.push(
				`config key "${section}.${key}" must be a string, got ${describe(value)}`,
			);
	}
	return out;
}

export type { Source };
export { CONFIG_FILENAME };

export interface Candidate {
	raw: unknown;
	source: string;
	label: string;
}

export type Resolved<T> = { value: T; source: string };

export function choose<T extends string>(
	allowed: readonly string[],
	candidates: Candidate[],
	detected: T | undefined,
	fallback: T,
	warnings: string[],
): Resolved<T> {
	for (const candidate of candidates) {
		if (candidate.raw === undefined) continue;
		const value = String(candidate.raw).trim();
		if (value === "" || value === "auto") continue;
		if (allowed.includes(value)) return { value: value as T, source: candidate.source };
		warnings.push(
			`${candidate.label} must be one of ${allowed.join(", ")}, got ${JSON.stringify(candidate.raw)}; ignoring`,
		);
	}
	if (detected !== undefined) return { value: detected, source: "detected" };
	return { value: fallback, source: "default" };
}

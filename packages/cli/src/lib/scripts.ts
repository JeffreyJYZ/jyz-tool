import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { CommandSpec, PackageManager } from "@jyz/core";
import { buildArgv } from "@jyz/core";

export interface ScriptEntry {
	name: string;
	command: string;
	/** `config` wins over a same-named `package.json` script. */
	source: "config" | "package.json";
}

/** Merges the two script tables, config first, sorted by name. */
export function mergeScripts(
	configScripts: Record<string, string>,
	manifestScripts: Record<string, string>,
): ScriptEntry[] {
	const names = new Set([...Object.keys(manifestScripts), ...Object.keys(configScripts)]);
	return [...names].sort().map((name) => {
		const override = configScripts[name];
		if (override !== undefined) return { name, command: override, source: "config" };
		return { name, command: manifestScripts[name] ?? "", source: "package.json" };
	});
}

/** Reads `scripts` from a package.json, or an empty table when there is none. */
export function readPackageScripts(packageDir: string): Record<string, string> {
	let text: string;
	try {
		text = readFileSync(join(packageDir, "package.json"), "utf8");
	} catch {
		return {};
	}
	let manifest: { scripts?: Record<string, unknown> };
	try {
		manifest = JSON.parse(text) as { scripts?: Record<string, unknown> };
	} catch {
		return {};
	}
	const out: Record<string, string> = {};
	for (const [name, value] of Object.entries(manifest.scripts ?? {})) {
		if (typeof value === "string") out[name] = value;
	}
	return out;
}

/** `jyz run` with no script: one `name  command` line per script, aligned. */
export function formatScripts(entries: readonly ScriptEntry[]): string {
	const width = entries.reduce((max, entry) => Math.max(max, entry.name.length), 0);
	return entries.map((entry) => `${entry.name.padEnd(width)}  ${entry.command}`).join("\n");
}

/**
 * Splits a config script into argv without a shell. Quoted spans stay one token, so
 * `test --timeout "my value"` becomes three arguments and nothing is ever handed to `sh`.
 */
export function splitCommand(command: string): string[] {
	const tokens: string[] = [];
	let current = "";
	let started = false;
	let quote: '"' | "'" | null = null;

	for (const char of command) {
		if (quote !== null) {
			if (char === quote) quote = null;
			else current += char;
			continue;
		}
		if (char === '"' || char === "'") {
			quote = char;
			started = true;
			continue;
		}
		if (/\s/.test(char)) {
			if (started) {
				tokens.push(current);
				current = "";
				started = false;
			}
			continue;
		}
		current += char;
		started = true;
	}
	if (started) tokens.push(current);
	return tokens;
}

/**
 * Resolves one script to a command: a config override runs its own argv, anything else delegates
 * to `<pm> run <name>` so package.json scripts keep the manager's semantics.
 */
export function buildScriptSpec(
	pm: PackageManager,
	cwd: string,
	name: string,
	configScripts: Record<string, string>,
	extra: readonly string[] = [],
): CommandSpec {
	const override = configScripts[name];
	if (override !== undefined) {
		const tokens = splitCommand(override);
		const file = tokens[0];
		if (file === undefined) throw new Error(`script "${name}" in jyz.config.toml is empty`);
		return { file, argv: [...tokens.slice(1), ...extra], cwd };
	}
	return { file: pm, argv: buildArgv(pm, { verb: "run", args: [name, ...extra] }), cwd };
}

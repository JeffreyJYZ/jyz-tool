import { writeFileSync } from "node:fs";

import { CONFIG_FILENAME, findConfigPath, readConfigFile, writeConfigValue } from "@jyz/core";
import type { CAC } from "cac";
import { formatConfigShow, lookupConfigValue, projectEntries } from "../lib/config-view.ts";
import { configPathIn, loadConfigAt } from "../lib/context.ts";
import { guard } from "../lib/errors.ts";
import { emit, isJson } from "../lib/output.ts";

interface ConfigFlags {
	strict?: boolean;
	json?: boolean;
}

/**
 * `jyz config` owns one file and five subcommands. cac v7 has no nested commands, so the subcommand
 * is the first positional and every shape is spelled out in the command's help.
 */
export function registerConfig(cli: CAC): void {
	cli.command("config [action] [key] [value]", "read and write jyz.config.toml")
		.option("--strict", "treat config warnings as errors")
		.option("--json", "emit machine-readable JSON")
		.usage("config show | get <key> | set <key> <value> | path | check [--strict]")
		.example("  jyz config show")
		.example("  jyz config get project.linter")
		.example("  jyz config get aliases.dev")
		.example("  jyz config set project.formatter biome")
		.example("  jyz config path")
		.example("  jyz config check --strict")
		.action(
			(
				action: string | undefined,
				key: string | undefined,
				value: string | undefined,
				flags: ConfigFlags,
			) => {
				void guard(async () => {
					runConfig(action ?? "show", key, value, flags ?? {});
				});
			},
		);
}

function runConfig(
	action: string,
	key: string | undefined,
	value: string | undefined,
	flags: ConfigFlags,
): void {
	const json = flags.json === true || isJson();
	const cwd = process.cwd();
	switch (action) {
		case "show": {
			const config = loadConfigAt(cwd);
			if (json) {
				const project: Record<string, { value: string; source: string }> = {};
				for (const entry of projectEntries(config)) {
					const bare = entry.key.slice("project.".length);
					project[bare] = { value: entry.value, source: entry.source };
				}
				emit({
					project,
					aliases: config.aliases,
					scripts: config.scripts,
					path: config.path,
					layers: config.layers,
					warnings: config.warnings,
				});
			} else {
				console.log(formatConfigShow(config));
			}
			return;
		}
		case "get": {
			if (key === undefined)
				throw new Error("jyz config get needs a key, e.g. project.linter");
			const config = loadConfigAt(cwd);
			const entry = lookupConfigValue(config, key);
			if (entry === null) {
				throw new Error(
					`unknown config key "${key}"; run jyz config show for the known keys`,
				);
			}
			if (json) emit({ key: entry.key, value: entry.value });
			else console.log(entry.value);
			return;
		}
		case "set": {
			if (key === undefined || value === undefined) {
				throw new Error(
					"jyz config set needs a key and a value, e.g. project.linter biome",
				);
			}
			const path = configPathIn(cwd);
			const { text } = writeConfigValue(path, key, value);
			writeFileSync(path, text, "utf8");
			if (json) emit({ path, key, value });
			else console.log(`${path}: set ${key} = ${value}`);
			return;
		}
		case "path": {
			const p = configPathIn(cwd);
			if (json) emit({ path: p });
			else console.log(p);
			return;
		}
		case "check": {
			const path = findConfigPath(cwd);
			if (path === null) {
				if (json) emit({ path: null, warnings: [], ok: false });
				else console.log(`no ${CONFIG_FILENAME} found from ${cwd}`);
				return;
			}
			const { warnings } = readConfigFile(path);
			if (warnings.length === 0) {
				if (json) emit({ path, warnings: [], ok: true });
				else console.log(`${path}: ok`);
				return;
			}
			for (const warning of warnings) console.error(`warning: ${warning} (${path})`);
			if (flags.strict === true) process.exitCode = 1;
			if (json) emit({ path, warnings, ok: warnings.length === 0 });
			return;
		}
		default: {
			throw new Error(
				`unknown config subcommand "${action}"; use show, get, set, path or check`,
			);
		}
	}
}

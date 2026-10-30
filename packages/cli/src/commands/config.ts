import { writeFileSync } from "node:fs";

import { CONFIG_FILENAME, findConfigPath, readConfigFile, writeConfigValue } from "@jyz/core";
import type { CAC } from "cac";
import { formatConfigShow, lookupConfigValue } from "../lib/config-view.ts";
import { configPathIn, loadConfigAt } from "../lib/context.ts";
import { guard } from "../lib/errors.ts";

interface ConfigFlags {
	strict?: boolean;
}

/**
 * `jyz config` owns one file and five subcommands. cac v7 has no nested commands, so the subcommand
 * is the first positional and every shape is spelled out in the command's help.
 */
export function registerConfig(cli: CAC): void {
	cli.command("config [action] [key] [value]", "read and write jyz.config.toml")
		.option("--strict", "treat config warnings as errors")
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
	const cwd = process.cwd();
	switch (action) {
		case "show": {
			console.log(formatConfigShow(loadConfigAt(cwd)));
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
			console.log(entry.value);
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
			console.log(`${path}: set ${key} = ${value}`);
			return;
		}
		case "path": {
			console.log(configPathIn(cwd));
			return;
		}
		case "check": {
			const path = findConfigPath(cwd);
			if (path === null) {
				console.log(`no ${CONFIG_FILENAME} found from ${cwd}`);
				return;
			}
			const { warnings } = readConfigFile(path);
			if (warnings.length === 0) {
				console.log(`${path}: ok`);
				return;
			}
			for (const warning of warnings) console.error(`warning: ${warning} (${path})`);
			if (flags.strict === true) process.exitCode = 1;
			return;
		}
		default: {
			throw new Error(
				`unknown config subcommand "${action}"; use show, get, set, path or check`,
			);
		}
	}
}

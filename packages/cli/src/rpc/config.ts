import { writeFileSync } from "node:fs";
import { CONFIG_FILENAME, findConfigPath, readConfigFile, writeConfigValue } from "@jyz/core";
import { formatConfigShow, lookupConfigValue } from "../lib/config-view.ts";
import { configPathIn, loadConfigAt } from "../lib/context.ts";
import type { CallParams } from "./params.ts";

export function configCall(cwd: string, input: CallParams): import("./server.ts").RpcResult {
	const action = input.action ?? "show";
	switch (action) {
		case "show":
			return { exitCode: 0, stdout: formatConfigShow(loadConfigAt(cwd)) };
		case "get": {
			if (input.key === undefined) {
				return failure("jyz config get needs a key, e.g. project.linter");
			}
			const entry = lookupConfigValue(loadConfigAt(cwd), input.key);
			if (entry === null) {
				return failure(
					`unknown config key "${input.key}"; run jyz config show for the known keys`,
				);
			}
			return { exitCode: 0, stdout: entry.value };
		}
		case "set": {
			if (input.key === undefined || input.value === undefined) {
				return failure("jyz config set needs a key and a value, e.g. project.linter biome");
			}
			const path = configPathIn(cwd);
			const { text } = writeConfigValue(path, input.key, input.value);
			writeFileSync(path, text, "utf8");
			return { exitCode: 0, stdout: `${path}: set ${input.key} = ${input.value}` };
		}
		case "path":
			return { exitCode: 0, stdout: configPathIn(cwd) };
		case "check": {
			const path = findConfigPath(cwd);
			if (path === null) {
				return { exitCode: 0, stdout: `no ${CONFIG_FILENAME} found from ${cwd}` };
			}
			const { warnings } = readConfigFile(path);
			if (warnings.length === 0) {
				return { exitCode: 0, stdout: `${path}: ok` };
			}
			const stderr = warnings.map((warning) => `warning: ${warning} (${path})`).join("\n");
			return { exitCode: input.strict === true ? 1 : 0, stderr };
		}
		default:
			return failure(
				`unknown config subcommand "${action}"; use show, get, set, path or check`,
			);
	}
}

export function createCall(input: CallParams): import("./server.ts").RpcResult {
	if (input.name === undefined || input.name === "") {
		return failure("jyz create needs a name");
	}
	return { exitCode: 0, argv: ["jyz", "create", input.name, ...(input.args ?? [])] };
}

function failure(message: string): import("./server.ts").RpcResult {
	return { exitCode: 1, stderr: message };
}

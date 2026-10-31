import { writeFileSync } from "node:fs";
import { findConfigPath, readConfigFile, writeConfigValue } from "@jyz/core";
import { resolveCtx } from "./spec.ts";
import type { ToolResponse } from "./types.ts";

export function handleConfig(i: Record<string, unknown>, cwd: string): ToolResponse {
	const action = typeof i.action === "string" ? i.action : "show";
	const key = typeof i.key === "string" ? i.key : undefined;
	const value = typeof i.value === "string" ? i.value : undefined;
	const strict = i.strict === true;
	const ctx = resolveCtx(cwd, typeof i.filter === "string" ? i.filter : undefined);
	const packageDir = ctx.packageDir;
	const config = ctx.config;
	switch (action) {
		case "show":
			return {
				exitCode: 0,
				argv: [],
				packageDir,
				stdout: JSON.stringify(config),
				stderr: "",
			};
		case "get": {
			if (key === undefined)
				return { exitCode: 1, argv: [], packageDir, stdout: "", stderr: "missing key" };
			const bare = key.startsWith("project.") ? key.slice("project.".length) : key;
			const projKeys = ["package_manager", "typechecker", "linter", "formatter"];
			let found: string | null = null;
			if (projKeys.includes(bare)) {
				found = config.project[bare as keyof typeof config.project].value;
			} else {
				const [section, ...tail] = key.split(".");
				const rest = tail.join(".");
				if (section === "aliases") found = config.aliases[rest] ?? null;
				else if (section === "scripts") found = config.scripts[rest] ?? null;
				else if (section === "create") {
					const ck = ["default_template", "default_package_manager", "git"];
					if (ck.includes(rest))
						found = String(config.create[rest as keyof typeof config.create]);
				} else if (section === "monorepo" && rest === "default_filter") {
					found = String(config.monorepo.default_filter);
				}
			}
			if (found === null)
				return {
					exitCode: 1,
					argv: [],
					packageDir,
					stdout: "",
					stderr: `unknown config key "${key}"`,
				};
			return { exitCode: 0, argv: [], packageDir, stdout: found, stderr: "" };
		}
		case "set": {
			if (key === undefined || value === undefined)
				return {
					exitCode: 1,
					argv: [],
					packageDir,
					stdout: "",
					stderr: "missing key or value",
				};
			const path = findConfigPath(cwd) ?? `${cwd}/jyz.config.toml`;
			const { text } = writeConfigValue(path, key, value);
			writeFileSync(path, text, "utf8");
			return {
				exitCode: 0,
				argv: [],
				packageDir,
				stdout: `${path}: set ${key} = ${value}`,
				stderr: "",
			};
		}
		case "check": {
			const path = findConfigPath(cwd);
			if (path === null)
				return {
					exitCode: 0,
					argv: [],
					packageDir,
					stdout: `no jyz.config.toml found from ${cwd}`,
					stderr: "",
				};
			const { warnings } = readConfigFile(path);
			if (warnings.length === 0)
				return { exitCode: 0, argv: [], packageDir, stdout: `${path}: ok`, stderr: "" };
			return {
				exitCode: strict ? 1 : 0,
				argv: [],
				packageDir,
				stdout: "",
				stderr: warnings.map((w) => `warning: ${w} (${path})`).join("\n"),
			};
		}
		default:
			return {
				exitCode: 1,
				argv: [],
				packageDir,
				stdout: "",
				stderr: `unknown config action "${action}"`,
			};
	}
}

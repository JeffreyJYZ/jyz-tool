import { writeFileSync } from "node:fs";
import type { ArgvRequest, CommandSpec, ProjectContext } from "@jyz/core";
import {
	buildArgv,
	buildCheckCommand,
	buildFmtCommand,
	buildLintCommand,
	buildTypecheckCommand,
	createProject,
	findConfigPath,
	loadConfig,
	readConfigFile,
	resolveExecutable,
	resolveProject,
	runCommand,
	writeConfigValue,
} from "@jyz/core";
import { listTools } from "./tools.ts";

export interface ToolResult {
	exitCode: number;
	argv: string[];
	packageDir: string;
	stdout: string;
	stderr: string;
}

export class UnknownToolError extends Error {
	readonly validNames: string[];
	constructor(name: string, validNames: string[]) {
		super(`unknown tool "${name}"; valid tools: ${validNames.join(", ")}`);
		this.name = "UnknownToolError";
		this.validNames = validNames;
	}
}

const VALID_NAMES = listTools().map((t) => t.name);

function asRecord(input: unknown): Record<string, unknown> {
	if (input !== null && typeof input === "object" && !Array.isArray(input)) {
		return input as Record<string, unknown>;
	}
	return {};
}

function strArray(v: unknown): string[] {
	return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

function resolveCtx(cwd: string, filter?: string): ProjectContext {
	return filter === undefined ? resolveProject(cwd) : resolveProject(cwd, { filter });
}

async function runSpec(
	spec: CommandSpec,
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
	const r = await runCommand(spec, { stdio: "pipe" });
	return { exitCode: r.exitCode, stdout: r.stdout, stderr: r.stderr };
}

async function runSpecs(
	specs: CommandSpec[],
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
	let exitCode = 0;
	let stdout = "";
	let stderr = "";
	for (const spec of specs) {
		const r = await runSpec(spec);
		exitCode = r.exitCode;
		stdout += r.stdout;
		stderr += r.stderr;
		if (exitCode !== 0) break;
	}
	return { exitCode, stdout, stderr };
}

function dispatchSpec(
	ctx: ProjectContext,
	verb: string,
	input: Record<string, unknown>,
): CommandSpec {
	const pm = ctx.config.project.package_manager.value;
	const cwd = ctx.packageDir;
	const req: ArgvRequest = {
		verb: verb as ArgvRequest["verb"],
		args: strArray(input.args),
		dev: input.dev === true,
		latest: input.latest === true,
	};
	if (verb === "exec") {
		const args = strArray(input.args);
		const bin = args[0];
		if (bin !== undefined) {
			const resolved = resolveExecutable(pm, cwd, bin);
			if (resolved !== "bunx" && resolved !== "pnpm") {
				return { file: resolved, argv: args.slice(1), cwd };
			}
		}
		const argv = buildArgv(pm, { verb: "exec", args });
		if (pm === "bun") return { file: argv[0] ?? "bunx", argv: argv.slice(1), cwd };
		return { file: "pnpm", argv, cwd };
	}
	const argv = buildArgv(pm, req);
	return { file: pm, argv, cwd };
}

export async function callTool(name: string, input: unknown, cwd: string): Promise<ToolResult> {
	if (!VALID_NAMES.includes(name)) {
		throw new UnknownToolError(name, VALID_NAMES);
	}
	const i = asRecord(input);

	switch (name) {
		case "jyz_install":
		case "jyz_add":
		case "jyz_remove":
		case "jyz_run":
		case "jyz_update":
		case "jyz_outdated": {
			const verb = name.replace("jyz_", "");
			const v = verb === "remove" ? "remove" : verb;
			const ctx = resolveCtx(cwd, typeof i.filter === "string" ? i.filter : undefined);
			const spec = dispatchSpec(ctx, v, i);
			const r = await runSpec(spec);
			return {
				exitCode: r.exitCode,
				argv: spec.argv,
				packageDir: ctx.packageDir,
				stdout: r.stdout,
				stderr: r.stderr,
			};
		}
		case "jyz_exec": {
			const ctx = resolveCtx(cwd, typeof i.filter === "string" ? i.filter : undefined);
			const spec = dispatchSpec(ctx, "exec", i);
			const r = await runSpec(spec);
			return {
				exitCode: r.exitCode,
				argv: spec.argv,
				packageDir: ctx.packageDir,
				stdout: r.stdout,
				stderr: r.stderr,
			};
		}
		case "jyz_create": {
			const opts = {
				name: String(i.name ?? ""),
				template: i.template as any,
				dir: typeof i.dir === "string" ? i.dir : undefined,
				packageManager: i.packageManager as any,
				typechecker: i.typechecker as any,
				linter: i.linter as any,
				formatter: i.formatter as any,
				docs: i.docs === true,
				git: i.git as any,
				install: i.install === true,
				publishable: i.publishable === true,
				yes: i.yes === true,
			};
			const result = await createProject(opts as any, cwd);
			return {
				exitCode: 0,
				argv: [],
				packageDir: result.dir,
				stdout: result.files.join("\n"),
				stderr: result.warnings.join("\n"),
			};
		}
		case "jyz_config": {
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
						return {
							exitCode: 1,
							argv: [],
							packageDir,
							stdout: "",
							stderr: "missing key",
						};
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
						return {
							exitCode: 0,
							argv: [],
							packageDir,
							stdout: `${path}: ok`,
							stderr: "",
						};
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
		case "jyz_typecheck": {
			const ctx = resolveCtx(cwd, typeof i.filter === "string" ? i.filter : undefined);
			const spec = buildTypecheckCommand(ctx, strArray(i.args));
			const r = await runSpec(spec);
			return {
				exitCode: r.exitCode,
				argv: spec.argv,
				packageDir: ctx.packageDir,
				stdout: r.stdout,
				stderr: r.stderr,
			};
		}
		case "jyz_lint": {
			const ctx = resolveCtx(cwd, typeof i.filter === "string" ? i.filter : undefined);
			const spec = buildLintCommand(ctx, strArray(i.args));
			const r = await runSpec(spec);
			return {
				exitCode: r.exitCode,
				argv: spec.argv,
				packageDir: ctx.packageDir,
				stdout: r.stdout,
				stderr: r.stderr,
			};
		}
		case "jyz_check": {
			const ctx = resolveCtx(cwd, typeof i.filter === "string" ? i.filter : undefined);
			const specs = buildCheckCommand(ctx, strArray(i.args));
			const r = await runSpecs(specs);
			return {
				exitCode: r.exitCode,
				argv: specs[0]?.argv ?? [],
				packageDir: ctx.packageDir,
				stdout: r.stdout,
				stderr: r.stderr,
			};
		}
		case "jyz_fmt": {
			const ctx = resolveCtx(cwd, typeof i.filter === "string" ? i.filter : undefined);
			const spec = buildFmtCommand(ctx, { check: i.check === true });
			const r = await runSpec(spec);
			return {
				exitCode: r.exitCode,
				argv: spec.argv,
				packageDir: ctx.packageDir,
				stdout: r.stdout,
				stderr: r.stderr,
			};
		}
		default: {
			throw new UnknownToolError(name, VALID_NAMES);
		}
	}
}

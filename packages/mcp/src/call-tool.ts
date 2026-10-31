import {
	buildCheckCommand,
	buildFmtCommand,
	buildLintCommand,
	buildTypecheckCommand,
	createProject,
} from "@jyz/core";
import { handleConfig } from "./config-tool.ts";
import { ToolInputError, UnknownHandleError, UnknownToolError } from "./errors.ts";
import { asRecord, dispatchSpec, resolveCtx, runSpec, runSpecs, strArray } from "./spec.ts";
import { getStream, normalizeTarget, startWatch, stopStream } from "./stream.ts";
import { listTools } from "./tools.ts";
import type { CallTarget, ToolResponse } from "./types.ts";

const VALID_NAMES = listTools().map((t) => t.name);

export function callTool(
	name: "jyz_watch",
	input: unknown,
	target?: CallTarget,
): Promise<import("./types.ts").StreamStart>;
export function callTool(
	name: "jyz_cancel",
	input: unknown,
	target?: CallTarget,
): Promise<import("./types.ts").CancelResult>;
export function callTool(name: string, input: unknown, target?: CallTarget): Promise<ToolResponse>;
export async function callTool(
	name: string,
	input: unknown,
	target?: CallTarget,
): Promise<ToolResponse> {
	const options = normalizeTarget(target);
	const cwd = options.cwd ?? process.cwd();
	if (!VALID_NAMES.includes(name)) {
		throw new UnknownToolError(name, VALID_NAMES);
	}
	const i = asRecord(input);

	switch (name) {
		case "jyz_watch":
			return startWatch(i, options, dispatchSpec, strArray);
		case "jyz_cancel": {
			const handle = typeof i.handle === "string" ? i.handle : "";
			if (handle === "") throw new ToolInputError("jyz_cancel", "a handle is required");
			const entry = getStream(handle);
			if (entry === undefined) throw new UnknownHandleError(handle);
			const stopped = await stopStream(entry);
			return { handle, cancelled: true, stopped, argv: entry.argv };
		}
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
				template: i.template as unknown,
				dir: typeof i.dir === "string" ? i.dir : undefined,
				packageManager: i.packageManager as unknown,
				typechecker: i.typechecker as unknown,
				linter: i.linter as unknown,
				formatter: i.formatter as unknown,
				docs: i.docs === true,
				git: i.git as unknown,
				install: i.install === true,
				publishable: i.publishable === true,
				yes: i.yes === true,
			};
			const result = await createProject(opts as Parameters<typeof createProject>[0], cwd);
			return {
				exitCode: 0,
				argv: [],
				packageDir: result.dir,
				stdout: result.files.join("\n"),
				stderr: result.warnings.join("\n"),
			};
		}
		case "jyz_config":
			return handleConfig(i, cwd);
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

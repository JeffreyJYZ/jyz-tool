import type { Verb } from "@jyz/core";
import {
	buildCheckCommand,
	buildFmtCommand,
	buildLintCommand,
	buildTypecheckCommand,
	resolveProject,
} from "@jyz/core";
import type { Capability } from "../../../core/src/funcs/capabilities.ts";
import { findCapability, listCapabilities } from "../../../core/src/funcs/capabilities.ts";
import { resolveContext } from "../lib/context.ts";
import { buildDispatchSpec } from "../lib/dispatch.ts";
import { configCall, createCall } from "./config.ts";
import type { CallParams } from "./params.ts";
import { readParams } from "./params.ts";

export {
	INTERNAL_ERROR,
	INVALID_PARAMS,
	METHOD_NOT_FOUND,
	PARSE_ERROR,
	RpcError,
} from "./errors.ts";

import { METHOD_NOT_FOUND, RpcError } from "./errors.ts";

export interface RpcResult {
	exitCode: number;
	argv?: string[];
	stdout?: string;
	stderr?: string;
}

export interface RpcServerOptions {
	cwd: string;
}

export interface RpcServer {
	readonly cwd: string;
	capabilities(): Capability[];
	call(method: string, params?: unknown): Promise<RpcResult>;
}

export function createRpcServer(options: RpcServerOptions): RpcServer {
	const cwd = options.cwd;
	return {
		cwd,
		capabilities: () => listCapabilities(),
		async call(method: string, params?: unknown): Promise<RpcResult> {
			const capability = findCapability(method);
			if (capability === null) {
				throw new RpcError(METHOD_NOT_FOUND, `unknown method "${method}"`);
			}
			const input = readParams(params);
			try {
				switch (capability.kind) {
					case "dispatch":
						return dispatchCall(cwd, capability.name as Verb, input);
					case "toolchain":
						return toolchainCall(cwd, capability.name, input);
					case "config":
						return configCall(cwd, input);
					case "create":
						return createCall(input);
				}
			} catch (error) {
				if (error instanceof RpcError) throw error;
				return failure(messageOf(error));
			}
		},
	};
}

function words(spec: { file: string; argv: string[] }): string[] {
	return [spec.file, ...spec.argv];
}

function formatCommand(spec: { file: string; argv: string[] }): string {
	return words(spec).join(" ");
}

function failure(message: string): RpcResult {
	return { exitCode: 1, stderr: message };
}

function messageOf(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

function dispatchCall(cwd: string, verb: Verb, input: CallParams): RpcResult {
	const ctx = resolveContext(cwd, input.filter);
	const spec = buildDispatchSpec(ctx, {
		verb,
		args: input.args ?? [],
		dev: input.dev,
		latest: input.latest,
	});
	return { exitCode: 0, argv: words(spec) };
}

function toolchainCall(cwd: string, name: string, input: CallParams): RpcResult {
	const ctx = resolveProject(cwd);
	const args = input.args ?? [];
	switch (name) {
		case "lint":
			return { exitCode: 0, argv: words(buildLintCommand(ctx, args)) };
		case "typecheck":
			return { exitCode: 0, argv: words(buildTypecheckCommand(ctx, args)) };
		case "fmt":
			return {
				exitCode: 0,
				argv: words(buildFmtCommand(ctx, { check: input.check === true })),
			};
		default: {
			const specs = buildCheckCommand(ctx, args);
			const halves: string[] = [];
			if (ctx.config.project.typechecker.value !== "none") halves.push("typecheck");
			if (ctx.config.project.linter.value !== "none") halves.push("lint");
			const first = specs[0];
			if (specs.length === 1 && first !== undefined) {
				return { exitCode: 0, argv: words(first) };
			}
			const lines = specs.map(
				(spec, index) => `${halves[index] ?? "check"}: ${formatCommand(spec)}`,
			);
			return { exitCode: 0, stdout: lines.join("\n") };
		}
	}
}

import type { Verb } from "@jyz/core";
import {
	buildCheckCommand,
	buildFmtCommand,
	buildLintCommand,
	buildTypecheckCommand,
	resolveCommand,
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
	execute?: boolean;
	timeoutMs?: number;
}

export interface RpcServer {
	readonly cwd: string;
	capabilities(): Capability[];
	call(method: string, params?: unknown): Promise<RpcResult>;
}

const DEFAULT_TIMEOUT_MS = 60_000;

export function createRpcServer(options: RpcServerOptions): RpcServer {
	const cwd = options.cwd;
	const execute = options.execute === true;
	const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
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
				let result: RpcResult;
				switch (capability.kind) {
					case "dispatch":
						result = dispatchCall(cwd, capability.name as Verb, input);
						break;
					case "toolchain":
						result = toolchainCall(cwd, capability.name, input);
						break;
					case "config":
						result = configCall(cwd, input);
						break;
					case "create":
						result = createCall(input);
						break;
				}
				if (execute && result.argv !== undefined) {
					return await runArgv(result.argv, timeoutMs);
				}
				return result;
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

async function runArgv(argv: string[], timeoutMs: number): Promise<RpcResult> {
	const [file, ...args] = argv;
	try {
		const proc = Bun.spawn([resolveCommand(file ?? ""), ...args], {
			stdout: "pipe",
			stderr: "pipe",
			stdin: "ignore",
		});
		let timedOut = false;
		const timer = setTimeout(() => {
			timedOut = true;
			try {
				proc.kill();
			} catch {
				// ignore
			}
		}, timeoutMs);
		const [stdout, stderr, exitCode] = await Promise.all([
			new Response(proc.stdout).text(),
			new Response(proc.stderr).text(),
			proc.exited,
		]);
		clearTimeout(timer);
		if (timedOut) {
			return { exitCode: 124, stdout, stderr: stderr || "timeout", argv };
		}
		return { exitCode, stdout, stderr, argv };
	} catch (error) {
		const reason = error instanceof Error ? error.message : String(error);
		return { exitCode: 127, stdout: "", stderr: reason, argv };
	}
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

/**
 * The CLI JSON-RPC surface: one call per capability, resolved against one project directory.
 *
 * The server is a *resolver*, not a runner. `call` answers what the CLI would do — the exact child
 * command for a dispatch or toolchain verb, the printed text for a config read — and never spawns.
 * A caller that wants the effect spawns the returned `argv` itself, so a desktop client and the
 * terminal cannot drift and a stray frame cannot run `bun install` behind the user's back.
 *
 * Errors that are the user's (unknown config key, no project) are reported as `exitCode 1` plus
 * `stderr`, exactly as the CLI prints them. Only protocol faults throw `RpcError`.
 */
import { writeFileSync } from "node:fs";
import type { Verb } from "@jyz/core";
import {
	buildCheckCommand,
	buildFmtCommand,
	buildLintCommand,
	buildTypecheckCommand,
	CONFIG_FILENAME,
	findConfigPath,
	readConfigFile,
	resolveProject,
	writeConfigValue,
} from "@jyz/core";
import type { Capability } from "../../core/src/funcs/capabilities.ts";
import { findCapability, listCapabilities } from "../../core/src/funcs/capabilities.ts";
import { formatConfigShow, lookupConfigValue } from "./lib/config-view.ts";
import { configPathIn, loadConfigAt, resolveContext } from "./lib/context.ts";
import { buildDispatchSpec } from "./lib/dispatch.ts";

/** JSON-RPC 2.0 error codes this surface can answer with. */
export const PARSE_ERROR = -32700;
export const INVALID_PARAMS = -32602;
export const METHOD_NOT_FOUND = -32601;
export const INTERNAL_ERROR = -32603;

/** What one capability resolves to. Anything a user could see on a terminal lands in stdout/stderr. */
export interface RpcResult {
	exitCode: number;
	argv?: string[];
	stdout?: string;
	stderr?: string;
}

/** A protocol fault: an unknown method, unreadable params, or an internal failure. */
export class RpcError extends Error {
	readonly code: number;
	readonly data?: unknown;

	constructor(code: number, message: string, data?: unknown) {
		super(message);
		this.name = "RpcError";
		this.code = code;
		this.data = data;
	}
}

/** The parameters one capability accepts. `params` in the manifest names the positional subset. */
interface CallParams {
	args?: string[];
	dev?: boolean;
	latest?: boolean;
	filter?: string;
	check?: boolean;
	action?: string;
	key?: string;
	value?: string;
	strict?: boolean;
	name?: string;
}

export interface RpcServerOptions {
	/** The project directory every capability resolves against. */
	cwd: string;
}

export interface RpcServer {
	readonly cwd: string;
	/** The capability manifest, in registration order. */
	capabilities(): Capability[];
	/** Resolve one capability. Unknown methods throw `RpcError` with code `-32601`. */
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

/** One command as the words a caller would spawn. */
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

/**
 * `check` is the one capability that resolves to two commands, and a frame carries one argv, so it
 * reports the whole plan on stdout, one `half: command` line each, and sets argv only when a single
 * half applies.
 */
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

function configCall(cwd: string, input: CallParams): RpcResult {
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

/**
 * `create` scaffolds through core directly rather than spawning `jyz`, so the capability resolves to
 * the equivalent CLI invocation: a client shows the command, the user runs it.
 */
function createCall(input: CallParams): RpcResult {
	if (input.name === undefined || input.name === "") {
		return failure("jyz create needs a name");
	}
	return { exitCode: 0, argv: ["jyz", "create", input.name, ...(input.args ?? [])] };
}

function readParams(params: unknown): CallParams {
	if (params === undefined || params === null) return {};
	if (typeof params !== "object" || Array.isArray(params)) {
		throw new RpcError(INVALID_PARAMS, "params must be an object");
	}
	const raw = params as Record<string, unknown>;
	const out: CallParams = {};
	if (raw.args !== undefined) out.args = stringList(raw.args, "args");
	if (raw.dev !== undefined) out.dev = flag(raw.dev, "dev");
	if (raw.latest !== undefined) out.latest = flag(raw.latest, "latest");
	if (raw.filter !== undefined) out.filter = stringValue(raw.filter, "filter");
	if (raw.check !== undefined) out.check = flag(raw.check, "check");
	if (raw.action !== undefined) out.action = stringValue(raw.action, "action");
	if (raw.key !== undefined) out.key = stringValue(raw.key, "key");
	if (raw.value !== undefined) out.value = stringValue(raw.value, "value");
	if (raw.strict !== undefined) out.strict = flag(raw.strict, "strict");
	if (raw.name !== undefined) out.name = stringValue(raw.name, "name");
	return out;
}

function stringList(value: unknown, field: string): string[] {
	if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
		throw new RpcError(INVALID_PARAMS, `params.${field} must be an array of strings`);
	}
	return [...value];
}

function stringValue(value: unknown, field: string): string {
	if (typeof value !== "string") {
		throw new RpcError(INVALID_PARAMS, `params.${field} must be a string`);
	}
	return value;
}

function flag(value: unknown, field: string): boolean {
	if (typeof value !== "boolean") {
		throw new RpcError(INVALID_PARAMS, `params.${field} must be a boolean`);
	}
	return value;
}

// ---------------------------------------------------------------------------------------------
// NDJSON framing
//
// The wire format is the one packages/desktop/src/rpc.ts documents: one JSON-RPC 2.0 message per
// line. The frame functions are duplicated rather than imported because the CLI must not depend on
// the desktop package; the two copies answer the same shape, and the round trip is pinned by a test.
// ---------------------------------------------------------------------------------------------

export const JSON_RPC_VERSION = "2.0" as const;

export type JsonRpcId = number | string | null;

export interface JsonRpcRequest {
	jsonrpc: "2.0";
	id?: JsonRpcId;
	method: string;
	params?: unknown;
}

export interface JsonRpcError {
	code: number;
	message: string;
	data?: unknown;
}

export interface JsonRpcResponse {
	jsonrpc: "2.0";
	id: JsonRpcId;
	result?: unknown;
	error?: JsonRpcError;
}

export type JsonRpcMessage = JsonRpcRequest | JsonRpcResponse;

/** Encode one message as a single newline-terminated frame. */
export function encodeFrame(message: JsonRpcMessage): string {
	return `${JSON.stringify(message)}\n`;
}

/** Parse one complete frame (a line without its trailing newline). */
export function decodeFrame(line: string): JsonRpcMessage {
	const parsed = JSON.parse(line) as unknown;
	if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
		throw new Error("json-rpc frame must be an object");
	}
	const msg = parsed as Record<string, unknown>;
	if (msg.jsonrpc !== JSON_RPC_VERSION) {
		throw new Error("json-rpc frame missing jsonrpc 2.0");
	}
	if (typeof msg.method === "string") {
		return msg as unknown as JsonRpcRequest;
	}
	if (
		"id" in msg &&
		(typeof msg.id === "number" || typeof msg.id === "string" || msg.id === null)
	) {
		return msg as unknown as JsonRpcResponse;
	}
	throw new Error("json-rpc frame is neither request nor response");
}

/** Split a (possibly partial) buffer into complete frames plus the remainder. */
export function splitFrames(buffer: string): { messages: JsonRpcMessage[]; rest: string } {
	const lines = buffer.split("\n");
	const rest = lines.pop() ?? "";
	const messages: JsonRpcMessage[] = [];
	for (const line of lines) {
		if (line.trim() === "") continue;
		messages.push(decodeFrame(line));
	}
	return { messages, rest };
}

export interface ServeOptions {
	/** Frames to read, oldest first. Defaults to this process's stdin. */
	input?: AsyncIterable<Uint8Array | string>;
	/** Where encoded frames go. Defaults to this process's stdout. */
	write?: (text: string) => void;
}

/**
 * Serves frames until input closes. One request in, at most one response out: a notification (no
 * `id`) is executed and answered with nothing, and a frame that arrives malformed is answered with
 * `-32700` instead of killing the loop.
 */
export async function serveStdio(server: RpcServer, options: ServeOptions = {}): Promise<void> {
	const write = options.write ?? ((text: string) => void process.stdout.write(text));
	const input = options.input ?? stdinChunks();
	const decoder = new TextDecoder();
	let buffer = "";
	for await (const chunk of input) {
		buffer += typeof chunk === "string" ? chunk : decoder.decode(chunk, { stream: true });
		const lines = buffer.split("\n");
		buffer = lines.pop() ?? "";
		for (const line of lines) {
			if (line.trim() === "") continue;
			const response = await respond(server, line);
			if (response !== null) write(encodeFrame(response));
		}
	}
	if (buffer.trim() !== "") {
		const response = await respond(server, buffer);
		if (response !== null) write(encodeFrame(response));
	}
}

async function respond(server: RpcServer, line: string): Promise<JsonRpcResponse | null> {
	let message: JsonRpcMessage;
	try {
		message = decodeFrame(line);
	} catch (error) {
		return { jsonrpc: JSON_RPC_VERSION, id: null, error: parseError(messageOf(error)) };
	}
	if (!isRequest(message)) return null;
	const notification = message.id === undefined;
	try {
		const result = await server.call(message.method, message.params);
		if (notification) return null;
		return { jsonrpc: JSON_RPC_VERSION, id: message.id ?? null, result };
	} catch (error) {
		if (notification) return null;
		return { jsonrpc: JSON_RPC_VERSION, id: message.id ?? null, error: toRpcError(error) };
	}
}

function isRequest(message: JsonRpcMessage): message is JsonRpcRequest {
	return "method" in message;
}

function parseError(message: string): JsonRpcError {
	return { code: PARSE_ERROR, message };
}

function toRpcError(error: unknown): JsonRpcError {
	if (error instanceof RpcError) {
		return { code: error.code, message: error.message, data: error.data };
	}
	return { code: INTERNAL_ERROR, message: messageOf(error) };
}

function stdinChunks(): AsyncIterable<Uint8Array | string> {
	return Bun.stdin.stream();
}

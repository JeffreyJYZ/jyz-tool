// MCP over stdio: newline-delimited JSON-RPC 2.0.
//
// One JSON object per line in, one per line out. The wire shape matches the
// framing the desktop bridge documents in `packages/desktop/src/rpc.ts`, kept
// local so this package depends on nothing but `@jyz/core`.
//
// The loop never throws on bad input: a malformed line, a non-object frame or
// an unknown method each produce a JSON-RPC error object instead.

import { VERSION } from "@jyz/core";
import { callTool } from "./handler.ts";
import { listResources, readResource, UnknownResourceError } from "./resources.ts";
import { listTools } from "./tools.ts";

export type JsonRpcId = number | string | null;

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

export interface ServeIo {
	/** Next chunk of stdin, or `null` at end of input. */
	read: () => Promise<string | null> | string | null;
	/** Write one frame; the caller supplies the trailing newline. */
	write: (chunk: string) => Promise<void> | void;
}

export interface ServeOptions {
	/** Directory a `tools/call` resolves against. */
	cwd: string;
}

export const JSON_RPC_VERSION = "2.0" as const;
export const PROTOCOL_VERSION = "2025-06-18";
export const SUPPORTED_PROTOCOL_VERSIONS: readonly string[] = [
	"2024-11-05",
	"2025-03-26",
	PROTOCOL_VERSION,
];
export const SERVER_NAME = "jyz";

export const PARSE_ERROR = -32700;
export const INVALID_REQUEST = -32600;
export const METHOD_NOT_FOUND = -32601;
export const INVALID_PARAMS = -32602;
export const INTERNAL_ERROR = -32603;

export interface TextContent {
	type: "text";
	text: string;
}

export interface CallToolResult {
	content: TextContent[];
	isError?: boolean;
}

class RpcError extends Error {
	readonly code: number;
	readonly data: unknown;
	constructor(code: number, message: string, data?: unknown) {
		super(message);
		this.name = "RpcError";
		this.code = code;
		this.data = data;
	}
}

function encodeFrame(message: JsonRpcResponse): string {
	return `${JSON.stringify(message)}\n`;
}

function errorResponse(
	id: JsonRpcId,
	code: number,
	message: string,
	data?: unknown,
): JsonRpcResponse {
	const error: JsonRpcError = { code, message };
	if (data !== undefined) error.data = data;
	return { jsonrpc: JSON_RPC_VERSION, id, error };
}

function asRecord(value: unknown): Record<string, unknown> {
	if (value !== null && typeof value === "object" && !Array.isArray(value)) {
		return value as Record<string, unknown>;
	}
	return {};
}

function asId(value: unknown): JsonRpcId {
	if (typeof value === "number" || typeof value === "string" || value === null) return value;
	return null;
}

function initialize(params: unknown): Record<string, unknown> {
	const requested = asRecord(params).protocolVersion;
	const protocolVersion =
		typeof requested === "string" && SUPPORTED_PROTOCOL_VERSIONS.includes(requested)
			? requested
			: PROTOCOL_VERSION;
	return {
		protocolVersion,
		capabilities: { tools: { listChanged: false }, resources: { listChanged: false } },
		serverInfo: { name: SERVER_NAME, version: VERSION },
	};
}

function listToolsResult(): Record<string, unknown> {
	return {
		tools: listTools().map((tool) => ({
			name: tool.name,
			description: tool.description,
			inputSchema: tool.inputSchema,
			annotations: { destructiveHint: tool.destructive },
		})),
	};
}

async function callToolResult(params: unknown, cwd: string): Promise<CallToolResult> {
	const p = asRecord(params);
	const name = typeof p.name === "string" ? p.name : "";
	const validNames = listTools().map((t) => t.name);
	if (!validNames.includes(name)) {
		throw new RpcError(INVALID_PARAMS, `unknown tool "${name}"`, { validNames });
	}
	const input = p.arguments ?? p.input ?? {};
	try {
		const result = await callTool(name, input, cwd);
		return { content: [{ type: "text", text: JSON.stringify(result) }] };
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return { content: [{ type: "text", text: message }], isError: true };
	}
}

function listResourcesResult(): Record<string, unknown> {
	return {
		resources: listResources().map((resource) => ({
			uri: resource.uri,
			name: resource.name,
			description: resource.description,
			mimeType: resource.mimeType,
		})),
	};
}

async function readResourceResult(params: unknown, cwd: string): Promise<Record<string, unknown>> {
	const p = asRecord(params);
	const uri = p.uri;
	if (typeof uri !== "string" || uri === "") {
		throw new RpcError(INVALID_PARAMS, "invalid params: missing uri");
	}
	try {
		const contents = readResource(uri, cwd);
		return {
			contents: [{ uri: contents.uri, mimeType: contents.mimeType, text: contents.text }],
		};
	} catch (err) {
		if (err instanceof UnknownResourceError) {
			throw new RpcError(INVALID_PARAMS, err.message);
		}
		throw err;
	}
}

async function dispatch(method: string, params: unknown, cwd: string): Promise<unknown> {
	switch (method) {
		case "initialize":
			return initialize(params);
		case "ping":
			return {};
		case "tools/list":
			return listToolsResult();
		case "tools/call":
			return await callToolResult(params, cwd);
		case "resources/list":
			return listResourcesResult();
		case "resources/read":
			return await readResourceResult(params, cwd);
		default:
			throw new RpcError(METHOD_NOT_FOUND, `method not found: ${method}`);
	}
}

/** Dispatch one parsed frame. Returns `null` for a notification (no reply). */
async function respondToMessage(message: unknown, cwd: string): Promise<JsonRpcResponse | null> {
	if (message === null || typeof message !== "object" || Array.isArray(message)) {
		return errorResponse(null, INVALID_REQUEST, "invalid request: frame must be an object");
	}
	const frame = message as Record<string, unknown>;
	if (frame.jsonrpc !== JSON_RPC_VERSION) {
		return errorResponse(
			asId(frame.id),
			INVALID_REQUEST,
			"invalid request: missing jsonrpc 2.0",
		);
	}
	if (typeof frame.method !== "string") {
		return errorResponse(asId(frame.id), INVALID_REQUEST, "invalid request: missing method");
	}
	const notification = frame.id === undefined;
	const id = asId(frame.id);
	try {
		const result = await dispatch(frame.method, frame.params, cwd);
		return notification ? null : { jsonrpc: JSON_RPC_VERSION, id, result };
	} catch (err) {
		if (notification) return null;
		if (err instanceof RpcError) return errorResponse(id, err.code, err.message, err.data);
		const message = err instanceof Error ? err.message : String(err);
		return errorResponse(id, INTERNAL_ERROR, message);
	}
}

async function respondToLine(line: string, io: ServeIo, options: ServeOptions): Promise<void> {
	if (line.trim() === "") return;
	let message: unknown;
	try {
		message = JSON.parse(line);
	} catch {
		await io.write(encodeFrame(errorResponse(null, PARSE_ERROR, "parse error: invalid JSON")));
		return;
	}
	const response = await respondToMessage(message, options.cwd);
	if (response !== null) await io.write(encodeFrame(response));
}

/** Consume whole lines from `buffer`, returning the unterminated remainder. */
async function drainLines(buffer: string, io: ServeIo, options: ServeOptions): Promise<string> {
	const lines = buffer.split("\n");
	const rest = lines.pop() ?? "";
	for (const line of lines) await respondToLine(line, io, options);
	return rest;
}

/** Run the JSON-RPC loop until `read` reports end of input. */
export async function serve(io: ServeIo, options: ServeOptions): Promise<void> {
	let buffer = "";
	for (;;) {
		const chunk = await io.read();
		if (chunk === null) break;
		buffer += chunk;
		buffer = await drainLines(buffer, io, options);
	}
	if (buffer.trim() !== "") await respondToLine(buffer, io, options);
}

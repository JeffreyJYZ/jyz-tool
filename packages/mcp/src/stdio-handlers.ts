import { callTool } from "./handler.ts";
import { listResources, readResource, UnknownResourceError } from "./resources.ts";
import {
	asId,
	asRecord,
	errorResponse,
	INTERNAL_ERROR,
	INVALID_PARAMS,
	INVALID_REQUEST,
	JSON_RPC_VERSION,
	type JsonRpcId,
	type JsonRpcResponse,
	METHOD_NOT_FOUND,
	PARSE_ERROR,
	PROTOCOL_VERSION,
	RpcError,
	SERVER_NAME,
	type ServeIo,
	type ServeOptions,
	SUPPORTED_PROTOCOL_VERSIONS,
	VERSION,
} from "./stdio-protocol.ts";
import { listTools } from "./tools.ts";

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

async function callToolResult(
	params: unknown,
	cwd: string,
): Promise<{ content: { type: "text"; text: string }[]; isError?: boolean }> {
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

export async function dispatch(method: string, params: unknown, cwd: string): Promise<unknown> {
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

export async function respondToMessage(
	message: unknown,
	cwd: string,
): Promise<JsonRpcResponse | null> {
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

export async function respondToLine(
	line: string,
	io: ServeIo,
	options: ServeOptions,
): Promise<void> {
	if (line.trim() === "") return;
	let message: unknown;
	try {
		message = JSON.parse(line);
	} catch {
		await io.write(
			`${JSON.stringify(errorResponse(null, PARSE_ERROR, "parse error: invalid JSON"))}\n`,
		);
		return;
	}
	const response = await respondToMessage(message, options.cwd);
	if (response !== null) await io.write(`${JSON.stringify(response)}\n`);
}

export async function drainLines(
	buffer: string,
	io: ServeIo,
	options: ServeOptions,
): Promise<string> {
	const lines = buffer.split("\n");
	const rest = lines.pop() ?? "";
	for (const line of lines) await respondToLine(line, io, options);
	return rest;
}

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

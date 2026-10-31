import { INTERNAL_ERROR, PARSE_ERROR, RpcError } from "./errors.ts";
import type { JsonRpcError, JsonRpcMessage, JsonRpcRequest, JsonRpcResponse } from "./framing.ts";
import { decodeFrame, encodeFrame, JSON_RPC_VERSION } from "./framing.ts";
import type { RpcServer } from "./server.ts";

export interface ServeOptions {
	input?: AsyncIterable<Uint8Array | string>;
	write?: (text: string) => void;
}

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

function messageOf(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

function stdinChunks(): AsyncIterable<Uint8Array | string> {
	return Bun.stdin.stream();
}

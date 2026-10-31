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

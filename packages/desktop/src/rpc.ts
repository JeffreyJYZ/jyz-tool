// Desktop <-> CLI bridge: stdio JSON-RPC 2.0.
//
// v1 ships this as a documented stub only. No Tauri command registers it and
// no process is spawned; the window stays a shell. The real client arrives at
// v2, when the CLI exposes its JSON-RPC stdio surface. Keeping the shape here
// (types + framing) lets the desktop and CLI agree on the wire format early.
//
// Transport: one JSON object per line on the CLI's stdin/stdout (NDJSON).
// Every frame is a single JSON-RPC 2.0 message terminated by "\n".

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

export const JSON_RPC_VERSION = "2.0" as const;

/** Encode one message as a single newline-terminated frame. */
export function encodeFrame(message: JsonRpcMessage): string {
	return `${JSON.stringify(message)}\n`;
}

/** Parse one complete frame (a line without its trailing newline). */
export function decodeFrame(line: string): JsonRpcMessage {
	const parsed = JSON.parse(line) as unknown;
	if (typeof parsed !== "object" || parsed === null) {
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
	const messages: JsonRpcMessage[] = [];
	let rest = buffer;
	const lines = rest.split("\n");
	rest = lines.pop() ?? "";
	for (const line of lines) {
		if (line.trim() === "") {
			continue;
		}
		messages.push(decodeFrame(line));
	}
	return { messages, rest };
}

// Stub client shape for v2. Methods are intentionally unimplemented here.
export class RpcClient {
	async call(_method: string, _params?: unknown): Promise<unknown> {
		throw new Error("RpcClient is a v1 stub; not implemented");
	}

	notify(_method: string, _params?: unknown): void {
		throw new Error("RpcClient is a v1 stub; not implemented");
	}

	onNotification(_handler: (method: string, params: unknown) => void): () => void {
		throw new Error("RpcClient is a v1 stub; not implemented");
	}

	close(): void {
		// no-op in v1
	}
}

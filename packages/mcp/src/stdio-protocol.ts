import { VERSION } from "@jyz/core";

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
	read: () => Promise<string | null> | string | null;
	write: (chunk: string) => Promise<void> | void;
}

export interface ServeOptions {
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

export class RpcError extends Error {
	readonly code: number;
	readonly data: unknown;
	constructor(code: number, message: string, data?: unknown) {
		super(message);
		this.name = "RpcError";
		this.code = code;
		this.data = data;
	}
}

export function encodeFrame(message: JsonRpcResponse): string {
	return `${JSON.stringify(message)}\n`;
}

export function errorResponse(
	id: JsonRpcId,
	code: number,
	message: string,
	data?: unknown,
): JsonRpcResponse {
	const error: JsonRpcError = { code, message };
	if (data !== undefined) error.data = data;
	return { jsonrpc: JSON_RPC_VERSION, id, error };
}

export function asRecord(value: unknown): Record<string, unknown> {
	if (value !== null && typeof value === "object" && !Array.isArray(value)) {
		return value as Record<string, unknown>;
	}
	return {};
}

export function asId(value: unknown): JsonRpcId {
	if (typeof value === "number" || typeof value === "string" || value === null) return value;
	return null;
}

export { VERSION };

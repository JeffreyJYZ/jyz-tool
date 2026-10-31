export const PARSE_ERROR = -32700;
export const INVALID_PARAMS = -32602;
export const METHOD_NOT_FOUND = -32601;
export const INTERNAL_ERROR = -32603;

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

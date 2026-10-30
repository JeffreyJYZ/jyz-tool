// The desktop window's request/response shaping, kept free of Tauri so bun:test can reach it.
//
// The Rust command `jyz_call` is a transport: it spawns `jyz serve`, writes one frame and returns
// the one line it read back. Everything a person sees — which params a call really carries, whether
// an answer is a result or a JSON-RPC error, how a transport fault reads — is decided here, so the
// page and the test agree on one contract instead of two guesses.

import type { JsonRpcResponse } from "./rpc.ts";

/** One JSON-RPC failure, whether the server reported it or the transport did. */
export class BridgeError extends Error {
	readonly code: number | null;
	readonly data: unknown;

	constructor(message: string, code: number | null = null, data?: unknown) {
		super(message);
		this.name = "BridgeError";
		this.code = code;
		this.data = data;
	}
}

/** One capability entry as it arrives from the manifest. */
export interface ManifestEntry {
	name: string;
	kind: string;
}

/** Names from a manifest, in manifest order. */
export function methodsFromManifest(manifest: { name: string; kind: string }[]): string[] {
	return manifest.map((entry) => entry.name);
}

/** Selectable method names from a manifest: manifest order, duplicates removed. */
export function selectableMethods(manifest: { name: string; kind: string }[]): string[] {
	const seen = new Set<string>();
	const result: string[] = [];
	for (const entry of manifest) {
		if (seen.has(entry.name)) continue;
		seen.add(entry.name);
		result.push(entry.name);
	}
	return result;
}

/** Group manifest entries by kind, preserving first-seen kind order. */
export function groupByKind(manifest: { name: string; kind: string }[]): Record<string, string[]> {
	const groups: Record<string, string[]> = {};
	for (const entry of manifest) {
		const names = groups[entry.kind];
		if (names === undefined) {
			groups[entry.kind] = [entry.name];
		} else {
			names.push(entry.name);
		}
	}
	return groups;
}

/** One capability name the window can call. */
export type Method = string;

/** What `jyz_call` receives: a method name and its params as JSON text. */
export interface CallRequest {
	method: string;
	params: string;
}

/** Shape the arguments of one call. Throws `BridgeError` when the form is not callable yet. */
export function buildCall(method: string, paramsText: string): CallRequest {
	const name = method.trim();
	if (name === "") {
		throw new BridgeError("pick a method first");
	}
	return { method: name, params: normalizeParams(paramsText) };
}

/** Params as one compact JSON document. Blank means `null`, which the server reads as no params. */
export function normalizeParams(paramsText: string): string {
	const text = paramsText.trim();
	if (text === "") {
		return "null";
	}
	return JSON.stringify(parseJson(text, "params"));
}

/** Parse one response line, turning a JSON-RPC error into a thrown `BridgeError`. */
export function readResponse(line: string): JsonRpcResponse {
	const parsed = parseJson(line.trim(), "answer");
	if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
		throw new BridgeError("answer is not a JSON-RPC message");
	}
	const frame = parsed as Record<string, unknown>;
	if (frame.jsonrpc !== "2.0") {
		throw new BridgeError("answer is not JSON-RPC 2.0");
	}
	if (frame.error !== undefined && frame.error !== null) {
		throw toBridgeError(frame.error);
	}
	return frame as unknown as JsonRpcResponse;
}

/** The `result` of a successful call. Throws `BridgeError` when the answer carried none. */
export function readResult(line: string): unknown {
	const response = readResponse(line);
	if (response.result === undefined) {
		throw new BridgeError("answer carried no result");
	}
	return response.result;
}

/** A result as the page prints it: pretty JSON when it serializes, a plain string otherwise. */
export function formatResult(value: unknown): string {
	try {
		const text = JSON.stringify(value, null, 2);
		return text === undefined ? String(value) : text;
	} catch {
		return String(value);
	}
}

/** Any thrown value as one line a person can read. */
export function mapError(error: unknown): string {
	if (error instanceof BridgeError) {
		return error.code === null ? error.message : `${error.message} (${error.code})`;
	}
	return messageOf(error);
}

/** A JSON-RPC `error` member as a `BridgeError`, keeping the code so a caller can branch on it. */
function toBridgeError(error: unknown): BridgeError {
	if (typeof error !== "object" || error === null) {
		return new BridgeError("the CLI reported an error");
	}
	const member = error as Record<string, unknown>;
	const code = typeof member.code === "number" ? member.code : null;
	const message =
		typeof member.message === "string" ? member.message : "the CLI reported an error";
	return new BridgeError(message, code, member.data);
}

function parseJson(text: string, what: string): unknown {
	try {
		return JSON.parse(text);
	} catch (error) {
		throw new BridgeError(`${what} is not JSON: ${messageOf(error)}`);
	}
}

function messageOf(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

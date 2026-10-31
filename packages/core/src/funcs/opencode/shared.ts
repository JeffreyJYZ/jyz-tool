/**
 * Shared helpers, types and errors for the opencode client seam.
 */
import { readFileSync } from "node:fs";

export const DEFAULT_OPENCODE_URL = "http://127.0.0.1:4096";

export interface ResolvedServer {
	baseUrl: string;
	token?: string;
	password?: string;
	source: "flag" | "env" | "service" | "default";
}

export interface OpencodeSession {
	id: string;
	title: string;
	updatedAt: string;
}

export interface ResolveServerOptions {
	url?: string;
	env?: Record<string, string | undefined>;
}

export interface OpencodeRequestOptions {
	token?: string;
	password?: string;
}

export class OpencodeError extends Error {
	status?: number;
	url: string;

	constructor(message: string, url: string, status?: number) {
		super(message);
		this.name = "OpencodeError";
		this.url = url;
		if (status !== undefined) this.status = status;
	}
}

export class OpencodeSpawnError extends OpencodeError {
	constructor(message: string, url: string) {
		super(message, url);
		this.name = "OpencodeSpawnError";
	}
}

export interface OpencodeEvent {
	type: string;
	sessionID: string | null;
	summary: string;
}

export interface SpawnServerOptions {
	command?: string;
	cwd: string;
}

export interface SpawnedServer {
	pid: number;
	baseUrl: string;
	stop(): Promise<void>;
}

export function trimToNil(value: string | undefined): string | undefined {
	const trimmed = value?.trim();
	return trimmed === undefined || trimmed === "" ? undefined : trimmed;
}

export function stripTrailingSlash(url: string): string {
	return url.replace(/\/+$/, "");
}

export function withUrl(message: string, url: string): string {
	return message.includes(url) ? message : `${url}: ${message}`;
}

export function readServiceFile(env: Record<string, string | undefined>): {
	url?: string;
	password?: string;
} {
	try {
		const stateHome =
			trimToNil(env.XDG_STATE_HOME) ?? `${trimToNil(env.HOME) ?? ""}/.local/state`;
		const raw = readFileSync(`${stateHome}/opencode/service.json`, "utf8");
		const parsed = JSON.parse(raw) as unknown;
		if (typeof parsed !== "object" || parsed === null) return {};
		const record = parsed as Record<string, unknown>;
		const url = trimToNil(typeof record.url === "string" ? record.url : undefined);
		const password = trimToNil(
			typeof record.password === "string" ? record.password : undefined,
		);
		const out: { url?: string; password?: string } = {};
		if (url !== undefined) out.url = url;
		if (password !== undefined) out.password = password;
		return out;
	} catch {
		return {};
	}
}

export function resolveServer(opts: ResolveServerOptions = {}): ResolvedServer {
	const env = opts.env ?? process.env;
	const flag = trimToNil(opts.url);
	const envUrl = trimToNil(env.JYZ_OPENCODE_URL);
	const token = trimToNil(env.JYZ_OPENCODE_TOKEN);
	const service = readServiceFile(env);

	let baseUrl: string;
	let source: ResolvedServer["source"];
	let password: string | undefined;
	if (flag !== undefined) {
		baseUrl = flag;
		source = "flag";
	} else if (envUrl !== undefined) {
		baseUrl = envUrl;
		source = "env";
	} else if (service.url !== undefined) {
		baseUrl = service.url;
		source = "service";
		password = service.password;
	} else {
		baseUrl = DEFAULT_OPENCODE_URL;
		source = "default";
	}
	baseUrl = stripTrailingSlash(baseUrl);
	if (baseUrl === "") throw new OpencodeError("opencode base URL is empty", baseUrl);

	const resolved: ResolvedServer = { baseUrl, source };
	if (token !== undefined) resolved.token = token;
	if (password !== undefined) resolved.password = password;
	return resolved;
}

export function headersFor(input: { token?: string; password?: string }): Record<string, string> {
	const out: Record<string, string> = {};
	if (input.token !== undefined) {
		out.authorization = `Bearer ${input.token}`;
	} else if (input.password !== undefined) {
		out.authorization = `Basic ${btoa(`opencode:${input.password}`)}`;
	}
	return out;
}

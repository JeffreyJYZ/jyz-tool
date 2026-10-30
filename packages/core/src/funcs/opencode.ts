/**
 * The opencode client seam: where a running opencode server is, what it holds, and how a prompt
 * reaches it.
 */
import { readFileSync } from "node:fs";

import { OpenCode } from "@opencode/client";

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

function trimToNil(value: string | undefined): string | undefined {
	const trimmed = value?.trim();
	return trimmed === undefined || trimmed === "" ? undefined : trimmed;
}

function stripTrailingSlash(url: string): string {
	return url.replace(/\/+$/, "");
}

function withUrl(message: string, url: string): string {
	return message.includes(url) ? message : `${url}: ${message}`;
}

function statusFromError(error: unknown): number | undefined {
	const message = error instanceof Error ? error.message : String(error);
	const match = /UnexpectedStatus:\s*(\d{3})/.exec(message) ?? /(\d{3})/.exec(message);
	if (match) {
		const n = Number(match[1]);
		if (Number.isFinite(n)) return n;
	}
	return undefined;
}

function readServiceFile(env: Record<string, string | undefined>): {
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

function readUpdated(record: Record<string, unknown>): string {
	const time = record.time;
	if (typeof time === "object" && time !== null) {
		const updated = (time as Record<string, unknown>).updated;
		if (typeof updated === "number" && Number.isFinite(updated)) {
			return new Date(updated).toISOString();
		}
	}
	const direct = record.updatedAt;
	if (typeof direct === "string") return direct;
	if (typeof direct === "number" && Number.isFinite(direct))
		return new Date(direct).toISOString();
	return "";
}

function toSession(item: unknown, url: string): OpencodeSession {
	if (typeof item !== "object" || item === null) {
		throw new OpencodeError(`${url} returned a session that is not an object`, url);
	}
	const record = item as Record<string, unknown>;
	const id = typeof record.id === "string" ? record.id : undefined;
	if (id === undefined || id === "") {
		throw new OpencodeError(`${url} returned a session with no id`, url);
	}
	const title = typeof record.title === "string" && record.title !== "" ? record.title : id;
	return { id, title, updatedAt: readUpdated(record) };
}

export async function listSessions(
	baseUrl: string,
	fetcher: typeof fetch = fetch,
	options: OpencodeRequestOptions = {},
): Promise<OpencodeSession[]> {
	const url = `${stripTrailingSlash(baseUrl)}/api/session`;
	let lastStatus: number | undefined;
	const wrappedFetch: typeof fetch = (async (input, init) => {
		const response = await fetcher(
			input as Parameters<typeof fetch>[0],
			init as Parameters<typeof fetch>[1],
		);
		if (!response.ok) lastStatus = response.status;
		return response;
	}) as typeof fetch;
	const client = OpenCode.make({
		baseUrl: stripTrailingSlash(baseUrl),
		fetch: wrappedFetch,
		headers: headersFor(options),
	});
	let response: unknown;
	try {
		response = await client.session.list({
			parentID: null,
			order: "desc",
			limit: 50,
		} as unknown as {
			parentID: null;
			order: "desc";
			limit: number;
		});
	} catch (error) {
		throw new OpencodeError(
			withUrl(error instanceof Error ? error.message : String(error), url),
			url,
			lastStatus,
		);
	}
	const data = (response as { data?: unknown })?.data;
	if (!Array.isArray(data)) {
		throw new OpencodeError(`${url} returned ${typeof data}, expected a session array`, url);
	}
	return data.map((item: unknown) => toSession(item, url));
}

export async function sendPrompt(
	baseUrl: string,
	sessionId: string,
	text: string,
	fetcher: typeof fetch = fetch,
	options: OpencodeRequestOptions = {},
): Promise<{ ok: true }> {
	const url = `${stripTrailingSlash(baseUrl)}/api/session/${encodeURIComponent(sessionId)}/prompt`;
	let lastStatus: number | undefined;
	const wrappedFetch: typeof fetch = (async (input, init) => {
		const response = await fetcher(
			input as Parameters<typeof fetch>[0],
			init as Parameters<typeof fetch>[1],
		);
		if (!response.ok) lastStatus = response.status;
		return response;
	}) as typeof fetch;
	const client = OpenCode.make({
		baseUrl: stripTrailingSlash(baseUrl),
		fetch: wrappedFetch,
		headers: headersFor(options),
	});
	try {
		// The generated SessionPromptInput is a codegen artifact (nested readonly fields), so cast at this seam.
		await client.session.prompt({ sessionID: sessionId, text } as unknown as {
			sessionID: string;
			text: string;
		});
	} catch (error) {
		throw new OpencodeError(
			withUrl(error instanceof Error ? error.message : String(error), url),
			url,
			lastStatus,
		);
	}
	return { ok: true };
}

export async function* subscribeEvents(options: {
	baseUrl: string;
	token?: string;
	password?: string;
	fetch?: typeof fetch;
	sessionID?: string;
	signal?: AbortSignal;
}): AsyncIterable<OpencodeEvent> {
	const baseUrl = stripTrailingSlash(options.baseUrl);
	const client = OpenCode.make({
		baseUrl,
		fetch: options.fetch ?? fetch,
		headers: headersFor(options),
	});
	const stream = client.event.subscribe({ signal: options.signal } as unknown as {
		signal?: AbortSignal;
	});
	try {
		for await (const event of stream as AsyncIterable<any>) {
			const type = typeof event?.type === "string" ? event.type : String(event?.type ?? "");
			const data = (event?.data ?? {}) as Record<string, unknown>;
			const sessionID =
				typeof data.sessionID === "string"
					? data.sessionID
					: typeof event?.sessionID === "string"
						? event.sessionID
						: null;
			if (options.sessionID !== undefined && sessionID !== options.sessionID) continue;
			let summary = type;
			if (type === "session.tool.called") {
				const tool =
					typeof data.tool === "string"
						? data.tool
						: typeof data.name === "string"
							? data.name
							: typeof data.toolName === "string"
								? data.toolName
								: "tool";
				summary = `tool called: ${tool}`;
			} else if (type === "session.text.delta") {
				const delta = typeof data.delta === "string" ? data.delta : "";
				summary = `text delta: ${delta.length} chars`;
			} else if (type === "session.idle" || type.endsWith(".idle")) {
				summary = "idle";
			}
			yield { type, sessionID, summary };
		}
	} catch (error) {
		throw new OpencodeError(
			withUrl(error instanceof Error ? error.message : String(error), baseUrl),
			baseUrl,
		);
	}
}

// spawn mode kept below unchanged

const spawnedPids = new Set<number>();
const spawnedProcs = new Map<number, ReturnType<typeof Bun.spawn>>();

export interface SpawnServerOptions {
	command?: string;
	cwd: string;
}

export interface SpawnedServer {
	pid: number;
	baseUrl: string;
	stop(): Promise<void>;
}

const SPAWN_TIMEOUT_MS = 5000;

function resolveSpawnUrl(env: Record<string, string | undefined> = process.env): string {
	const resolved = resolveServer({ env });
	return resolved.baseUrl;
}

async function waitForReady(baseUrl: string, proc: ReturnType<typeof Bun.spawn>): Promise<void> {
	const deadline = Date.now() + SPAWN_TIMEOUT_MS;
	while (Date.now() < deadline) {
		if (proc.exitCode !== null) {
			let stderr = "";
			try {
				if (
					proc.stderr &&
					typeof (proc.stderr as ReadableStream).getReader === "function"
				) {
					stderr = await new Response(proc.stderr as ReadableStream).text();
				}
			} catch {
				// ignore
			}
			throw new OpencodeSpawnError(
				`opencode exited before ready: ${stderr.trim() || "exit " + proc.exitCode}`,
				baseUrl,
			);
		}
		try {
			const response = await fetch(`${baseUrl}/`, { signal: AbortSignal.timeout(200) });
			void response;
			return;
		} catch {
			await new Promise((resolve) => setTimeout(resolve, 50));
		}
	}
	throw new OpencodeSpawnError(`timed out waiting for opencode at ${baseUrl}`, baseUrl);
}

export async function spawnServer(opts: SpawnServerOptions): Promise<SpawnedServer> {
	const command = opts.command ?? "opencode";
	const baseUrl = resolveSpawnUrl();
	const parts = command
		.trim()
		.split(/\s+/)
		.filter((part) => part !== "");
	if (parts.length === 0) {
		throw new OpencodeSpawnError("empty opencode command", baseUrl);
	}
	const proc = Bun.spawn({
		cmd: parts,
		cwd: opts.cwd,
		env: process.env,
		stdin: "ignore",
		stdout: "pipe",
		stderr: "pipe",
	});
	const pid = proc.pid;
	let stopped = false;
	const stop = async (): Promise<void> => {
		if (stopped) return;
		stopped = true;
		if (!spawnedPids.has(pid)) return;
		spawnedPids.delete(pid);
		spawnedProcs.delete(pid);
		try {
			proc.kill();
		} catch {
			// ignore
		}
		try {
			await proc.exited;
		} catch {
			// ignore
		}
	};
	try {
		await waitForReady(baseUrl, proc);
	} catch (error) {
		try {
			proc.kill();
		} catch {
			// ignore
		}
		throw error;
	}
	spawnedPids.add(pid);
	spawnedProcs.set(pid, proc);
	return { pid, baseUrl, stop };
}

export function spawnedServers(): number[] {
	return [...spawnedPids];
}

export function killSpawned(pid: number): void {
	const proc = spawnedProcs.get(pid);
	if (proc === undefined) return;
	spawnedPids.delete(pid);
	spawnedProcs.delete(pid);
	try {
		proc.kill();
	} catch {
		// ignore
	}
}

/**
 * The opencode client seam: where a running opencode server is, what it holds, and how a prompt
 * reaches it.
 *
 * jyz never spawns opencode and never embeds an SDK. A server is addressed by URL, its session list
 * is read over HTTP, and a prompt is one POST. Keeping the seam this thin means the CLI, the desktop
 * shell and MCP all drive the same three functions instead of three clients.
 */
/** The address a stock `opencode serve` listens on, used when nothing else names one. */
export const DEFAULT_OPENCODE_URL = "http://127.0.0.1:4096";

export interface ResolvedServer {
	baseUrl: string;
	token?: string;
	/** Which layer supplied the URL: a flag, `JYZ_OPENCODE_URL`, or the built-in default. */
	source: "flag" | "env" | "default";
}

export interface OpencodeSession {
	id: string;
	title: string;
	/** ISO timestamp, or an empty string when the server reports none. */
	updatedAt: string;
}

export interface ResolveServerOptions {
	url?: string;
	env?: Record<string, string | undefined>;
}

export interface OpencodeRequestOptions {
	/** Sent as a bearer token when the server requires one. */
	token?: string;
}

/** Any failure talking to opencode: transport, status or payload shape. */
export class OpencodeError extends Error {
	/** The HTTP status when the server answered, absent when it could not be reached. */
	status?: number;
	url: string;

	constructor(message: string, url: string, status?: number) {
		super(message);
		this.name = "OpencodeError";
		this.url = url;
		if (status !== undefined) this.status = status;
	}
}

/** Failure while starting an opencode server that jyz spawned. */
export class OpencodeSpawnError extends OpencodeError {
	constructor(message: string, url: string) {
		super(message, url);
		this.name = "OpencodeSpawnError";
	}
}

function trimToNil(value: string | undefined): string | undefined {
	const trimmed = value?.trim();
	return trimmed === undefined || trimmed === "" ? undefined : trimmed;
}

function stripTrailingSlash(url: string): string {
	return url.replace(/\/+$/, "");
}

/**
 * Resolves the server address once, flag over env over default, and carries the token alongside it
 * so a caller never re-reads the environment behind this function's back.
 */
export function resolveServer(opts: ResolveServerOptions = {}): ResolvedServer {
	const env = opts.env ?? process.env;
	const flag = trimToNil(opts.url);
	const envUrl = trimToNil(env.JYZ_OPENCODE_URL);
	const token = trimToNil(env.JYZ_OPENCODE_TOKEN);

	let baseUrl: string;
	let source: ResolvedServer["source"];
	if (flag !== undefined) {
		baseUrl = flag;
		source = "flag";
	} else if (envUrl !== undefined) {
		baseUrl = envUrl;
		source = "env";
	} else {
		baseUrl = DEFAULT_OPENCODE_URL;
		source = "default";
	}
	baseUrl = stripTrailingSlash(baseUrl);
	if (baseUrl === "") throw new OpencodeError("opencode base URL is empty", baseUrl);

	const resolved: ResolvedServer = { baseUrl, source };
	if (token !== undefined) resolved.token = token;
	return resolved;
}

function headers(token: string | undefined, json: boolean): Record<string, string> {
	const out: Record<string, string> = {};
	if (json) out["content-type"] = "application/json";
	if (token !== undefined) out.authorization = `Bearer ${token}`;
	return out;
}

/** One request, with transport and status failures normalised into `OpencodeError`. */
async function request(
	url: string,
	what: string,
	fetcher: typeof fetch,
	init: RequestInit,
): Promise<Response> {
	let response: Response;
	try {
		response = await fetcher(url, init);
	} catch (error) {
		const detail = error instanceof Error ? error.message : String(error);
		throw new OpencodeError(`cannot reach ${url}: ${detail}`, url);
	}
	if (!response.ok) {
		const detail =
			response.statusText === ""
				? `${response.status}`
				: `${response.status} ${response.statusText}`;
		throw new OpencodeError(`${what} failed: ${detail}`, url, response.status);
	}
	return response;
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

/**
 * Lists the server's sessions, newest shape tolerated: opencode reports `time.updated` as epoch
 * milliseconds, while a plain `updatedAt` is passed through untouched.
 */
export async function listSessions(
	baseUrl: string,
	fetcher: typeof fetch = fetch,
	options: OpencodeRequestOptions = {},
): Promise<OpencodeSession[]> {
	const url = `${stripTrailingSlash(baseUrl)}/session`;
	const response = await request(url, "listing sessions", fetcher, {
		headers: headers(options.token, false),
	});
	let payload: unknown;
	try {
		payload = await response.json();
	} catch {
		throw new OpencodeError(`${url} did not return JSON`, url, response.status);
	}
	if (!Array.isArray(payload)) {
		throw new OpencodeError(`${url} returned ${typeof payload}, expected a session array`, url);
	}
	return payload.map((item: unknown) => toSession(item, url));
}

/** Posts one user prompt to a session. A 2xx with any body counts as accepted. */
export async function sendPrompt(
	baseUrl: string,
	sessionId: string,
	text: string,
	fetcher: typeof fetch = fetch,
	options: OpencodeRequestOptions = {},
): Promise<{ ok: true }> {
	const url = `${stripTrailingSlash(baseUrl)}/session/${encodeURIComponent(sessionId)}/message`;
	await request(url, "sending prompt", fetcher, {
		method: "POST",
		headers: headers(options.token, true),
		body: JSON.stringify({ parts: [{ type: "text", text }] }),
	});
	return { ok: true };
}

// --- spawn mode ---

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
			const response = await fetch(`${baseUrl}/`, {
				signal: AbortSignal.timeout(200),
			});
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

// kill an unknown PID is a no-op: handled by membership check in stop() and a standalone helper
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

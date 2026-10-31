import { OpenCode } from "@opencode/client";
import type { OpencodeRequestOptions, OpencodeSession } from "./shared.ts";
import { headersFor, OpencodeError, stripTrailingSlash, withUrl } from "./shared.ts";

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
}): AsyncIterable<import("./shared.ts").OpencodeEvent> {
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
		for await (const frame of stream as AsyncIterable<Record<string, unknown>>) {
			const event = (frame ?? {}) as Record<string, unknown>;
			const type = typeof event.type === "string" ? event.type : "";
			const data = (event.data ?? {}) as Record<string, unknown>;
			const sessionID =
				typeof data.sessionID === "string"
					? data.sessionID
					: typeof event.sessionID === "string"
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

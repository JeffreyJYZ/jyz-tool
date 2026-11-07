/**
 * Grouping, storage keys and the ping-pong guard: everything the board tool
 * needs that does not touch the plugin context.
 */

/** Everything a session has to remember lives in two storage namespaces. */
export const ENTRY_KEY = "board.entries";
export const CURSOR_KEY = "board.cursor";

/** The last 50 entries are kept; older ones are dropped on write, never on read. */
export const KEEP = 50;

/** A nudge carries at most this much of the body, so a long post cannot flood a prompt. */
export const NUDGE_CHARS = 300;

/** The fixed opening of a nudge; the ping-pong guard reads it back off the context. */
export const NUDGE_PREFIX = "new board message from ";

/**
 * First line of every nudge. The target sees this as a user message, so it has to
 * say a peer sent it — the same reason `session_ask` marks its own questions.
 */
export const NUDGE_MARK = "[autonomous system nudge from the board plugin]";

export interface Entry {
	id: string;
	at: string;
	from: string;
	fromTitle: string;
	body: string;
	causedBy: string | null;
	to: string;
	/** Files this post claims; the newest claim on a path owns it. */
	files?: readonly string[];
}

export interface Cursor {
	/** Session id -> the id of the last entry it has acknowledged. */
	read: Record<string, string>;
}

/** A session as `session.list()` reports it, narrowed to what grouping needs. */
/** `session.list()` answers either a bare array or `{ sessions }` depending on the build. */
export type SessionList = SessionRow[] | { data?: SessionRow[]; sessions?: SessionRow[] };

export interface SessionRow {
	id: string;
	title?: string | null;
	parentID?: string | null;
	/** `SessionInfo` carries the working directory here, not at the top level. */
	location?: { directory?: string | null } | null;
}

/** The directory a row works in, or "" when the row does not say. */
export const directoryOf = (row: SessionRow | undefined): string => row?.location?.directory ?? "";

/** Hash a directory into a key component: paths carry slashes, storage keys do not. */
export function groupKey(directory: string): string {
	let hash = 0x811c9dc5;
	for (let i = 0; i < directory.length; i += 1) {
		hash ^= directory.charCodeAt(i);
		hash = Math.imul(hash, 0x01000193) >>> 0;
	}
	return `board.group.${hash.toString(16).padStart(8, "0")}`;
}

/** Walk parent links to the root session, so a nested subagent lands on the root's board. */
export function rootOf(rows: readonly SessionRow[], sessionID: string): SessionRow | undefined {
	const byId = new Map(rows.map((row) => [row.id, row]));
	let current = byId.get(sessionID);
	const seen = new Set<string>();
	while (current?.parentID && !seen.has(current.parentID)) {
		seen.add(current.id);
		const parent = byId.get(current.parentID);
		if (!parent) return current;
		current = parent;
	}
	return current;
}

/** True when the caller's latest user row is one of our nudges. */
export function triggeredByNudge(rows: readonly { type?: string; text?: unknown }[]): boolean {
	for (let i = rows.length - 1; i >= 0; i -= 1) {
		const row = rows[i];
		if (row?.type !== "user") continue;
		if (typeof row.text !== "string") return false;
		return row.text.startsWith(NUDGE_MARK) || row.text.startsWith(NUDGE_PREFIX);
	}
	return false;
}

/** How often a wait re-reads the group record. */
export const WAIT_POLL_MS = 500;

/** A wait gives up after this long unless the caller asks for longer. */
export const WAIT_DEFAULT_MS = 120_000;

/** True when at least one entry matches, or when no pattern was given. */
export function matches(entries: readonly Entry[], pattern: string | undefined): boolean {
	if (entries.length === 0) return false;
	if (pattern === undefined || pattern === "") return true;
	return entries.some(
		(entry) => entry.body.includes(pattern) || entry.fromTitle.includes(pattern),
	);
}

/**
 * Poll `read` until it returns entries that match, or the deadline passes.
 * Returns the entries, or null on timeout — the caller decides what a timeout
 * means, because a silent wait is worse than a reported one.
 */
export async function waitForEntries(
	read: () => Promise<Entry[]>,
	pattern: string | undefined,
	timeoutMs: number,
): Promise<Entry[] | null> {
	const deadline = Date.now() + timeoutMs;
	for (;;) {
		const entries = await read();
		if (matches(entries, pattern)) return entries;
		if (Date.now() >= deadline) return null;
		await new Promise((resolve) => setTimeout(resolve, WAIT_POLL_MS));
	}
}

/** A file another session has already claimed on this board. */
export interface ClaimConflict {
	readonly file: string;
	readonly by: string;
	readonly title: string;
}

/**
 * Files already claimed by somebody else, newest claim winning.
 *
 * Claims are derived from the entries themselves — a post that names files owns
 * them until another post does. No separate index means nothing to keep in sync,
 * and the 50-entry window bounds how far back a claim is remembered.
 */
export function claimConflicts(
	entries: readonly Entry[],
	files: readonly string[],
	self: string,
): ClaimConflict[] {
	const owner = new Map<string, { by: string; title: string }>();
	for (const entry of entries) {
		if (entry.files === undefined) continue;
		for (const file of entry.files) owner.set(file, { by: entry.from, title: entry.fromTitle });
	}
	const out: ClaimConflict[] = [];
	for (const file of files) {
		const held = owner.get(file);
		if (held !== undefined && held.by !== self) out.push({ file, ...held });
	}
	return out;
}

/** The slice of the plugin context grouping needs, so it can live outside the plugin. */
export interface BoardCtx {
	readonly location: { readonly directory: string };
	readonly session: { list: () => Promise<unknown> };
	readonly storage: { get: (key: string) => Promise<unknown> };
}

/** Resolve the caller's group key and the live rows, in one place for both tools. */
export async function resolveGroup(
	ctx: BoardCtx,
	sessionID: string,
	override?: string,
): Promise<{ group: string; key: string; rows: SessionRow[]; caller: SessionRow | undefined }> {
	const listed = (await ctx.session.list()) as unknown as SessionList;
	const rows = Array.isArray(listed) ? listed : (listed.data ?? listed.sessions ?? []);
	const caller = rows.find((row) => row.id === sessionID);
	const root = rootOf(rows, sessionID) ?? caller;
	const group = override ?? (directoryOf(root ?? caller) || ctx.location.directory);
	return { group, key: groupKey(group), rows, caller };
}

/** Read the group record, tolerating a shape this plugin did not write. */
export async function readEntries(ctx: BoardCtx, key: string): Promise<Entry[]> {
	const stored = await ctx.storage.get(key);
	return Array.isArray(stored) ? (stored as Entry[]) : [];
}

/** Entries this session has not acknowledged yet, newest first. */
export async function unreadEntries(
	ctx: BoardCtx,
	key: string,
	cursor: Cursor,
	sessionID: string,
): Promise<Entry[]> {
	const entries = await readEntries(ctx, key);
	const seen = cursor.read?.[sessionID];
	const index = seen === undefined ? -1 : entries.findIndex((entry) => entry.id === seen);
	return entries.slice(index + 1).reverse();
}

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
export const NUDGE_MARK = "[board nudge from a peer session, not the user]";

export interface Entry {
	id: string;
	at: string;
	from: string;
	fromTitle: string;
	body: string;
	causedBy: string | null;
	to: string;
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

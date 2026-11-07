/**
 * A shared board for opencode sessions.
 *
 * One tool, `board`: read what is unread, or post an entry that nudges the rest
 * of the group. There is no orchestrator and no hierarchy — a session's group is
 * the directory it works in, so peers in the same project see each other and a
 * subagent joins its root session's board rather than its own worktree.
 */

import { Plugin } from "@opencode/plugin";
import { Schema } from "effect";

/** Everything a session has to remember lives in two storage namespaces. */
const ENTRY_KEY = "board.entries";
const CURSOR_KEY = "board.cursor";

/** The last 50 entries are kept; older ones are dropped on write, never on read. */
const KEEP = 50;

/** A nudge carries at most this much of the body, so a long post cannot flood a prompt. */
const NUDGE_CHARS = 300;

/** The fixed opening of a nudge; the ping-pong guard reads it back off the context. */
const NUDGE_PREFIX = "new board message from ";

interface Entry {
	id: string;
	at: string;
	from: string;
	fromTitle: string;
	body: string;
	causedBy: string | null;
	to: string;
}

interface Cursor {
	/** Session id -> the id of the last entry it has acknowledged. */
	read: Record<string, string>;
}

/** A session as `session.list()` reports it, narrowed to what grouping needs. */
/** `session.list()` answers either a bare array or `{ sessions }` depending on the build. */
type SessionList = SessionRow[] | { sessions?: SessionRow[] };

interface SessionRow {
	id: string;
	title?: string | null;
	directory?: string | null;
	parentID?: string | null;
}

/** Hash a directory into a key component: paths carry slashes, storage keys do not. */
function groupKey(directory: string): string {
	let hash = 0x811c9dc5;
	for (let i = 0; i < directory.length; i += 1) {
		hash ^= directory.charCodeAt(i);
		hash = Math.imul(hash, 0x01000193) >>> 0;
	}
	return `board.group.${hash.toString(16).padStart(8, "0")}`;
}

/** Walk parent links to the root session, so a nested subagent lands on the root's board. */
function rootOf(rows: readonly SessionRow[], sessionID: string): SessionRow | undefined {
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
function triggeredByNudge(rows: readonly { type?: string; text?: unknown }[]): boolean {
	for (let i = rows.length - 1; i >= 0; i -= 1) {
		const row = rows[i];
		if (row?.type !== "user") continue;
		return typeof row.text === "string" && row.text.startsWith(NUDGE_PREFIX);
	}
	return false;
}

async function readEntries(
	ctx: Parameters<Parameters<typeof Plugin.define>[0]["setup"]>[0],
	key: string,
): Promise<Entry[]> {
	const stored = await ctx.storage.get(key);
	return Array.isArray(stored) ? (stored as Entry[]) : [];
}

export default Plugin.define({
	id: "board",
	async setup(ctx) {
		ctx.tool.transform((tools) => {
			tools.add({
				name: "board",
				description:
					"Shared board for the sessions working in this directory. Call with no arguments to read what you have not seen; call with `post` to publish an entry and nudge the rest of the group.",
				input: Schema.Struct({
					post: Schema.optional(Schema.String),
					to: Schema.optional(Schema.String),
					group: Schema.optional(Schema.String),
				}),
				execute: async (input, context) => {
					const listed = (await ctx.session.list()) as unknown as SessionList;
					const rows = Array.isArray(listed) ? listed : (listed.sessions ?? []);
					const caller = rows.find((row) => row.id === context.sessionID);
					const root = rootOf(rows, context.sessionID) ?? caller;
					const group = input.group ?? root?.directory ?? "";
					const key = groupKey(group);

					const entries = await readEntries(ctx, key);
					const cursor = ((await ctx.storage.get(CURSOR_KEY)) ?? { read: {} }) as Cursor;

					if (input.post === undefined) {
						const seen = cursor.read?.[context.sessionID];
						const index =
							seen === undefined
								? -1
								: entries.findIndex((entry) => entry.id === seen);
						const unread = entries.slice(index + 1).reverse();
						const body =
							unread.length === 0
								? "board: nothing unread"
								: unread
										.map(
											(entry) =>
												`#${entry.id} ${entry.at} ${entry.fromTitle}: ${entry.body}`,
										)
										.join("\n");
						return { content: body };
					}

					const at = new Date().toISOString();
					const id = String(Date.now());
					const fromNudge = await (async () => {
						try {
							const context_ = (await ctx.session.context({
								sessionID: context.sessionID,
							})) as {
								type?: string;
								text?: unknown;
							}[];
							return triggeredByNudge(context_);
						} catch {
							return false;
						}
					})();

					const entry: Entry = {
						id,
						at,
						from: context.sessionID,
						fromTitle: caller?.title ?? context.sessionID,
						body: input.post,
						causedBy: fromNudge ? "nudge" : null,
						to: input.to ?? "all",
					};

					const next = [...entries, entry].slice(-KEEP);
					await ctx.storage.set(key, next as unknown as never);

					const targets = rows.filter((row) => {
						if (row.id === context.sessionID) return false;
						const rowRoot = rootOf(rows, row.id) ?? row;
						return (rowRoot.directory ?? "") === group;
					});

					const nudged: string[] = [];
					if (!fromNudge) {
						for (const target of targets) {
							const text = `${NUDGE_PREFIX}${entry.fromTitle}: ${entry.body.slice(0, NUDGE_CHARS)} (#${entry.id})`;
							try {
								await ctx.session.prompt({
									sessionID: target.id,
									text,
									delivery: "steer",
								});
								nudged.push(target.id);
							} catch {
								// A session that ended between list() and prompt() is not an error for the poster.
							}
						}
					}

					cursor.read = { ...(cursor.read ?? {}), [context.sessionID]: id };
					await ctx.storage.set(CURSOR_KEY, cursor as unknown as never);

					return { content: `posted #${id} to ${group}; nudged ${nudged.length}` };
				},
			});
		});
	},
});

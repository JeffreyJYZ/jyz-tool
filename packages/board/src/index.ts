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
import type { Cursor, Entry, SessionList, SessionRow } from "./group.ts";
import {
	CURSOR_KEY,
	claimConflicts,
	directoryOf,
	ENTRY_KEY,
	groupKey,
	KEEP,
	NUDGE_CHARS,
	NUDGE_MARK,
	NUDGE_PREFIX,
	readEntries,
	resolveGroup,
	rootOf,
	triggeredByNudge,
	unreadEntries,
	WAIT_DEFAULT_MS,
	waitForEntries,
} from "./group.ts";

export default Plugin.define({
	id: "board",
	async setup(ctx) {
		ctx.tool.transform((tools) => {
			tools.add({
				name: "board_wait",
				description:
					"Block until a matching board entry arrives for this session, then return it like a read. `match` is a case-sensitive substring of the body or the sender title; omit it to wake on any new entry. Answers a timeout notice rather than staying silent.",
				input: Schema.Struct({
					match: Schema.optional(Schema.String),
					timeout_ms: Schema.optional(Schema.Number),
				}),
				execute: async (input, context) => {
					const { group, key } = await resolveGroup(ctx, context.sessionID);
					const cursor = ((await ctx.storage.get(CURSOR_KEY)) ?? { read: {} }) as Cursor;

					const found = await waitForEntries(
						() => unreadEntries(ctx, key, cursor, context.sessionID),
						input.match,
						input.timeout_ms ?? WAIT_DEFAULT_MS,
					);
					// Even a timeout acknowledges what already exists, so a caller that
					// waits does not replay the same backlog on its next read.
					const all = await readEntries(ctx, key);
					const newest = all.at(-1);
					if (newest !== undefined) {
						cursor.read = { ...(cursor.read ?? {}), [context.sessionID]: newest.id };
						await ctx.storage.set(CURSOR_KEY, cursor as unknown as never);
					}
					if (found === null)
						return { content: "board: nothing matching before the timeout" };
					return {
						content: found
							.map(
								(entry) =>
									`#${entry.id} ${entry.at} ${entry.fromTitle}: ${entry.body}`,
							)
							.join("\n"),
					};
				},
			});

			tools.add({
				name: "board",
				description:
					"Shared board for the sessions working in this directory. Call with no arguments to read what you have not seen; call with `post` to publish an entry and nudge the rest of the group.",
				input: Schema.Struct({
					post: Schema.optional(Schema.String),
					to: Schema.optional(Schema.String),
					group: Schema.optional(Schema.String),
					files: Schema.optional(Schema.Array(Schema.String)),
				}),
				execute: async (input, context) => {
					const { group, key, rows, caller } = await resolveGroup(
						ctx,
						context.sessionID,
						input.group,
					);

					const entries = await readEntries(ctx, key);
					const cursor = ((await ctx.storage.get(CURSOR_KEY)) ?? { read: {} }) as Cursor;

					if (input.post === undefined) {
						const unread = await unreadEntries(ctx, key, cursor, context.sessionID);
						// Reading acknowledges: the next call answers only what arrived after this one.
						const newest = entries.at(-1);
						if (newest !== undefined) {
							cursor.read = {
								...(cursor.read ?? {}),
								[context.sessionID]: newest.id,
							};
							await ctx.storage.set(CURSOR_KEY, cursor as unknown as never);
						}
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
						...(input.files === undefined ? {} : { files: [...input.files] }),
					};

					const next = [...entries, entry].slice(-KEEP);
					await ctx.storage.set(key, next as unknown as never);

					const targets = rows.filter((row) => {
						if (row.id === context.sessionID) return false;
						const rowRoot = rootOf(rows, row.id) ?? row;
						return directoryOf(rowRoot) === group;
					});

					const nudged: string[] = [];
					if (!fromNudge) {
						for (const target of targets) {
							const text = `${NUDGE_MARK}\n${NUDGE_PREFIX}${entry.fromTitle}: ${entry.body.slice(0, NUDGE_CHARS)} (#${entry.id})`;
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

					// Against the entries that existed BEFORE this post: the new entry claims
					// the same paths and would otherwise own them already.
					const conflicts = claimConflicts(entries, input.files ?? [], context.sessionID);
					const warning =
						conflicts.length === 0
							? ""
							: `\nCLAIM CONFLICT: ${conflicts
									.map(
										(conflict) =>
											`${conflict.file} already claimed by ${conflict.title}`,
									)
									.join("; ")}`;

					return {
						content: `posted #${id} to ${group}; nudged ${nudged.length}${warning}`,
					};
				},
			});
		});
	},
});

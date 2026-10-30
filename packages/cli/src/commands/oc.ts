/**
 * `jyz oc`: a thin client over a running opencode server.
 *
 * Hidden from the help body for the same reason `serve` is: it exists so a person can inspect or
 * drive the server jyz talks to, not so jyz grows an opencode command surface. The commands only
 * format and report; every HTTP decision lives in `@jyz/core`'s `funcs/opencode.ts`.
 */
import type { CAC, Command } from "cac";
import {
	listSessions,
	type OpencodeSession,
	resolveServer,
	sendPrompt,
	spawnServer,
} from "../../../core/src/funcs/opencode.ts";
import { guard } from "../lib/errors.ts";

/** A fetcher that carries the resolved bearer token, for a server started with one. */
function fetcherFor(token: string | undefined): typeof fetch {
	if (token === undefined) return fetch;
	const wrapped = (input: string | URL | Request, init?: RequestInit) => {
		const headers = new Headers(init?.headers);
		headers.set("authorization", `Bearer ${token}`);
		return fetch(input, { ...init, headers });
	};
	return Object.assign(wrapped, { preconnect: fetch.preconnect });
}

function formatSession(session: OpencodeSession): string {
	const parts = [session.id, session.title];
	if (session.updatedAt !== "") parts.push(session.updatedAt);
	return parts.join("  ");
}

function printSessions(sessions: readonly OpencodeSession[]): void {
	if (sessions.length === 0) {
		console.log("no opencode sessions");
		return;
	}
	for (const session of sessions) console.log(formatSession(session));
}

interface UrlOptions {
	url?: string;
}

interface PromptOptions extends UrlOptions {
	session?: string;
	spawn?: boolean;
}

export function registerOc(cli: CAC): void {
	const command = cli
		.command("oc [action] [...text]", "drive a running opencode server")
		.option("--session <id>", "session to send a prompt to")
		.option("--url <url>", "server base URL, defaults to $JYZ_OPENCODE_URL")
		.option("--spawn", "spawn an opencode server first");

	command.action(async (action: string | undefined, text: string[], options: PromptOptions) => {
		await guard(async () => {
			let spawned: Awaited<ReturnType<typeof spawnServer>> | undefined;
			try {
				if (options?.spawn) {
					spawned = await spawnServer({ cwd: process.cwd() });
				}
				const server =
					spawned !== undefined
						? resolveServer({ url: spawned.baseUrl })
						: resolveServer({ url: options?.url });
				switch (action ?? "") {
					case "sessions": {
						printSessions(await listSessions(server.baseUrl, fetcherFor(server.token)));
						return;
					}
					case "prompt": {
						const sessionId = options?.session?.trim();
						if (sessionId === undefined || sessionId === "") {
							throw new Error("--session <id> is required");
						}
						const body = (text ?? []).join(" ").trim();
						if (body === "") throw new Error("a prompt is required");
						await sendPrompt(server.baseUrl, sessionId, body, fetcherFor(server.token));
						console.log(`sent to ${sessionId}`);
						return;
					}
					default: {
						throw new Error("usage: jyz oc <sessions|prompt> [options]");
					}
				}
			} finally {
				if (spawned !== undefined) await spawned.stop();
			}
		});
	});

	hideInHelp(cli, [command]);
}

/**
 * cac renders every registered command in the help body, so hiding one means narrowing `commands`
 * for the duration of that render. `serve` installs its own filter; the two chain, each removing
 * only its own commands and restoring the list it was handed.
 */
function hideInHelp(cli: CAC, hidden: readonly Command[]): void {
	const set = new Set(hidden);
	const original = cli.outputHelp.bind(cli);
	cli.outputHelp = (): void => {
		const commands = cli.commands;
		cli.commands = commands.filter((command) => !set.has(command));
		try {
			original();
		} finally {
			cli.commands = commands;
		}
	};
}

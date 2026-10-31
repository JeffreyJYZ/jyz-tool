/**
 * `jyz serve`: the JSON-RPC stdio server the desktop shell drives.
 */
import type { CAC, Command } from "cac";
import { reportError } from "../lib/errors.ts";
import { createRpcServer, serveStdio } from "../rpc.ts";

const HIDDEN = new WeakMap<CAC, Set<Command>>();

export function registerServe(cli: CAC): void {
	const command = cli
		.command("serve", "run the JSON-RPC stdio server")
		.option("--cwd <dir>", "project directory, defaults to the current one")
		.option("--execute [value]", "execute resolved commands");

	command.action(async (options: { cwd?: string; execute?: string | boolean }) => {
		const cwd = options?.cwd ?? process.cwd();
		const execute = parseExecute(options?.execute);
		try {
			await serveStdio(createRpcServer({ cwd, execute }));
		} catch (error) {
			process.exitCode = reportError(error);
		}
	});

	hideInHelp(cli, command);
}

function parseExecute(value: string | boolean | undefined): boolean {
	if (value === undefined || value === true) return true;
	if (value === false) return false;
	if (typeof value === "string") {
		const lower = value.toLowerCase();
		if (lower === "true" || lower === "1" || lower === "yes" || lower === "on") return true;
		if (lower === "false" || lower === "0" || lower === "no" || lower === "off") return false;
		return false;
	}
	return false;
}

function hideInHelp(cli: CAC, hidden: Command): void {
	const existing = HIDDEN.get(cli);
	if (existing !== undefined) {
		existing.add(hidden);
		return;
	}
	const hiddenCommands = new Set<Command>([hidden]);
	HIDDEN.set(cli, hiddenCommands);
	const original = cli.outputHelp.bind(cli);
	cli.outputHelp = (): void => {
		const commands = cli.commands;
		cli.commands = commands.filter((command) => !hiddenCommands.has(command));
		try {
			original();
		} finally {
			cli.commands = commands;
		}
	};
}

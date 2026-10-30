/**
 * `jyz serve`: the JSON-RPC stdio server the desktop shell drives.
 *
 * The command is registered with cac but kept out of the command list a user reads, because it is a
 * machine surface: a person has no reason to type it, and a client wiring it up knows the name.
 */
import type { CAC, Command } from "cac";
import { reportError } from "../lib/errors.ts";
import { createRpcServer, serveStdio } from "../rpc.ts";

const HIDDEN = new WeakMap<CAC, Set<Command>>();

export function registerServe(cli: CAC): void {
	const command = cli
		.command("serve", "run the JSON-RPC stdio server")
		.option("--cwd <dir>", "project directory, defaults to the current one");

	command.action(async (options: { cwd?: string }) => {
		const cwd = options?.cwd ?? process.cwd();
		try {
			await serveStdio(createRpcServer({ cwd }));
		} catch (error) {
			process.exitCode = reportError(error);
		}
	});

	hideInHelp(cli, command);
}

/**
 * cac renders every registered command in the help body, so hiding one means narrowing `commands`
 * for the duration of that render. The patch installs once per CLI and filters by identity, which
 * keeps a later hidden command additive.
 */
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

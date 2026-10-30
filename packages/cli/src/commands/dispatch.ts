import type { Verb } from "@jyz/core";
import type { CAC } from "cac";
import { parseVerbArgs } from "../lib/args.ts";
import { resolveContext } from "../lib/context.ts";
import { buildDispatchSpec } from "../lib/dispatch.ts";
import { guard } from "../lib/errors.ts";
import { runSpec } from "../lib/run.ts";
import {
	buildScriptSpec,
	formatScripts,
	mergeScripts,
	readPackageScripts,
} from "../lib/scripts.ts";

interface VerbSpec {
	verb: Verb;
	/** Extra cac names: the dispatch aliases only. */
	aliases?: string[];
	usage: string;
	description: string;
	options: { dev?: boolean; latest?: boolean };
}

const VERBS: VerbSpec[] = [
	{
		verb: "install",
		usage: "install [args...]",
		description: "install dependencies",
		options: {},
	},
	{
		verb: "add",
		usage: "add <pkgs...>",
		description: "add dependencies (-D for dev)",
		options: { dev: true },
	},
	{
		verb: "remove",
		aliases: ["rm"],
		usage: "remove <pkgs...>",
		description: "remove dependencies",
		options: {},
	},
	{
		verb: "run",
		usage: "run [script] [args...]",
		description: "run a script, or list them",
		options: {},
	},
	{
		verb: "exec",
		aliases: ["x"],
		usage: "exec <bin> [args...]",
		description: "run a binary",
		options: {},
	},
	{
		verb: "update",
		usage: "update [pkgs...]",
		description: "update dependencies (--latest to ignore ranges)",
		options: { latest: true },
	},
	{ verb: "outdated", usage: "outdated", description: "list outdated dependencies", options: {} },
];

/** Every dispatch verb forwards to the package manager the project already uses. */
export function registerDispatch(cli: CAC): void {
	for (const spec of VERBS) {
		const command = cli
			.command(spec.usage, spec.description)
			.option("-F, --filter <name>", "act on another package in the monorepo")
			.allowUnknownOptions();
		if (spec.verb === "add") command.option("-D, --dev", "add as a dev dependency");
		if (spec.verb === "update") command.option("--latest", "update to the latest version");
		if (spec.aliases !== undefined) {
			for (const alias of spec.aliases) command.alias(alias);
		}
		command.action(() => {
			void guard(() => dispatch(cli, spec));
		});
	}
}

async function dispatch(cli: CAC, spec: VerbSpec): Promise<void> {
	const term = parseVerbArgs(cli.rawArgs.slice(2), {
		verb: spec.verb,
		aliases: spec.aliases,
		dev: spec.options.dev,
		latest: spec.options.latest,
		filter: true,
		verbose: true,
	});
	const ctx = resolveContext(process.cwd(), term.filter);
	const pm = ctx.config.project.package_manager.value;
	const origin = `package manager ${pm} (${ctx.config.project.package_manager.source})`;

	if (spec.verb === "run") {
		if (term.args.length === 0) {
			listScripts(ctx.config.scripts, ctx.packageDir, ctx.packageName);
			return;
		}
		const name = term.args[0];
		if (name !== undefined) {
			const scripted = buildScriptSpec(
				pm,
				ctx.packageDir,
				name,
				ctx.config.scripts,
				term.args.slice(1),
			);
			process.exitCode = await runSpec(scripted, { verbose: term.verbose, origin });
			return;
		}
	}

	const built = buildDispatchSpec(ctx, {
		verb: spec.verb,
		args: term.args,
		dev: term.dev,
		latest: term.latest,
	});
	process.exitCode = await runSpec(built, { verbose: term.verbose, origin });
}

function listScripts(
	configScripts: Record<string, string>,
	packageDir: string,
	packageName: string,
): void {
	const entries = mergeScripts(configScripts, readPackageScripts(packageDir));
	if (entries.length === 0) {
		console.error(`jyz: ${packageName} has no scripts`);
		process.exitCode = 1;
		return;
	}
	console.log(formatScripts(entries));
}

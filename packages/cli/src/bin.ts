#!/usr/bin/env bun
import { VERSION } from "@jyz/core";
import { cac } from "cac";
import { registerConfig } from "./commands/config.ts";
import { registerCreate } from "./commands/create.ts";
import { registerDispatch } from "./commands/dispatch.ts";
import { registerServe } from "./commands/serve.ts";
import { registerToolchain } from "./commands/toolchain.ts";
import { loadConfigAt, packageDirOf, readConfigTables } from "./lib/context.ts";
import { reportError } from "./lib/errors.ts";
import { runSpec } from "./lib/run.ts";
import { buildScriptSpec, mergeScripts, readPackageScripts } from "./lib/scripts.ts";
import { assertAliases, expandAlias, formatAliases, isCoreVerb } from "./lib/verbs.ts";

const cwd = process.cwd();

let tables: ReturnType<typeof readConfigTables>;
try {
	tables = readConfigTables(cwd);
} catch (error) {
	process.exit(reportError(error));
}

const cli = cac("jyz");
cli.version(VERSION);
cli.option("--verbose", "print the resolved command before running it");
registerConfig(cli);
registerCreate(cli);
registerDispatch(cli);
registerToolchain(cli);
registerServe(cli);
cli.help((sections) => {
	const aliases = formatAliases(tables.aliases);
	if (aliases === "") return sections;
	return [...sections, { title: "Aliases", body: aliases }];
});

/**
 * Alias expansion runs on argv before cac parses, so an alias can add arguments and still match a
 * command. The bare-script fallback runs here too: a first token that is neither a flag nor a jyz
 * verb is either a script in this package or a typo.
 */
async function main(): Promise<void> {
	const started = process.argv.slice(2);
	let argv: string[];
	try {
		assertAliases(tables.aliases);
		argv = expandAlias(started, tables.aliases);
	} catch (error) {
		process.exit(reportError(error));
	}

	if (argv.length === 0) {
		cli.outputHelp();
		return;
	}

	const headIndex = argv.findIndex((token) => !token.startsWith("-"));
	const head = headIndex === -1 ? "" : (argv[headIndex] ?? "");
	if (head === "help") {
		cli.outputHelp();
		return;
	}

	if (head !== "" && !isCoreVerb(head)) {
		const rest = argv.filter((token, index) => index !== headIndex && token !== "--verbose");
		await runBareScript(head, rest, argv.includes("--verbose"));
		return;
	}

	cli.parse([...process.argv.slice(0, 2), ...argv], { run: false });
	const returned = cli.runMatchedCommand();
	if (returned instanceof Promise) await returned;
}

async function runBareScript(name: string, rest: string[], verbose: boolean): Promise<void> {
	const packageDir = packageDirOf(cwd) ?? cwd;
	const scripts = mergeScripts(tables.scripts, readPackageScripts(packageDir));
	const entry = scripts.find((candidate) => candidate.name === name);
	if (entry === undefined) {
		console.error(`jyz: unknown command "${name}"`);
		cli.outputHelp();
		process.exitCode = 1;
		return;
	}
	const config = loadConfigAt(packageDir);
	const pm = config.project.package_manager.value;
	const spec = buildScriptSpec(pm, packageDir, name, tables.scripts, rest);
	process.exitCode = await runSpec(spec, {
		verbose,
		origin: `package manager ${pm} (${config.project.package_manager.source})`,
	});
}

try {
	await main();
} catch (error) {
	process.exitCode = reportError(error);
}

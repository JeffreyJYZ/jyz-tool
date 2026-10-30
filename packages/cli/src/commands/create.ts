import type { CreateOptions } from "@jyz/core";
import { createProject } from "@jyz/core";
import type { CAC } from "cac";
import { loadConfigAt } from "../lib/context.ts";
import { guard } from "../lib/errors.ts";
import { emit, isJson } from "../lib/output.ts";
import { confirm } from "../lib/prompt.ts";

interface CreateFlags {
	template?: string;
	pm?: string;
	typechecker?: string;
	linter?: string;
	formatter?: string;
	docs?: boolean;
	git?: string;
	install?: boolean;
	publishable?: boolean;
	dir?: string;
	yes?: boolean;
	verbose?: boolean;
	json?: boolean;
}

export function registerCreate(cli: CAC): void {
	cli.command("create <name>", "scaffold a new project from a template")
		.option("--template <template>", "template to render")
		.option("--pm <manager>", "bun or pnpm")
		.option("--typechecker <name>", "typechecker to wire up")
		.option("--linter <name>", "linter to wire up")
		.option("--formatter <name>", "formatter to wire up")
		.option("--docs", "include the docs/ scaffold")
		.option("--git <mode>", "skip, init, commit or github")
		.option("--install", "install dependencies after writing files")
		.option("--publishable", "strip private and add publish metadata")
		.option("--dir <dir>", "target directory, defaults to the project name")
		.option("--json", "emit machine-readable JSON")
		.option("-y, --yes", "accept the resolved options without asking")
		.example("  jyz create acme --template cli --publishable --install")
		.action((name: string, flags: CreateFlags) => {
			void guard(async () => {
				await runCreate(name, flags ?? {});
			});
		});
}

async function runCreate(name: string, flags: CreateFlags): Promise<void> {
	const cwd = process.cwd();
	const config = loadConfigAt(cwd);
	const json = flags.json === true || isJson();

	let template = flags.template;
	if (template === undefined) {
		if (flags.yes === true) {
			template = config.create.default_template;
		} else {
			if (json) emit({ error: "missing required flag --template", exitCode: 1 });
			else console.error("jyz: missing required flag --template");
			process.exitCode = 1;
			return;
		}
	}

	const options: CreateOptions = {
		name,
		template: template as CreateOptions["template"],
		dir: flags.dir,
		packageManager: pickPackageManager(flags.pm) ?? config.create.default_package_manager,
		typechecker: optional(flags.typechecker) as CreateOptions["typechecker"],
		linter: optional(flags.linter) as CreateOptions["linter"],
		formatter: optional(flags.formatter) as CreateOptions["formatter"],
		docs: flags.docs,
		git: (flags.git ?? config.create.git) as CreateOptions["git"],
		install: flags.install,
		publishable: flags.publishable,
		yes: flags.yes,
	};

	if (flags.yes !== true && !json) {
		const accepted = await confirm(
			`Create ${name} from template ${options.template} in ${options.dir ?? name}?`,
		);
		if (!accepted) {
			if (json) emit({ error: "cancelled", exitCode: 1 });
			else console.error("jyz: cancelled");
			process.exitCode = 1;
			return;
		}
	}

	const result = await createProject(options, cwd);
	if (json) {
		emit({ dir: result.dir, files: result.files, warnings: result.warnings });
	} else {
		console.log(`created ${result.dir}`);
		for (const file of result.files) console.log(`  ${file}`);
		for (const warning of result.warnings) console.error(`jyz: warning: ${warning}`);
		for (const warning of result.warnings) {
			const match = warning.match(/https?:\/\/\S+/);
			if (match !== null) console.log(match[0]);
		}
	}
}

function optional(value: string | undefined): string | undefined {
	return value === undefined || value === "" ? undefined : value;
}

function pickPackageManager(value: string | undefined): "bun" | "pnpm" | undefined {
	if (value === undefined || value === "") return undefined;
	if (value === "bun" || value === "pnpm") return value;
	throw new Error(`--pm must be bun or pnpm, got "${value}"`);
}

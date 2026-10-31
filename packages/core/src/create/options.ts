import type { CreateOptions, GitMode, Template } from "../types/create.ts";
import { TEMPLATE_PROFILES } from "./defaults.ts";
import { CreateError } from "./errors.ts";
import { templateExists } from "./template.ts";

const NAME_PATTERN = /^[a-z0-9][a-z0-9._-]*$/i;
const GIT_MODES: GitMode[] = ["skip", "init", "commit", "github"];

export interface ResolvedOptions {
	name: string;
	dir: string;
	template: Template;
	packageManager: string;
	typechecker: string;
	linter: string;
	formatter: string;
	docs: boolean;
	git: GitMode;
	install: boolean;
	publishable: boolean;
	features: string[];
}

export function resolveOptions(options: CreateOptions): ResolvedOptions {
	const name = options.name?.trim() ?? "";
	if (name === "") {
		throw new CreateError("Missing required argument <name>.");
	}
	if (!NAME_PATTERN.test(name)) {
		throw new CreateError(
			`Invalid project name "${name}": use letters, digits, dots, dashes and underscores, starting with a letter or digit.`,
		);
	}

	const template = options.template as Template | undefined;
	if (template === undefined || template === null) {
		throw new CreateError(
			`Missing required flag --template. Available templates: ${availableTemplates().join(", ")}.`,
		);
	}
	const profile = TEMPLATE_PROFILES[template];
	if (profile === undefined) {
		throw new CreateError(
			`Unknown template "${template}". Available templates: ${availableTemplates().join(", ")}.`,
		);
	}

	const packageManager = options.packageManager ?? profile.packageManager;
	const typechecker = options.typechecker ?? profile.typechecker;
	const linter = options.linter ?? profile.linter;
	const formatter = options.formatter ?? profile.formatter;
	if (linter === "bun-lint" && formatter !== "bun-fmt") {
		throw new CreateError(
			`--linter bun-lint requires --formatter bun-fmt: both live in the Bun toolchain. Received --formatter ${formatter}.`,
		);
	}

	const git = options.git ?? profile.git;
	if (!GIT_MODES.includes(git)) {
		throw new CreateError(`Unknown --git mode "${git}". Use skip, init, commit or github.`);
	}

	return {
		name,
		dir: options.dir ?? name,
		template,
		packageManager,
		typechecker,
		linter,
		formatter,
		docs: options.docs ?? profile.docs,
		git,
		install: options.install ?? false,
		publishable: options.publishable ?? false,
		features: options.features ?? [],
	};
}

export function availableTemplates(): string[] {
	return Object.keys(TEMPLATE_PROFILES).filter((template) =>
		templateExists(TEMPLATE_PROFILES[template as Template].dir),
	);
}

import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import type { CreateOptions, CreateResult, GitMode, Template } from "../types/create.ts";
import {
	DEFAULT_PROJECT_VERSION,
	PACKAGE_MANAGER_VERSIONS,
	TEMPLATE_PROFILES,
} from "./defaults.ts";
import { CreateError } from "./errors.ts";
import {
	collectTemplateFiles,
	destinationPath,
	renderTemplate,
	templateExists,
	templatesRoot,
} from "./template.ts";
import { planTooling } from "./tooling.ts";

const NAME_PATTERN = /^[a-z0-9][a-z0-9._-]*$/i;
const GIT_MODES: GitMode[] = ["skip", "init", "commit", "github"];

interface ResolvedOptions {
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
}

/**
 * Renders one template into `<cwd>/<dir>` and returns what it wrote. Nothing is written until
 * every option has been validated.
 */
export async function createProject(options: CreateOptions, cwd: string): Promise<CreateResult> {
	const opts = resolveOptions(options);
	const profile = TEMPLATE_PROFILES[opts.template];
	const sourceRoot = join(templatesRoot(), profile.dir);
	if (!existsSync(sourceRoot)) {
		throw new CreateError(
			`Template "${opts.template}" is not available in this build. Available templates: ${availableTemplates().join(", ")}.`,
		);
	}

	const target = resolve(cwd, opts.dir);
	await assertUsableTarget(target);

	const values: Record<string, string> = {
		__NAME__: opts.name,
		__VERSION__: DEFAULT_PROJECT_VERSION,
		__PACKAGE_MANAGER__: opts.packageManager,
		__TYPECHECKER__: opts.typechecker,
		__LINTER__: opts.linter,
		__FORMATTER__: opts.formatter,
	};

	const sources = await collectTemplateFiles(sourceRoot, opts.docs);
	await renderTemplate(sourceRoot, target, sources, values);

	const files = new Set(sources.map((source) => destinationPath(source)));
	const warnings: string[] = [];

	if (profile.js) {
		const tooling = planTooling(
			opts.packageManager,
			opts.typechecker,
			opts.linter,
			opts.formatter,
		);
		for (const [path, content] of Object.entries(tooling.files)) {
			const destination = join(target, ...path.split("/"));
			await mkdir(dirname(destination), { recursive: true });
			await writeFile(destination, content, "utf8");
			files.add(path);
		}
		await finalizeManifest(target, opts, tooling.scripts, tooling.devDependencies);
		files.add("package.json");
	} else if (opts.publishable) {
		warnings.push(
			`--publishable has no effect on the ${opts.template} template: no JS manifest.`,
		);
	}

	return { dir: target, files: [...files].sort(), warnings };
}

function resolveOptions(options: CreateOptions): ResolvedOptions {
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
	};
}

function availableTemplates(): string[] {
	return Object.keys(TEMPLATE_PROFILES).filter((template) =>
		templateExists(TEMPLATE_PROFILES[template as Template].dir),
	);
}

async function assertUsableTarget(target: string): Promise<void> {
	if (!existsSync(target)) return;
	const info = await stat(target);
	if (!info.isDirectory()) {
		throw new CreateError(`Target ${target} exists and is not a directory.`);
	}
	const entries = await readdir(target);
	if (entries.length > 0) {
		throw new CreateError(
			`Target directory ${target} is not empty; choose another name or --dir.`,
		);
	}
}

interface Manifest {
	name?: string;
	version?: string;
	private?: boolean;
	scripts?: Record<string, string>;
	devDependencies?: Record<string, string>;
	files?: string[];
	bin?: Record<string, string>;
	engines?: Record<string, string>;
	publishConfig?: { access: string };
	packageManager?: string;
}

async function finalizeManifest(
	target: string,
	opts: ResolvedOptions,
	scripts: Record<string, string>,
	devDependencies: Record<string, string>,
): Promise<void> {
	const path = join(target, "package.json");
	const manifest = JSON.parse(await readFile(path, "utf8")) as Manifest;

	manifest.scripts = { ...manifest.scripts, ...scripts };
	if (Object.keys(devDependencies).length > 0) {
		manifest.devDependencies = { ...manifest.devDependencies, ...devDependencies };
	}

	if (opts.publishable) {
		delete manifest.private;
		manifest.files = ["dist"];
		manifest.publishConfig = { access: "public" };
		manifest.engines =
			opts.packageManager === "bun" ? { bun: ">=1.4.0" } : { node: ">=22.0.0" };
		const pinned = PACKAGE_MANAGER_VERSIONS[opts.packageManager];
		if (pinned) manifest.packageManager = `${opts.packageManager}@${pinned}`;
		if (opts.template === "cli") {
			manifest.bin = { [opts.name]: "./dist/bin.js" };
			manifest.scripts = {
				...manifest.scripts,
				build: "bun build src/bin.ts --outdir dist --target bun",
			};
		}
	}

	await writeFile(path, `${JSON.stringify(manifest, null, "\t")}\n`, "utf8");
}

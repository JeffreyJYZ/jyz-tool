import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { makeFsContext } from "../features/context.ts";
import { applyFeatures, listFeatures } from "../features/index.ts";
import type { CreateOptions, CreateResult } from "../types/create.ts";
import { DEFAULT_PROJECT_VERSION, TEMPLATE_PROFILES } from "./defaults.ts";
import { CreateError } from "./errors.ts";
import { applyGitSteps, assertGithubReady } from "./git.ts";
import { installDependencies } from "./install.ts";
import { finalizeManifest } from "./manifest.ts";
import { availableTemplates, resolveOptions } from "./options.ts";
import { assertUsableTarget } from "./target.ts";
import {
	collectTemplateFiles,
	destinationPath,
	renderTemplate,
	templatesRoot,
} from "./template.ts";
import { planTooling } from "./tooling.ts";

export async function createProject(options: CreateOptions, cwd: string): Promise<CreateResult> {
	const opts = resolveOptions(options);
	const profile = TEMPLATE_PROFILES[opts.template];
	for (const id of opts.features) {
		const feature = listFeatures().find((candidate) => candidate.id === id);
		if (feature === undefined) {
			throw new CreateError(`Unknown feature "${id}".`);
		}
		if (!feature.templates.includes(opts.template)) {
			throw new CreateError(
				`Feature "${id}" cannot be applied to template "${opts.template}".`,
			);
		}
	}
	const sourceRoot = join(templatesRoot(), profile.dir);
	if (!existsSync(sourceRoot)) {
		throw new CreateError(
			`Template "${opts.template}" is not available in this build. Available templates: ${availableTemplates().join(", ")}.`,
		);
	}

	const target = resolve(cwd, opts.dir);
	await assertUsableTarget(target);

	if (opts.git === "github") await assertGithubReady(cwd);

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
	const appliedFeatures: string[] = [];

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

	if (opts.features.length > 0) {
		const result = await applyFeatures(target, opts.features, makeFsContext(target));
		appliedFeatures.push(...result.applied, ...result.skipped);
	}

	if (opts.install) {
		const warning = await installDependencies(target, opts.packageManager);
		if (warning !== undefined) warnings.push(warning);
	}
	await applyGitSteps(target, opts.name, opts.git);

	return {
		dir: target,
		files: [...files].sort(),
		warnings,
		features: appliedFeatures,
		applied: appliedFeatures,
		appliedFeatures,
	};
}

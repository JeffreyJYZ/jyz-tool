import type { Template } from "../types/create.ts";
import { FeatureError } from "./errors.ts";

export { FeatureError } from "./errors.ts";

import type { FeatureContext } from "./context.ts";

export type { FeatureContext } from "./context.ts";

import { applyCacCli } from "./cac-cli.ts";
import { makeFsContext } from "./context.ts";
import { applyUpdater } from "./updater.ts";

export interface Feature {
	id: string;
	summary: string;
	templates: Template[];
}

export interface ApplyResult {
	applied: string[];
	skipped: string[];
}

const FEATURES: Feature[] = [
	{
		id: "updater",
		summary: "Tauri updater plugin wiring and README note",
		templates: ["vite-tauri"],
	},
	{
		id: "cac-cli",
		summary: "cac-based CLI entry point, bin merge and smoke test",
		templates: ["cli", "monorepo"],
	},
];

const APPLIERS: Record<
	string,
	(dir: string, ctx: FeatureContext) => Promise<"applied" | "already applied">
> = {
	updater: applyUpdater,
	"cac-cli": applyCacCli,
};

export function listFeatures(): Feature[] {
	return FEATURES.map((feature) => ({
		id: feature.id,
		summary: feature.summary,
		templates: [...feature.templates],
	}));
}

function detectTemplates(ctx: FeatureContext): Template[] {
	const found: Template[] = [];
	if (ctx.exists("package.json")) found.push("cli", "monorepo", "next");
	if (ctx.exists("Cargo.toml")) found.push("rust-bin", "rust-lib", "vite-tauri");
	if (ctx.exists("src-tauri/tauri.conf.json")) found.push("vite-tauri");
	return found;
}

export async function applyFeature(
	dir: string,
	id: string,
	ctx?: FeatureContext,
): Promise<"applied" | "already applied"> {
	const context = ctx ?? makeFsContext(dir);
	const feature = FEATURES.find((candidate) => candidate.id === id);
	if (feature === undefined) {
		throw new FeatureError(`Unknown feature "${id}".`);
	}
	const templates = detectTemplates(context);
	const compatible = feature.templates.some((template) => templates.includes(template));
	if (!compatible) {
		const templateName = templates[0] ?? "unknown";
		throw new FeatureError(`Feature "${id}" cannot be applied to template "${templateName}".`);
	}
	const applier = APPLIERS[id];
	if (applier === undefined) throw new FeatureError(`Unknown feature "${id}".`);
	return applier(dir, context);
}

export async function applyFeatures(
	dir: string,
	ids: string[],
	ctx?: FeatureContext,
): Promise<ApplyResult> {
	const context = ctx ?? makeFsContext(dir);
	// Validate before writing anything.
	for (const id of ids) {
		const feature = FEATURES.find((candidate) => candidate.id === id);
		if (feature === undefined) {
			throw new FeatureError(`Unknown feature "${id}".`);
		}
	}
	const templates = detectTemplates(context);
	for (const id of ids) {
		const feature = FEATURES.find((candidate) => candidate.id === id);
		if (feature === undefined) continue;
		const compatible = feature.templates.some((template) => templates.includes(template));
		if (!compatible) {
			const templateName = templates[0] ?? "unknown";
			throw new FeatureError(
				`Feature "${id}" cannot be applied to template "${templateName}".`,
			);
		}
	}

	const applied: string[] = [];
	const skipped: string[] = [];
	for (const id of ids) {
		const applier = APPLIERS[id];
		if (applier === undefined) continue;
		const result = await applier(dir, context);
		if (result === "already applied") skipped.push(id);
		else applied.push(id);
	}
	return { applied, skipped };
}

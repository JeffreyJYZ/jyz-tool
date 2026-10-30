// MCP resources: read-only views an agent needs before acting.
//
// Two URIs, both JSON text: the merged config together with the layer each value came from, and the
// capability manifest the CLI and the desktop bridge also read. Both come from `@jyz/core`, so a
// resource can never describe a surface jyz does not have.

import { listCapabilities, resolveProject } from "@jyz/core";

export interface ResourceDefinition {
	uri: string;
	name: string;
	description: string;
	mimeType: string;
}

export interface ResourceContents {
	uri: string;
	mimeType: string;
	text: string;
}

/** A URI `resources/read` was asked for that jyz does not serve. */
export class UnknownResourceError extends Error {
	readonly uri: string;
	readonly validUris: string[];

	constructor(uri: string, validUris: string[]) {
		super(`unknown resource "${uri}"; valid resources: ${validUris.join(", ")}`);
		this.name = "UnknownResourceError";
		this.uri = uri;
		this.validUris = validUris;
	}
}

const JSON_MIME = "application/json";

const RESOURCES: readonly ResourceDefinition[] = Object.freeze([
	{
		uri: "jyz://config",
		name: "jyz config",
		description:
			"The merged jyz configuration, with the source layer of every project key and the config files that were read.",
		mimeType: JSON_MIME,
	},
	{
		uri: "jyz://capabilities",
		name: "jyz capabilities",
		description: "Every verb jyz answers to, in registration order.",
		mimeType: JSON_MIME,
	},
]);

/** Every resource this server exposes. Each call returns fresh copies, so callers may edit. */
export function listResources(): ResourceDefinition[] {
	return RESOURCES.map((resource) => ({ ...resource }));
}

/** Read one resource as JSON text. `target` is a directory or `{ cwd }`; it defaults to the cwd. */
export function readResource(uri: string, target?: string | { cwd?: string }): ResourceContents {
	const validUris = RESOURCES.map((resource) => resource.uri);
	const resource = RESOURCES.find((candidate) => candidate.uri === uri);
	if (resource === undefined) throw new UnknownResourceError(uri, validUris);

	const payload =
		uri === "jyz://capabilities" ? capabilityPayload() : configPayload(cwdOf(target));
	return { uri, mimeType: resource.mimeType, text: JSON.stringify(payload, null, 2) };
}

function cwdOf(target?: string | { cwd?: string }): string {
	if (typeof target === "string") return target;
	return target?.cwd ?? process.cwd();
}

function configPayload(cwd: string): Record<string, unknown> {
	const context = resolveProject(cwd);
	return {
		path: context.config.path,
		layers: context.config.layers,
		warnings: context.warnings,
		project: context.config.project,
		aliases: context.config.aliases,
		scripts: context.config.scripts,
		create: context.config.create,
		monorepo: context.config.monorepo,
		root: context.root,
		packageDir: context.packageDir,
		packageName: context.packageName,
	};
}

function capabilityPayload(): Record<string, unknown> {
	return { capabilities: listCapabilities() };
}

import type { ResolvedConfig, Source } from "@jyz/core";

export interface ConfigEntry {
	key: string;
	value: string;
	source: Source;
}

const PROJECT_KEYS = ["package_manager", "typechecker", "linter", "formatter"] as const;
const CREATE_KEYS = ["default_template", "default_package_manager", "git"] as const;

/** The four resolved project values, each with the layer that produced it. */
export function projectEntries(config: ResolvedConfig): ConfigEntry[] {
	return PROJECT_KEYS.map((key) => ({
		key: `project.${key}`,
		value: config.project[key].value,
		source: config.project[key].source,
	}));
}

/** `jyz config show`: every resolved value on one line with its source. */
export function formatConfigShow(config: ResolvedConfig): string {
	const lines = [`config: ${config.path ?? "(none)"}`];
	for (const entry of projectEntries(config)) {
		lines.push(`${entry.key} = ${entry.value} (${entry.source})`);
	}
	lines.push(`aliases: ${formatMap(config.aliases)}`);
	lines.push(`scripts: ${formatMap(config.scripts)}`);
	lines.push(`create.default_template = ${config.create.default_template}`);
	lines.push(`create.default_package_manager = ${config.create.default_package_manager}`);
	lines.push(`create.git = ${config.create.git}`);
	lines.push(`monorepo.default_filter = ${config.monorepo.default_filter}`);
	for (const layer of config.layers) lines.push(`layer: ${layer}`);
	for (const warning of config.warnings) lines.push(`warning: ${warning}`);
	return lines.join("\n");
}

/**
 * `jyz config get <key>`: one resolved value, addressed with or without its `project.` prefix.
 * Returns null for a key jyz does not resolve, so the caller can name it and exit non-zero.
 */
export function lookupConfigValue(
	config: ResolvedConfig,
	dotted: string,
): { key: string; value: string } | null {
	const trimmed = dotted.trim();
	if (trimmed === "") return null;

	const bare = trimmed.startsWith("project.") ? trimmed.slice("project.".length) : trimmed;
	const projectKey = PROJECT_KEYS.find((key) => key === bare);
	if (projectKey !== undefined) {
		return { key: `project.${projectKey}`, value: config.project[projectKey].value };
	}

	const [section, ...tail] = trimmed.split(".");
	const rest = tail.join(".");

	if (section === "aliases") {
		if (rest === "") return { key: "aliases", value: formatMap(config.aliases) };
		const value = config.aliases[rest];
		return value === undefined ? null : { key: trimmed, value };
	}
	if (section === "scripts") {
		if (rest === "") return { key: "scripts", value: formatMap(config.scripts) };
		const value = config.scripts[rest];
		return value === undefined ? null : { key: trimmed, value };
	}
	if (section === "create") {
		const key = CREATE_KEYS.find((candidate) => candidate === rest);
		if (key === undefined) return null;
		return { key: trimmed, value: config.create[key] };
	}
	if (section === "monorepo" && rest === "default_filter") {
		return { key: trimmed, value: String(config.monorepo.default_filter) };
	}
	return null;
}

function formatMap(map: Record<string, string>): string {
	const keys = Object.keys(map).sort();
	if (keys.length === 0) return "(none)";
	return keys.map((key) => `${key}=${map[key] ?? ""}`).join(", ");
}

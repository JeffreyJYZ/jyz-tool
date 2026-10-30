/**
 * Verb names, user aliases and the bare-script fallback.
 *
 * Alias expansion happens on argv before cac sees it, so an alias can add arguments
 * (`dev = "run dev"`) and still land on a real command.
 */

/** Every name cac resolves on its own, including the dispatch aliases. */
export const CORE_VERBS = [
	"add",
	"capabilities",
	"check",
	"config",
	"create",
	"exec",
	"fmt",
	"install",
	"lint",
	"oc",
	"outdated",
	"remove",
	"rm",
	"run",
	"serve",
	"typecheck",
	"update",
	"x",
] as const;

/** An alias table that cannot be used: it shadows a verb, or expands to nothing. */
export class AliasError extends Error {
	readonly alias: string;

	constructor(alias: string, message?: string) {
		super(message ?? `alias "${alias}" shadows a core verb; rename it in jyz.config.toml`);
		this.name = "AliasError";
		this.alias = alias;
	}
}

export function isCoreVerb(name: string): boolean {
	return (CORE_VERBS as readonly string[]).includes(name);
}

/**
 * Refuses the whole alias table when any name collides with a verb jyz owns, because an alias
 * that silently loses to a built-in is worse than a config that fails to load.
 */
export function assertAliases(aliases: Record<string, string>): void {
	for (const name of Object.keys(aliases).sort()) {
		if (isCoreVerb(name)) throw new AliasError(name);
	}
}

/** Expands `argv[0]` through the alias table, following chained aliases. */
export function expandAlias(argv: readonly string[], aliases: Record<string, string>): string[] {
	const out = [...argv];
	const seen = new Set<string>();
	for (;;) {
		const head = out[0];
		if (head === undefined) return out;
		const target = aliases[head];
		if (target === undefined) return out;
		if (seen.has(head)) {
			throw new AliasError(head, `alias "${head}" expands to itself; fix jyz.config.toml`);
		}
		seen.add(head);
		const tokens = target.split(/\s+/).filter((token) => token !== "");
		if (tokens.length === 0) {
			throw new AliasError(head, `alias "${head}" expands to nothing; fix jyz.config.toml`);
		}
		out.splice(0, 1, ...tokens);
	}
}

/** The `Aliases` help section body, one `name -> expansion` per line. */
export function formatAliases(aliases: Record<string, string>): string {
	return Object.keys(aliases)
		.sort()
		.map((name) => `  ${name} -> ${aliases[name] ?? ""}`)
		.join("\n");
}

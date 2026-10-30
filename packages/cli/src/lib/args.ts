/**
 * Splits one dispatch invocation into the tokens jyz forwards and the flags jyz consumes.
 *
 * The split reads argv directly rather than cac's parsed options so anything jyz does not own
 * (`--exact`, `--watch`, `--frozen-lockfile`) reaches the package manager byte for byte.
 */

import type { Verb } from "@jyz/core";

export interface VerbArgs {
	/** Everything to forward, in the order the user wrote it. */
	args: string[];
	dev: boolean;
	latest: boolean;
	filter: string | undefined;
	verbose: boolean;
}

export interface VerbArgsOptions {
	/** The verb being dispatched, so its own name is dropped from `args`. */
	verb: Verb;
	/** Other names the verb answers to (`rm`, `x`). */
	aliases?: readonly string[];
	/** `-D` / `--dev` is meaningful for this verb. */
	dev?: boolean;
	/** `--latest` is meaningful for this verb. */
	latest?: boolean;
	/** `-F` / `--filter` is meaningful for this verb. */
	filter?: boolean;
	/** `--verbose` is a global flag; pass false only when it must be forwarded. */
	verbose?: boolean;
}

export function parseVerbArgs(argv: readonly string[], options: VerbArgsOptions): VerbArgs {
	const names = new Set<string>([options.verb, ...(options.aliases ?? [])]);
	const out: VerbArgs = {
		args: [],
		dev: false,
		latest: false,
		filter: undefined,
		verbose: false,
	};
	const tokens = [...argv];

	// Drop the verb itself, wherever a global flag put it.
	const verbIndex = tokens.findIndex((token) => names.has(token));
	if (verbIndex !== -1) tokens.splice(verbIndex, 1);

	const takesValue = (token: string, long: string, short: string): string | undefined => {
		if (token === long || token === short) return "";
		const prefix = `${long}=`;
		if (token.startsWith(prefix)) return token.slice(prefix.length);
		return undefined;
	};

	for (let index = 0; index < tokens.length; index++) {
		const token = tokens[index];
		if (token === undefined) continue;

		if (options.verbose !== false && token === "--verbose") {
			out.verbose = true;
			continue;
		}
		if (options.dev === true && (token === "-D" || token === "--dev")) {
			out.dev = true;
			continue;
		}
		if (options.latest === true && token === "--latest") {
			out.latest = true;
			continue;
		}
		if (options.filter === true) {
			const inline = takesValue(token, "--filter", "-F");
			if (inline !== undefined) {
				const value = inline === "" ? tokens[index + 1] : inline;
				if (inline === "") index += 1;
				out.filter = value;
				continue;
			}
		}
		out.args.push(token);
	}

	return out;
}

import type { Feature } from "@jyz/core";

/**
 * Asks one yes/no question when jyz is attached to a terminal.
 *
 * A non-interactive run (CI, a pipe, a test) proceeds without asking: refusing there would make the
 * command unusable, and `--yes` exists to skip this prompt explicitly.
 */
export async function confirm(question: string): Promise<boolean> {
	if (!process.stdin.isTTY) return true;
	const { createInterface } = await import("node:readline/promises");
	const rl = createInterface({ input: process.stdin, output: process.stdout });
	try {
		const answer = await rl.question(`${question} [Y/n] `);
		return !/^n/i.test(answer.trim());
	} finally {
		rl.close();
	}
}

/**
 * Interactively choose which features to apply. Returns the selected ids, or [] for none.
 * Only features compatible with `template` are offered. Empty input means none. An unknown or
 * incompatible entry re-asks; Ctrl-C/EOF means none.
 */
export async function selectFeatures(template: string, features: Feature[]): Promise<string[]> {
	if (!process.stdin.isTTY) return [];
	const candidates = features.filter((feature) =>
		feature.templates.includes(template as Feature["templates"][number]),
	);
	if (candidates.length === 0) return [];

	const { createInterface } = await import("node:readline/promises");
	const rl = createInterface({ input: process.stdin, output: process.stdout });
	try {
		while (true) {
			console.log(`Features available for template ${template}:`);
			candidates.forEach((feature, index) => {
				console.log(`  ${index + 1}. ${feature.id}  ${feature.summary}`);
			});
			let answer = "";
			try {
				answer = await rl.question(
					"Select features (numbers or ids, comma/space separated; empty for none): ",
				);
			} catch {
				return [];
			}
			const tokens = answer.split(/[\s,]+/).filter((token) => token !== "");
			if (tokens.length === 0) return [];

			const chosen: string[] = [];
			let invalid = false;
			for (const token of tokens) {
				let id: string | undefined;
				if (/^\d+$/.test(token)) {
					const index = Number(token) - 1;
					const candidate = candidates[index];
					if (index < 0 || index >= candidates.length || candidate === undefined)
						invalid = true;
					else id = candidate.id;
				} else {
					const match = candidates.find((feature) => feature.id === token);
					if (match === undefined) invalid = true;
					else id = match.id;
				}
				if (invalid || id === undefined) {
					invalid = true;
					break;
				}
				if (!chosen.includes(id)) chosen.push(id);
			}
			if (invalid) {
				console.log("jyz: unknown or incompatible feature; try again");
				continue;
			}
			return chosen;
		}
	} finally {
		rl.close();
	}
}

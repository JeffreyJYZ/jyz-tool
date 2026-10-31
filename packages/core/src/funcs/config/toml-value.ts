import { parse } from "smol-toml";

import { isRecord } from "./helpers.ts";

/**
 * A value as TOML source: pass a well-formed literal through untouched, quote anything else.
 *
 * Split out of `write-utils.ts` when that file reached 202 lines — the two functions are one job
 * (decide the literal form of a value) and share no state with the line surgery next door.
 */
export function tomlValue(rawValue: string): string {
	const trimmed = rawValue.trim();
	if (trimmed === "") return quoteTomlString(rawValue);
	try {
		const parsed = parse(`value = ${trimmed}`);
		if (isRecord(parsed) && parsed.value !== undefined) return trimmed;
	} catch {
		// Not TOML on its own: the caller meant a string, so quote it below.
	}
	return quoteTomlString(rawValue);
}

export function quoteTomlString(value: string): string {
	let out = '"';
	for (const char of value) {
		const code = char.codePointAt(0) ?? 0;
		if (char === "\\") out += "\\\\";
		else if (char === '"') out += '\\"';
		else if (char === "\n") out += "\\n";
		else if (char === "\r") out += "\\r";
		else if (char === "\t") out += "\\t";
		else if (code < 0x20 || code === 0x7f) out += `\\u${code.toString(16).padStart(4, "0")}`;
		else out += char;
	}
	return `${out}"`;
}

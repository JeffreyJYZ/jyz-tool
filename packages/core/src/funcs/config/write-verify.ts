import { isDeepStrictEqual } from "node:util";

import { parse } from "smol-toml";

import { ConfigWriteError } from "./errors.ts";
import { isRecord, messageOf } from "./helpers.ts";
import type { DottedKey } from "./write-utils.ts";

export function verifyRoundTrip(
	path: string,
	before: string,
	after: string,
	target: DottedKey,
	newValue: string,
): void {
	let beforeTree: Record<string, unknown>;
	try {
		beforeTree = plain(parse(before)) as Record<string, unknown>;
	} catch (err) {
		throw new ConfigWriteError(path, `${path} is not valid TOML: ${messageOf(err)}`);
	}

	let afterTree: Record<string, unknown>;
	try {
		afterTree = plain(parse(after)) as Record<string, unknown>;
	} catch (err) {
		throw new ConfigWriteError(
			path,
			`rewriting ${path} would not round-trip: ${messageOf(err)}`,
		);
	}

	let expectedValue: unknown;
	try {
		const snippet = plain(parse(`value = ${newValue}`)) as Record<string, unknown>;
		expectedValue = snippet.value;
	} catch (err) {
		throw new ConfigWriteError(path, `${newValue} is not a TOML value: ${messageOf(err)}`);
	}

	const expected = plain(beforeTree) as Record<string, unknown>;
	const table = expected[target.section];
	if (isRecord(table)) {
		table[target.key] = expectedValue;
	} else {
		expected[target.section] = { [target.key]: expectedValue };
	}

	if (!isDeepStrictEqual(afterTree, expected)) {
		throw new ConfigWriteError(
			path,
			`rewriting "${target.section}.${target.key}" in ${path} would change other keys; refusing`,
		);
	}
}

/**
 * smol-toml builds every table with a null prototype, so a structural comparison against a plain
 * object would differ on the prototype alone. Converting both sides to plain objects keeps dates and
 * big integers intact while making the comparison about content only.
 */
export function plain(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(plain);
	if (value instanceof Date) return value;
	if (isRecord(value)) {
		const out: Record<string, unknown> = {};
		for (const [key, entry] of Object.entries(value)) out[key] = plain(entry);
		return out;
	}
	return value;
}

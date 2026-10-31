import { readFileSync } from "node:fs";

import { ConfigWriteError } from "./errors.ts";
import { isNotFound, messageOf } from "./helpers.ts";
import { tomlValue } from "./toml-value.ts";
import {
	appendSection,
	formatKey,
	insertAfter,
	isTargetLine,
	joinLines,
	lastKeyIndexIn,
	scanKeyLines,
	splitDottedKey,
	splitLines,
	splitValue,
} from "./write-utils.ts";
import { verifyRoundTrip } from "./write-verify.ts";

export function writeConfigValue(
	path: string,
	dottedKey: string,
	rawValue: string,
): { text: string } {
	const target = splitDottedKey(dottedKey);
	if (target === null) {
		throw new ConfigWriteError(
			path,
			`config key "${dottedKey}" has no section: write it as "<section>.<key>"`,
		);
	}

	let text: string;
	try {
		text = readFileSync(path, "utf8");
	} catch (err) {
		if (!isNotFound(err)) {
			throw new ConfigWriteError(path, `cannot read ${path}: ${messageOf(err)}`);
		}
		text = "";
	}

	const eol = text.includes("\r\n") ? "\r\n" : "\n";
	const endsWithEol = text === "" || text.endsWith("\n");
	const lines = splitLines(text);
	const { keys, sections } = scanKeyLines(lines);
	const newValue = tomlValue(rawValue);

	const matches = keys.filter((key) => isTargetLine(key, target, dottedKey));
	if (matches.length > 1) {
		throw new ConfigWriteError(
			path,
			`cannot set "${dottedKey}": ${matches.length} definitions found in ${path}`,
		);
	}

	const hit = matches[0];
	if (hit !== undefined) {
		const line = lines[hit.index];
		if (line === undefined) {
			throw new ConfigWriteError(
				path,
				`cannot set "${dottedKey}": line ${hit.index + 1} vanished`,
			);
		}
		const { value, gap, comment } = splitValue(hit.rest);
		if (value === "") {
			throw new ConfigWriteError(
				path,
				`cannot set "${dottedKey}": line ${hit.index + 1} has no value`,
			);
		}
		lines[hit.index] = {
			body: `${hit.indent}${hit.keyText}${hit.sep}${newValue}${gap}${comment}`,
			eol: line.eol,
		};
	} else {
		const body = `${formatKey(target.key)} = ${newValue}`;
		const headerIndex = sections.get(target.section);
		if (headerIndex !== undefined) {
			insertAfter(lines, lastKeyIndexIn(keys, target.section, headerIndex), body, eol);
		} else {
			appendSection(lines, target.section, body, eol, endsWithEol);
		}
	}

	const next = joinLines(lines);
	verifyRoundTrip(path, text, next, target, newValue);
	return { text: next };
}

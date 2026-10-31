import { isDeepStrictEqual } from "node:util";

import { parse } from "smol-toml";

import { ConfigWriteError } from "./errors.ts";
import { isNotFound, isRecord, messageOf } from "./helpers.ts";
import { quoteTomlString } from "./toml-value.ts";

export interface TextLine {
	body: string;
	eol: string;
}

export interface KeyLine {
	index: number;
	section: string;
	indent: string;
	keyText: string;
	keyName: string;
	sep: string;
	rest: string;
}

export interface DottedKey {
	section: string;
	key: string;
}

export const SECTION_RE = /^\s*\[\s*([^[\]]+?)\s*\]\s*(?:#.*)?$/;
export const KEY_RE = /^(\s*)((?:[A-Za-z0-9_.-]+)|"(?:[^"\\]|\\.)*"|'[^']*')(\s*=\s*)(.*)$/;
export const BARE_KEY_RE = /^[A-Za-z0-9_-]+$/;

export function splitLines(text: string): TextLine[] {
	const lines: TextLine[] = [];
	let start = 0;
	for (let index = 0; index < text.length; index++) {
		if (text[index] !== "\n") continue;
		let end = index;
		let eol = "\n";
		if (end > start && text[end - 1] === "\r") {
			end -= 1;
			eol = "\r\n";
		}
		lines.push({ body: text.slice(start, end), eol });
		start = index + 1;
	}
	if (start < text.length) lines.push({ body: text.slice(start), eol: "" });
	return lines;
}

export function joinLines(lines: TextLine[]): string {
	let text = "";
	for (const line of lines) text += line.body + line.eol;
	return text;
}

export function scanKeyLines(lines: TextLine[]): {
	keys: KeyLine[];
	sections: Map<string, number>;
} {
	const keys: KeyLine[] = [];
	const sections = new Map<string, number>();
	let section = "";
	for (let index = 0; index < lines.length; index++) {
		const line = lines[index];
		if (line === undefined) continue;

		const header = SECTION_RE.exec(line.body);
		if (header !== null) {
			const [, name = ""] = header;
			section = unquoteKey(name.trim());
			if (!sections.has(section)) sections.set(section, index);
			continue;
		}

		const match = KEY_RE.exec(line.body);
		if (match === null) continue;
		const [, indent = "", keyText = "", sep = " = ", rest = ""] = match;
		keys.push({
			index,
			section,
			indent,
			keyText,
			keyName: unquoteKey(keyText),
			sep,
			rest,
		});
	}
	return { keys, sections };
}

export function splitValue(rest: string): { value: string; gap: string; comment: string } {
	let commentIndex = -1;
	let basic = false;
	let literal = false;
	for (let index = 0; index < rest.length; index++) {
		const char = rest[index];
		if (basic) {
			if (char === "\\") index += 1;
			else if (char === '"') basic = false;
		} else if (literal) {
			if (char === "'") literal = false;
		} else if (char === '"') {
			basic = true;
		} else if (char === "'") {
			literal = true;
		} else if (char === "#") {
			commentIndex = index;
			break;
		}
	}
	const withoutComment = commentIndex === -1 ? rest : rest.slice(0, commentIndex);
	const comment = commentIndex === -1 ? "" : rest.slice(commentIndex);
	const lead = withoutComment.length - withoutComment.trimStart().length;
	const value = withoutComment.trim();
	return { value, gap: withoutComment.slice(lead + value.length), comment };
}

export function splitDottedKey(dottedKey: string): DottedKey | null {
	const index = dottedKey.indexOf(".");
	if (index <= 0 || index === dottedKey.length - 1) return null;
	return {
		section: unquoteKey(dottedKey.slice(0, index).trim()),
		key: unquoteKey(dottedKey.slice(index + 1).trim()),
	};
}

export function unquoteKey(text: string): string {
	if (text.length >= 2 && text.startsWith('"') && text.endsWith('"')) {
		return text.slice(1, -1).replace(/\\(["\\])/g, "$1");
	}
	if (text.length >= 2 && text.startsWith("'") && text.endsWith("'")) {
		return text.slice(1, -1);
	}
	return text;
}

export function formatKey(key: string): string {
	return BARE_KEY_RE.test(key) ? key : quoteTomlString(key);
}

export function isTargetLine(line: KeyLine, target: DottedKey, dottedKey: string): boolean {
	if (line.section === target.section && line.keyName === target.key) return true;
	return line.section === "" && line.keyName === dottedKey;
}

export function lastKeyIndexIn(keys: KeyLine[], section: string, headerIndex: number): number {
	let last = headerIndex;
	for (const key of keys) {
		if (key.index > headerIndex && key.section === section) last = key.index;
	}
	return last;
}

export function insertAfter(lines: TextLine[], anchor: number, body: string, eol: string): void {
	const line = lines[anchor];
	const trailingEol = line !== undefined && line.eol === "" ? "" : eol;
	if (line !== undefined && line.eol === "") line.eol = eol;
	lines.splice(anchor + 1, 0, { body, eol: trailingEol });
}

export function appendSection(
	lines: TextLine[],
	section: string,
	body: string,
	eol: string,
	endsWithEol: boolean,
): void {
	const last = lines.at(-1);
	if (last !== undefined) {
		if (last.eol === "") last.eol = eol;
		if (last.body.trim() !== "") lines.push({ body: "", eol });
	}
	lines.push({ body: `[${formatKey(section)}]`, eol });
	lines.push({ body, eol: endsWithEol ? eol : "" });
}

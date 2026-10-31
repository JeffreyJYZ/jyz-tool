/**
 * Enforces the repository rule that no source file is longer than 200 lines.
 *
 * Files that were already oversized when the rule arrived are listed in
 * `docs/refactor/oversized.txt`; the check fails when a *new* file crosses the limit and also when
 * a listed file is no longer oversized, so the exception list can only shrink.
 *
 * Usage: bun scripts/check-file-size.ts
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

export const LIMIT = 200;

const ROOT = resolve(import.meta.dir, "..");
const LIST = join(ROOT, "docs/refactor/oversized.txt");
const ROOTS = ["packages", "scripts"];
const EXTENSIONS = [".ts", ".tsx", ".css", ".rs"];
const SKIP = new Set(["node_modules", "target", "dist", "gen", ".git"]);

function walk(dir: string, out: string[] = []): string[] {
	for (const entry of readdirSync(dir)) {
		if (SKIP.has(entry)) continue;
		const path = join(dir, entry);
		const stat = statSync(path);
		if (stat.isDirectory()) walk(path, out);
		else out.push(path);
	}
	return out;
}

export function countLines(text: string): number {
	if (text === "") return 0;
	const lines = text.split("\n");
	// A trailing newline does not open a new line.
	return lines[lines.length - 1] === "" ? lines.length - 1 : lines.length;
}

export function lineCount(path: string): number {
	const text = readFileSync(path, "utf8");
	return countLines(text);
}

export type Violation = {
	file: string;
	lines: number;
	kind: "new" | "stale";
};

export function findViolations(
	root: string,
	allowed: Set<string> | readonly string[] | string[] = [],
	limit: number = LIMIT,
): Violation[] {
	const allowedSet = allowed instanceof Set ? allowed : new Set(allowed);
	const oversized: { file: string; lines: number }[] = [];

	for (const sub of ROOTS) {
		const base = join(root, sub);
		let files: string[];
		try {
			files = walk(base);
		} catch {
			continue;
		}
		for (const file of files) {
			const ext = file.slice(file.lastIndexOf("."));
			if (!EXTENSIONS.includes(ext)) continue;
			const lines = lineCount(file);
			if (lines <= limit) continue;
			oversized.push({ file: relative(root, file), lines });
		}
	}

	const oversizedFiles = new Set(oversized.map((entry) => entry.file));
	const result: Violation[] = [];

	for (const entry of oversized) {
		if (!allowedSet.has(entry.file)) {
			result.push({ file: entry.file, lines: entry.lines, kind: "new" });
		}
	}

	for (const file of allowedSet) {
		if (!oversizedFiles.has(file)) {
			let lines = 0;
			try {
				lines = lineCount(join(root, file));
			} catch {
				lines = 0;
			}
			result.push({ file, lines, kind: "stale" });
		}
	}

	return result;
}

function loadAllowed(): Set<string> {
	return new Set(
		readFileSync(LIST, "utf8")
			.split("\n")
			.map((line) => line.trim())
			.filter((line) => line !== "" && !line.startsWith("#")),
	);
}

export function runCheck(): number {
	const allowed = loadAllowed();
	const violations = findViolations(ROOT, allowed, LIMIT);

	const fresh = violations.filter((v) => v.kind === "new");
	const stale = violations.filter((v) => v.kind === "stale");

	for (const entry of fresh.sort((a, b) => b.lines - a.lines)) {
		console.error(`over ${LIMIT} lines: ${entry.file} (${entry.lines})`);
	}

	for (const entry of stale) {
		console.error(`listed in oversized.txt but now within ${LIMIT} lines: ${entry.file}`);
		console.error("  remove it from docs/refactor/oversized.txt");
	}

	if (violations.length > 0) {
		console.error(
			`\n${fresh.length} new oversized file(s), ${stale.length} stale exception(s); limit is ${LIMIT} lines`,
		);
		return 1;
	}

	const oversizedCount = findViolations(ROOT, new Set(), LIMIT).length;
	console.log(`${oversizedCount} oversized file(s) remain on the exception list`);
	return 0;
}

if (import.meta.main) {
	process.exit(runCheck());
}

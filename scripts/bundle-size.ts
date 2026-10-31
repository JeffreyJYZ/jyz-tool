#!/usr/bin/env bun
/**
 * Record what a release actually weighs.
 *
 * The desktop plan asks for bundle size per release so "lightweight" stays measurable instead of
 * felt. This reads the artefacts the release just published and appends one row to
 * `docs/progress/releases/sizes.md`; it prints the same row so a release log carries it too.
 *
 * Usage: `bun scripts/bundle-size.ts [version]` — the version defaults to package.json.
 */
import {
	appendFileSync,
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";
import pkg from "../package.json" with { type: "json" };

const ROOT = join(import.meta.dir, "..");
const RELEASE_DIR = join(ROOT, "dist", "release");
const TABLE = join(ROOT, "docs", "progress", "releases", "sizes.md");

const HEADER = [
	"# Release sizes",
	"",
	"Measured from the artefacts in `dist/release` at publish time, in megabytes (MB = 1 000 000 bytes).",
	"",
	"| version | dmg | updater tarball | cli | mcp |",
	"| ------- | --- | --------------- | --- | --- |",
	"",
].join("\n");

/** Megabytes with one decimal, or an em dash when the artefact is not on disk. */
function mb(path: string | null): string {
	if (path === null || !existsSync(path)) return "—";
	return (statSync(path).size / 1_000_000).toFixed(1);
}

function pick(pattern: RegExp, dir: string): string | null {
	if (!existsSync(dir)) return null;
	const match = readdirSync(dir).find((name) => pattern.test(name));
	return match ? join(dir, match) : null;
}

/** Append one row for `version`, once: re-running a release must not duplicate the line. */
export function recordSizes(
	version: string,
	opts: { releaseDir?: string; table?: string } = {},
): string {
	const dir = opts.releaseDir ?? RELEASE_DIR;
	const table = opts.table ?? TABLE;
	const row = `| ${version} | ${mb(pick(/^desktop-.*\.dmg$/, dir))} | ${mb(pick(/^jyz\.app\.tar\.gz$/, dir))} | ${mb(pick(/^cli-/, dir))} | ${mb(pick(/^mcp-\d/, dir))} |`;
	mkdirSync(join(table, ".."), { recursive: true });
	const existing = existsSync(table) ? readFileSync(table, "utf8") : HEADER;
	if (!existsSync(table)) writeFileSync(table, HEADER, "utf8");
	if (!existing.includes(`| ${version} |`)) appendFileSync(table, `${row}\n`, "utf8");
	return row;
}

if (import.meta.main) {
	const version = Bun.argv[2] ?? pkg.version;
	const row = recordSizes(version);
	console.log(`bundle-size ${row}`);
	console.log(`bundle-size  wrote ${TABLE}`);
}

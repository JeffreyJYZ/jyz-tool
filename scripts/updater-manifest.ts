#!/usr/bin/env bun
/**
 * Build the release's one `latest.json` out of the per-platform partials, with the version this
 * release actually is.
 *
 * Two problems this solves, both measured:
 *
 * 1. Tauri writes one `latest.json` per build, holding only that build's platform keys. Three OS jobs
 *    build in parallel and the workflow merges their artefacts, so a single filename would let the
 *    last job win and publish a manifest that names one platform.
 * 2. The bundles are built with `--config '{"version":"0.1.0"}'` because `.deb` rejects a hyphen and
 *    `.msi` wants a numeric pre-release. `0.1.0` sorts *above* `0.1.0-alpha.N`, so without a restamp
 *    every installed alpha is offered an "update" to a version it already has, forever.
 *
 * Usage: `bun scripts/updater-manifest.ts [--check]`. `--check` reports without writing or deleting.
 */
import { readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import pkg from "../package.json";

export interface UpdaterManifest {
	version: string;
	pub_date?: string;
	platforms: Record<string, { signature: string; url: string }>;
}

const DEFAULT_DIR = "dist/release";
const PARTIAL = /^latest-.+\.json$/;

/** Union of every partial's platform map, restamped with `version`. Later entries win per key. */
export function mergeManifests(manifests: UpdaterManifest[], version: string): UpdaterManifest {
	const platforms: UpdaterManifest["platforms"] = {};
	for (const manifest of manifests) {
		for (const [key, entry] of Object.entries(manifest.platforms ?? {})) {
			platforms[key] = { signature: entry.signature, url: entry.url };
		}
	}
	return { version, platforms };
}

/** Rewrite one manifest's version, keeping every entry, without mutating the input. */
export function stampVersion(manifest: UpdaterManifest, version: string): UpdaterManifest {
	return mergeManifests([manifest], version);
}

/** A manifest is only useful if each entry carries both a signature and a url. */
export function manifestProblems(manifest: UpdaterManifest): string[] {
	const problems: string[] = [];
	const entries = Object.entries(manifest.platforms ?? {});
	if (entries.length === 0) problems.push("latest.json lists no platforms");
	for (const [key, entry] of entries) {
		if (entry.signature.trim() === "") problems.push(`${key}: empty signature`);
		if (entry.url.trim() === "") problems.push(`${key}: empty url`);
	}
	if (manifest.version.trim() === "") problems.push("latest.json has no version");
	return problems;
}

/** Partial manifest filenames in one directory, sorted so a merged report is stable. */
export function partialNames(names: string[]): string[] {
	return names.filter((name) => PARTIAL.test(name)).sort();
}

function readManifest(path: string): UpdaterManifest {
	return JSON.parse(readFileSync(path, "utf8")) as UpdaterManifest;
}

function main(): void {
	const check = Bun.argv.includes("--check");
	const dir = DEFAULT_DIR;
	const entries = readdirSync(dir);
	const partials = partialNames(entries);

	let merged: UpdaterManifest;
	if (partials.length > 0) {
		merged = mergeManifests(
			partials.map((name) => readManifest(join(dir, name))),
			pkg.version,
		);
	} else if (entries.includes("latest.json")) {
		merged = stampVersion(readManifest(join(dir, "latest.json")), pkg.version);
	} else {
		console.error(`no latest.json or latest-<platform>.json in ${dir}`);
		process.exit(1);
	}

	const problems = manifestProblems(merged);
	if (problems.length > 0) {
		console.error(`latest.json is incomplete: ${problems.join(", ")}`);
		process.exit(1);
	}

	const target = join(dir, "latest.json");
	const platformCount = Object.keys(merged.platforms).length;
	if (check) {
		console.log(`${target}: would write ${platformCount} platform(s) at ${pkg.version}`);
		return;
	}
	writeFileSync(target, `${JSON.stringify(merged, null, "\t")}\n`, "utf8");
	// The partials must not reach the release: two manifests on one release is a coin toss for a host.
	for (const name of partials) rmSync(join(dir, name), { force: true });
	console.log(
		`${target}: ${platformCount} platform(s) at ${pkg.version}` +
			(partials.length > 0 ? `, merged ${partials.length} partial(s)` : ""),
	);
}

if (import.meta.main) main();

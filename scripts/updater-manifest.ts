#!/usr/bin/env bun
/**
 * Build the updater manifest a release needs, from the signed artefact on disk.
 *
 * Tauri writes `jyz.app.tar.gz` and its `.sig`, never `latest.json` — that file is produced by
 * `tauri-action` in CI or written by hand. This writes it by hand, in two modes:
 *
 *   bun scripts/updater-manifest.ts --partial   one platform entry, from this host's signature
 *   bun scripts/updater-manifest.ts --merge     fuse the partials into the published latest.json
 *
 * Two traps this exists to avoid:
 *
 * - three OS jobs build in parallel, and one shared filename would let the last job win, so each job
 *   writes `latest-<platform>.json` and only the publish step merges them;
 * - bundles may be built with `--config '{"version":"0.1.0"}'` because `.deb` rejects a hyphen, and
 *   `0.1.0` sorts *above* `0.1.0-alpha.N`, so the merge restamps the version from `package.json`.
 *   A local macOS alpha keeps its real version and the restamp is a no-op.
 */
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import pkg from "../package.json";

export interface UpdaterManifest {
	version: string;
	pub_date?: string;
	notes?: string;
	platforms: Record<string, { signature: string; url: string }>;
}

export const REPO = "JeffreyJYZ/jyz-tool";
const DEFAULT_DIR = "dist/release";
/** Tauri's updater artefact for a macOS or Linux build; the only one we ship. */
const UPDATE_ASSET = "jyz.app.tar.gz";

/** Tauri's platform key for a host, e.g. `darwin-aarch64` from darwin/arm64. */
export function platformKey(platform = process.platform, arch = process.arch): string {
	const osName = platform === "win32" ? "windows" : platform;
	// Tauri names the Intel mac `darwin-x64` but the Intel Linux and Windows `x86_64`.
	const archName =
		arch === "arm64"
			? "aarch64"
			: arch === "x64"
				? osName === "darwin"
					? "x64"
					: "x86_64"
				: arch;
	return `${osName}-${archName}`;
}

/** The public URL an asset serves once the release exists. */
export function assetUrl(tag: string, name: string): string {
	return `https://github.com/${REPO}/releases/download/${tag}/${encodeURIComponent(name)}`;
}

/** One platform's entry, with the signature exactly as Tauri wrote it. */
export function partialManifest(options: {
	version: string;
	platform: string;
	signature: string;
	asset: string;
	tag: string;
	pubDate?: string;
}): UpdaterManifest {
	const signature = options.signature.trim();
	return {
		version: options.version,
		...(options.pubDate === undefined ? {} : { pub_date: options.pubDate }),
		platforms: {
			[options.platform]: { signature, url: assetUrl(options.tag, options.asset) },
		},
	};
}

/** Union of every partial's platforms, restamped with `version`. Later entries win per key. */
export function mergeManifests(manifests: UpdaterManifest[], version: string): UpdaterManifest {
	const platforms: UpdaterManifest["platforms"] = {};
	for (const manifest of manifests) {
		for (const [key, entry] of Object.entries(manifest.platforms ?? {})) {
			platforms[key] = { signature: entry.signature, url: entry.url };
		}
	}
	return { version, platforms };
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
	return names.filter((name) => /^latest-.+\.json$/.test(name)).sort();
}

function fail(message: string): never {
	console.error(`updater-manifest  FAIL  ${message}`);
	process.exit(1);
}

function writePartial(dir: string): void {
	const asset = UPDATE_ASSET;
	const signaturePath = join(dir, `${asset}.sig`);
	if (!existsSync(signaturePath)) {
		fail(`missing ${signaturePath}: build the signed bundle first`);
	}
	const signature = readFileSync(signaturePath, "utf8").trim();
	if (signature === "") fail(`${signaturePath} is empty`);
	const platform = platformKey();
	const tag = `v${pkg.version}`;
	const manifest = partialManifest({
		version: pkg.version,
		platform,
		signature,
		asset,
		tag,
		pubDate: new Date().toISOString(),
	});
	const path = join(dir, `latest-${platform}.json`);
	writeFileSync(path, `${JSON.stringify(manifest, null, "\t")}\n`, "utf8");
	console.log(`updater-manifest  wrote ${path} (${platform}, ${tag})`);
}

function merge(dir: string): void {
	if (!existsSync(dir)) fail(`no ${dir} directory`);
	const entries = readdirSync(dir);
	const partials = partialNames(entries);
	if (partials.length === 0) fail(`no latest-<platform>.json partials in ${dir}`);
	const merged = mergeManifests(
		partials.map(
			(name) => JSON.parse(readFileSync(join(dir, name), "utf8")) as UpdaterManifest,
		),
		pkg.version,
	);
	const problems = manifestProblems(merged);
	if (problems.length > 0) fail(`manifest incomplete: ${problems.join(", ")}`);
	const target = join(dir, "latest.json");
	writeFileSync(target, `${JSON.stringify(merged, null, "\t")}\n`, "utf8");
	// The partials must not reach the release: two manifests on one release is a coin toss for a host.
	for (const name of partials) rmSync(join(dir, name), { force: true });
	console.log(
		`updater-manifest  wrote ${target} (${Object.keys(merged.platforms).length} platform(s), merged ${partials.length})`,
	);
}

function main(): void {
	const args = Bun.argv.slice(2);
	const dirIndex = args.indexOf("--dir");
	const dir = dirIndex === -1 ? DEFAULT_DIR : (args[dirIndex + 1] ?? DEFAULT_DIR);
	if (args.includes("--merge")) {
		merge(dir);
		return;
	}
	writePartial(dir);
}

if (import.meta.main) main();

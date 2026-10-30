#!/usr/bin/env bun
import { copyFile, mkdir, readdir, rm } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { $ } from "bun";
import pkg from "../package.json";

const VERSION: string = pkg.version;
const TAG = `v${VERSION}`;
const OUT = "dist/release";
const BUNDLE_ROOT = "packages/desktop/src-tauri/target/release/bundle";

const BUN_TARGETS = ["darwin-arm64", "darwin-x64", "linux-arm64", "linux-x64", "windows-x64"];

const INSTALLER_EXTENSIONS = new Set([".dmg", ".deb", ".AppImage", ".rpm", ".msi", ".exe"]);

const flags = new Set(Bun.argv.slice(2));
const publish = flags.has("--publish");
const publishOnly = flags.has("--publish-only");
const noCli = flags.has("--no-cli");
const noDesktop = flags.has("--no-desktop");
const noMcp = flags.has("--no-mcp");
const buildAll = flags.has("--all");

function currentTarget(): string {
	const key = `${process.platform === "win32" ? "windows" : process.platform}-${process.arch}`;
	if (!BUN_TARGETS.includes(key)) throw new Error(`no release target for ${key}`);
	return key;
}

import { buildNotes } from "./release-notes.ts";

const ARTEFACTS = [
	`- \`core-${VERSION}.tgz\` — the core package source`,
	`- \`mcp-${VERSION}.tgz\` — the MCP server package source, installable with \`bun add -g\``,
	`- \`mcp-${VERSION}-<os>-<arch>[.exe]\` — the MCP server as one self-contained binary`,
	`- \`cli-${VERSION}-<os>-<arch>[.exe]\` — the compiled \`jyz\` binary, self-contained per platform`,
	`- \`desktop-${VERSION}-<os>-<arch>.<dmg|deb|AppImage|msi|exe>\` — Tauri installers for the shell, each carrying its own \`jyz\` sidecar`,
];

async function buildReleaseNotes(): Promise<string> {
	const previous = await $`git describe --tags --abbrev=0 HEAD^`.quiet().nothrow();
	const range = previous.exitCode === 0 ? `${previous.stdout.toString().trim()}..HEAD` : "HEAD";
	const log = await $`git log --no-merges --pretty=%s ${range}`.quiet().nothrow();
	const subjects = log.stdout
		.toString()
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean)
		.map((subject) => ({ subject }));
	const highlights = buildNotes(subjects).markdown;
	return [`jyz ${VERSION}`, "", highlights, "", "### Artefacts", "", ...ARTEFACTS].join("\n");
}

const notes = await buildReleaseNotes();

if (!publishOnly) {
	await rm(OUT, { recursive: true, force: true });
	await mkdir(OUT, { recursive: true });

	if (!noMcp) {
		const targets = buildAll ? BUN_TARGETS : [currentTarget()];
		await $`tar -czf ${OUT}/mcp-${VERSION}.tgz -C packages/mcp .`;
		for (const target of targets) {
			const ext = target.startsWith("windows") ? ".exe" : "";
			await $`bun build --compile --target=bun-${target} packages/mcp/src/bin.ts --outfile ${OUT}/mcp-${VERSION}-${target}${ext}`;
		}
	}

	if (!noCli) {
		const targets = buildAll ? BUN_TARGETS : [currentTarget()];
		await $`tar -czf ${OUT}/core-${VERSION}.tgz -C packages/core .`;
		for (const target of targets) {
			const ext = target.startsWith("windows") ? ".exe" : "";
			await $`bun build --compile --target=bun-${target} packages/cli/src/bin.ts --outfile ${OUT}/cli-${VERSION}-${target}${ext}`;
		}
	}

	if (!noDesktop) {
		const platform = currentTarget();
		const suffix = `.${platform}`;
		let found = 0;
		try {
			for (const entry of await readdir(BUNDLE_ROOT, { recursive: true })) {
				const file = basename(String(entry));
				const ext = extname(file);
				if (!INSTALLER_EXTENSIONS.has(ext)) continue;
				const target = `${OUT}/desktop-${VERSION}-${platform}${ext}`;
				await copyFile(join(BUNDLE_ROOT, String(entry)), target);
				found++;
			}
		} catch {
			// no bundle on this platform yet: the desktop job reports its own failure
		}
		console.log(
			found === 0
				? "no desktop installer found"
				: `collected ${found} desktop installer(s) for ${suffix}`,
		);

		let updaterFound = 0;
		let sigFound = 0;
		try {
			for (const entry of await readdir(BUNDLE_ROOT, { recursive: true })) {
				const file = basename(String(entry));
				// The archive and its signature travel together: a host cannot install from a signature
				// alone, and `latest.json` (when a bundler writes one) must not collide across platforms.
				const isUpdater =
					file === "latest.json" ||
					file.endsWith(".sig") ||
					file.endsWith(".app.tar.gz") ||
					file.endsWith(".AppImage.tar.gz") ||
					file.endsWith(".nsis.zip");
				if (!isUpdater) continue;
				const targetName = file === "latest.json" ? `latest-${platform}.json` : file;
				await copyFile(join(BUNDLE_ROOT, String(entry)), join(OUT, targetName));
				updaterFound++;
				if (file.endsWith(".sig")) sigFound++;
			}
		} catch {
			// no bundle on this platform yet
		}
		console.log(
			updaterFound === 0
				? "no updater artefacts found"
				: `collected ${updaterFound} updater artefact(s)`,
		);
		if (sigFound === 0) console.log("warning: no updater signature found");
	}
}

const files = (await readdir(OUT))
	.sort()
	.map((name) => `${OUT}/${name}`)
	.filter((path) => !path.endsWith("/"));

console.log(`artefacts in ${OUT}: ${files.length}`);
for (const file of files) console.log(`  ${file}`);

if (publish) {
	const view = await $`gh release view ${TAG}`.quiet().nothrow();
	// No `--prerelease`: `releases/latest/download/latest.json` is the updater endpoint, and GitHub
	// serves "latest" only for a non-prerelease. Marking it latest also keeps the endpoint pointed at
	// the newest build, which is what an alpha channel wants.
	if (view.exitCode === 0) {
		await $`gh release upload ${TAG} ${files} --clobber`;
		await $`gh release edit ${TAG} --latest --prerelease=false`;
		console.log(`uploaded to existing release ${TAG}`);
	} else {
		await $`gh release create ${TAG} ${files} --title ${TAG} --latest --notes ${notes}`;
		console.log(`created release ${TAG}`);
	}
}

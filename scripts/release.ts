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
const buildAll = flags.has("--all");

function currentTarget(): string {
	const key = `${process.platform === "win32" ? "windows" : process.platform}-${process.arch}`;
	if (!BUN_TARGETS.includes(key)) throw new Error(`no release target for ${key}`);
	return key;
}

import { buildNotes } from "./release-notes.ts";

const ARTEFACTS = [
	`- \`core-${VERSION}.tgz\` — the core package source`,
	`- \`cli-${VERSION}-<os>-<arch>[.exe]\` — the compiled \`jyz\` binary, self-contained per platform`,
	`- \`desktop-${VERSION}-<os>-<arch>.<dmg|deb|AppImage|msi|exe>\` — Tauri installers for the shell`,
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
	if (view.exitCode === 0) {
		await $`gh release upload ${TAG} ${files} --clobber`;
		console.log(`uploaded to existing release ${TAG}`);
	} else {
		await $`gh release create ${TAG} ${files} --title ${TAG} --prerelease --notes ${notes}`;
		console.log(`created release ${TAG}`);
	}
}

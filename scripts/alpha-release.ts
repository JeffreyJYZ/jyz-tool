#!/usr/bin/env bun
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { $ } from "bun";

export function nextAlpha(current: string): string {
	const m = current.match(/^(\d+\.\d+\.\d+)-alpha\.(\d+)$/);
	if (!m) throw new Error(`not an alpha version: ${current}`);
	const base = m[1];
	const count = m[2];
	if (base === undefined || count === undefined)
		throw new Error(`not an alpha version: ${current}`);
	const n = Number(count) + 1;
	return `${base}-alpha.${n}`;
}

export function manifestFiles(): string[] {
	return [
		"package.json",
		"packages/core/package.json",
		"packages/cli/package.json",
		"packages/desktop/package.json",
		"packages/mcp/package.json",
		"packages/desktop/src-tauri/tauri.conf.json",
		"packages/desktop/src-tauri/Cargo.toml",
		// The lockfiles repeat the workspace version; leaving them out of the release commit leaves
		// the tree dirty, and the next release then refuses to run.
		"bun.lock",
		"packages/desktop/src-tauri/Cargo.lock",
	];
}

function currentVersion(): string {
	const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { version: string };
	return pkg.version;
}

/** Build and publish the tagged release with the local toolchain. */
function publish(version: string): void {
	const notesPath = join(tmpdir(), `alpha-${version}-notes.md`);
	if (!existsSync(notesPath)) writeFileSync(notesPath, `Alpha release ${version}\n`);
	const pub = Bun.spawnSync(
		[
			"bun",
			"scripts/release-local.ts",
			"--tag",
			`v${version}`,
			"--notes",
			notesPath,
			"--skip-gate",
		],
		{ stdout: "pipe", stderr: "pipe" },
	);
	if (pub.exitCode !== 0) {
		console.error(pub.stderr.toString());
		process.exit(pub.exitCode ?? 1);
	}
	console.log(pub.stdout.toString().trim());
}

/**
 * Open the release pull request as `jyzbot`.
 *
 * `main` is protected and requires a human approval, so this stops at the PR:
 * the bot cannot approve its own work, and the point is that the owner reviews
 * the bump before it lands. `finalize()` does the rest once it is merged.
 */
async function openRelease(version: string): Promise<void> {
	const branch = `release/${version}`;
	await $`git push bot HEAD:refs/heads/${branch}`;
	await $`gh pr create --base main --head ${branch} --title ${`chore(release): ${version}`} --body ${`Alpha ${version}. Bumped by scripts/alpha-release.ts.\n\nApprove and merge, then run \`bun scripts/alpha-release.ts --finish\` to tag and publish.`}`;
}

/**
 * Tag the merged release commit and publish it.
 *
 * Tags are cut only after the merge: the rebase rewrites the commit, so a tag
 * taken before approval would point at something `main` never keeps.
 */
async function finalize(version: string): Promise<void> {
	const branch = `release/${version}`;
	const tag = `v${version}`;
	const state = await $`gh pr view ${branch} --json state,mergedAt`.quiet().nothrow();
	if (state.exitCode !== 0) throw new Error(`no pull request for ${branch}`);
	const parsed = JSON.parse(state.stdout.toString()) as {
		state?: string;
		mergedAt?: string | null;
	};
	if (parsed.state !== "MERGED" || !parsed.mergedAt) {
		throw new Error(
			`${branch} is ${parsed.state ?? "unknown"}, not merged — approve and merge it first`,
		);
	}
	await $`git checkout main`;
	await $`git pull --ff-only bot main`;
	await $`git tag ${tag}`;
	await $`git push bot refs/tags/${tag}`;
}

async function main() {
	const flags = new Set(Bun.argv.slice(2));
	const dryRun = flags.has("--dry-run");
	const push = flags.has("--push");

	const version = currentVersion();
	const next = nextAlpha(version);

	// `--finish` runs after the release pull request is approved and merged:
	// tag the merged commit, then publish it.
	if (flags.has("--finish")) {
		await finalize(version);
		publish(version);
		console.log(`released ${version}`);
		return;
	}

	if (dryRun) {
		console.log(`would release ${next}`);
		console.log("gates: bun run typecheck, bun run lint, bun run format:check, bun run test");
		return;
	}

	// dirty tree check — the size table is generated at publish time, so its row
	// for the *previous* release is still uncommitted when the next one starts;
	// it rides along in this release commit instead of blocking the run.
	const GENERATED = new Set(["docs/progress/releases/sizes.md"]);
	const status = await $`git status --porcelain`.quiet();
	const dirty = status.stdout.toString().trim();
	if (dirty) {
		const paths = dirty
			.split("\n")
			.map((line) => {
				const parts = line.trim().split(/\s+/);
				return parts[parts.length - 1] ?? "";
			})
			.filter((path) => path !== "" && !GENERATED.has(path));
		if (paths.length > 0) {
			console.error(`dirty tree, aborting: ${paths.join(", ")}`);
			process.exit(1);
		}
	}

	const gates = ["typecheck", "lint", "format:check", "test"] as const;
	for (const g of gates) {
		const r = await $`bun run ${g}`.nothrow();
		if (r.exitCode !== 0) {
			console.error(`gate failed: ${g}`);
			process.exit(r.exitCode ?? 1);
		}
	}

	// bump
	const bump = Bun.spawnSync(["bun", "scripts/bump-alpha.ts"], {
		stdout: "pipe",
		stderr: "pipe",
	});
	if (bump.exitCode !== 0) {
		console.error(bump.stderr.toString());
		process.exit(bump.exitCode ?? 1);
	}
	const newVersion = bump.stdout.toString().trim() || next;

	// commit on a release branch: `main` is protected, so the bump lands through
	// a pull request like every other change (see `openRelease`).
	const branch = `release/${newVersion}`;
	await $`git checkout -b ${branch}`;
	await $`git add ${manifestFiles()}`;
	// The previous release's size row, if publishing it left one behind.
	await $`git add docs/progress/releases/sizes.md`.quiet().nothrow();
	await $`git commit -m ${`chore(release): ${newVersion}`}`;

	const notesPath = join(tmpdir(), `alpha-${newVersion}-notes.md`);
	writeFileSync(notesPath, `Alpha release ${newVersion}\n`);

	if (push) {
		await openRelease(newVersion);
		console.log(`pull request open for ${newVersion}`);
		console.log("review and merge it, then:");
		console.log("  bun scripts/alpha-release.ts --finish");
		return;
	}

	console.log("next commands:");
	console.log(`  git push bot HEAD:refs/heads/${branch}`);
	console.log(`  gh pr create --base main --head ${branch} --fill`);
	console.log("  # after the pull request is approved and merged:");
	console.log("  bun scripts/alpha-release.ts --finish");
}

if (import.meta.main) {
	await main();
}

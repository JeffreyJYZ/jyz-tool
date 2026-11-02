/**
 * The three GitHub-facing steps of an alpha release, kept out of
 * `scripts/alpha-release.ts` so that file stays under the 200-line cap.
 *
 * The order is the contract: open a pull request, wait for the owner's merge,
 * then tag the merged commit and publish. Nothing here may jump that queue.
 */
import { existsSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { $ } from "bun";

/** Build and publish the tagged release with the local toolchain. */
export function publish(version: string): void {
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
export async function openRelease(version: string): Promise<void> {
	const branch = `release/${version}`;
	const body = `Alpha ${version}. Bumped by scripts/alpha-release.ts.\n\nApprove and merge, then run \`bun scripts/alpha-release.ts --finish\` to tag and publish.`;
	await $`git push bot HEAD:refs/heads/${branch}`;
	await $`gh pr create --base main --head ${branch} --title ${`chore(release): ${version}`} --body ${body}`;
}

/**
 * Tag the merged release commit and publish it.
 *
 * Tags are cut only after the merge: the rebase rewrites the commit, so a tag
 * taken before approval would point at something `main` never keeps.
 */
export async function finalize(version: string): Promise<void> {
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
	await $`git tag -f ${tag}`;
	await $`git push bot refs/tags/${tag}`;
	// npm publishing is driven by its own tags in `.github/workflows/publish.yml`,
	// one per package: `v*` alone releases the desktop app and never reaches npm,
	// which is how alpha.39 shipped to GitHub but not to the registry.
	for (const pkg of ["cli", "mcp"] as const) {
		const npmTag = `${pkg}-${tag}`;
		await $`git tag -f ${npmTag}`;
		await $`git push bot refs/tags/${npmTag}`;
	}
}

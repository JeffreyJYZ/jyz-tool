#!/usr/bin/env bun
import { existsSync, readFileSync } from "node:fs";
import { $ } from "bun";

export function nextAlpha(current: string): string {
	const m = current.match(/^(\d+\.\d+\.\d+)-alpha\.(\d+)$/);
	if (!m) throw new Error(`not an alpha version: ${current}`);
	const base = m[1]!;
	const n = Number(m[2]) + 1;
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
	];
}

function currentVersion(): string {
	const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { version: string };
	return pkg.version;
}

async function main() {
	const flags = new Set(Bun.argv.slice(2));
	const dryRun = flags.has("--dry-run");
	const push = flags.has("--push");

	const version = currentVersion();
	const next = nextAlpha(version);

	if (dryRun) {
		console.log(`would release ${next}`);
		console.log("gates: bun run typecheck, bun run lint, bun run format:check, bun run test");
		return;
	}

	// dirty tree check
	const status = await $`git status --porcelain`.quiet();
	const dirty = status.stdout.toString().trim();
	if (dirty) {
		const paths = dirty
			.split("\n")
			.map((l) => l.trim().split(/\s+/).pop()!)
			.filter(Boolean);
		console.error(`dirty tree, aborting: ${paths.join(", ")}`);
		process.exit(1);
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

	// commit
	await $`git add ${manifestFiles()}`;
	await $`git commit -m ${"chore(release): " + newVersion}`;
	await $`git tag ${"v" + newVersion}`;

	if (push) {
		await $`git push`;
		await $`git push --tags`;
	} else {
		console.log("next commands:");
		console.log("  git push");
		console.log("  git push --tags");
	}
	console.log(`released ${newVersion}`);
}

if (import.meta.main) {
	await main();
}

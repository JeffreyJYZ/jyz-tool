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
	const local = flags.has("--local");

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
			.map((line) => {
				const parts = line.trim().split(/\s+/);
				return parts[parts.length - 1] ?? "";
			})
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

	const notesPath = join(tmpdir(), `alpha-${newVersion}-notes.md`);
	writeFileSync(notesPath, `Alpha release ${newVersion}\n`);

	if (push || local) {
		await $`git push`;
		await $`git push --tags`;
	}

	if (local) {
		const pub = Bun.spawnSync(
			[
				"bun",
				"scripts/release-local.ts",
				"--tag",
				`v${newVersion}`,
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
	} else {
		console.log("next commands:");
		console.log("  git push");
		console.log("  git push --tags");
		console.log(
			`  bun scripts/release-local.ts --tag v${newVersion} --notes ${notesPath} --skip-gate`,
		);
	}
	console.log(`released ${newVersion}`);
}

if (import.meta.main) {
	await main();
}

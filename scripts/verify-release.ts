#!/usr/bin/env bun
import { $ } from "bun";
import pkg from "../package.json";

export const PLATFORMS = ["darwin-arm64", "darwin-x64", "linux-x64", "windows-x64"];

export function checkAssets(assets: { name: string }[], version: string): string[] {
	const problems: string[] = [];
	const names = assets.map((a) => a.name);
	if (!names.includes(`core-${version}.tgz`)) problems.push(`missing core-${version}.tgz`);
	if (!names.includes(`mcp-${version}.tgz`)) problems.push(`missing mcp-${version}.tgz`);
	if (!names.some((n) => n.startsWith("cli-"))) problems.push("missing cli asset");
	if (!names.some((n) => n.startsWith("mcp-") && !n.endsWith(".tgz"))) {
		problems.push("missing mcp binary");
	}
	if (!names.some((n) => n.startsWith("desktop-"))) problems.push("missing desktop asset");
	for (const platform of PLATFORMS) {
		if (!names.some((n) => n.includes(platform)))
			problems.push(`missing platform: ${platform}`);
	}
	return problems;
}

async function fetchRelease(
	tag: string,
): Promise<{ tagName: string; assets: { name: string }[] } | null> {
	const result = await $`gh release view ${tag} --json tagName,isPrerelease,assets,url`
		.quiet()
		.nothrow();
	if (result.exitCode !== 0) return null;
	try {
		return JSON.parse(result.stdout.toString()) as {
			tagName: string;
			assets: { name: string }[];
		};
	} catch {
		return null;
	}
}

async function main() {
	const args = Bun.argv.slice(2);
	let timeout = 0;
	let wait = false;
	const positional: string[] = [];
	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		if (arg === undefined) continue;
		if (arg === "--timeout") {
			timeout = Number(args[++i]);
		} else if (arg === "--wait") {
			wait = true;
		} else if (!arg.startsWith("--")) {
			positional.push(arg);
		}
	}

	const tag = positional[0] ?? `v${pkg.version}`;
	const version = tag.replace(/^v/, "");
	const deadline = Date.now() + timeout * 1000;

	while (true) {
		const release = await fetchRelease(tag);
		const problems: string[] = [];
		if (!release) {
			problems.push("missing release");
		} else {
			if (release.tagName !== tag) problems.push(`tagName mismatch: ${release.tagName}`);
			problems.push(...checkAssets(release.assets ?? [], version));
		}

		if (problems.length === 0) {
			const count = release?.assets?.length ?? 0;
			console.log(`ok ${tag} ${count} assets`);
			process.exit(0);
		}

		if (!wait || Date.now() >= deadline) {
			console.log(`missing: ${problems.join(", ")}`);
			process.exit(1);
		}

		await Bun.sleep(15000);
	}
}

if (import.meta.main) {
	await main();
}

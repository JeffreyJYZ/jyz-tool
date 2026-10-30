#!/usr/bin/env bun
import { $ } from "bun";

const TYPE_ORDER = ["feat", "fix", "chore", "docs", "perf", "refactor", "test", "Other"];

export interface Commit {
	subject: string;
}

export interface NotesResult {
	groups: Record<string, string[]>;
	markdown: string;
}

function parseSubject(subject: string): { type: string; item: string } {
	const match = subject.match(/^([a-zA-Z]+)(?:\(([^)]+)\))?!?:\s*(.*)$/);
	if (!match) return { type: "Other", item: subject };
	const [, rawType, rawScope, rawDesc] = match;
	if (rawType === undefined || rawDesc === undefined) return { type: "Other", item: subject };
	const type = TYPE_ORDER.includes(rawType) ? rawType : "Other";
	const item = rawScope ? `${rawScope}: ${rawDesc}` : rawDesc;
	return { type, item };
}

export function buildNotes(commits: { subject: string }[]): NotesResult {
	const groups: Record<string, string[]> = {};
	for (const type of TYPE_ORDER) groups[type] = [];
	for (const commit of commits) {
		const { type, item } = parseSubject(commit.subject);
		const bucket = groups[type];
		if (bucket) bucket.push(item);
	}
	for (const type of TYPE_ORDER) {
		const existing = groups[type];
		if (existing && existing.length === 0) delete groups[type];
	}
	let markdown = "";
	if (commits.length === 0) {
		markdown = "No changes";
	} else {
		const lines: string[] = ["## Highlights", ""];
		for (const type of TYPE_ORDER) {
			const grp = groups[type];
			if (!grp) continue;
			lines.push(`### ${type}`);
			for (const item of grp) lines.push(`- ${item}`);
			lines.push("");
		}
		markdown = lines.join("\n").trimEnd();
	}
	return { groups, markdown };
}

async function main() {
	const args = Bun.argv.slice(2);
	const json = args.includes("--json");
	const positional = args.filter((a) => !a.startsWith("--"));
	const [fromRef, toRef] = positional;
	if (!fromRef || !toRef) {
		console.error("usage: release-notes.ts <fromRef> <toRef> [--json]");
		process.exit(1);
	}
	const out = await $`git log --no-merges --pretty=%s ${fromRef}..${toRef}`.text();
	const commits = out
		.split("\n")
		.map((s) => s.trim())
		.filter(Boolean)
		.map((subject) => ({ subject }));
	const result = buildNotes(commits);
	if (json) {
		console.log(JSON.stringify({ groups: result.groups }, null, 2));
	} else {
		console.log(result.markdown);
	}
}

if (import.meta.main) {
	await main();
}

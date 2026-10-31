#!/usr/bin/env bun

import { runSmoke } from "./smoke/runner";

export { runSmoke } from "./smoke/runner";
export type { SmokeStep } from "./smoke/types";

async function main(): Promise<void> {
	const args = Bun.argv.slice(2);
	const json = args.includes("--json");
	const cmd = ["bun", "packages/mcp/src/server.ts"];
	const cwd = process.cwd();
	const steps = await runSmoke(cmd, cwd);
	if (json) {
		console.log(JSON.stringify(steps));
	} else {
		for (const s of steps) {
			console.log(`${s.ok ? "ok" : "FAIL"} ${s.step} ${s.detail}`);
		}
	}
	const allOk = steps.length === 7 && steps.every((s) => s.ok);
	process.exit(allOk ? 0 : 1);
}

if (import.meta.main) {
	await main();
}

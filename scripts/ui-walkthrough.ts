#!/usr/bin/env bun
/**
 * A repeatable click-through of the desktop window, in a real browser.
 *
 * A Tauri window cannot be driven from CI, so this serves the built `dist/index.html` and stubs the
 * one thing the page asks of the shell (`__TAURI_INTERNALS__.invoke`); the steps live in
 * `walkthrough/run.ts`. Needs `agent-browser` on PATH; without it the run exits 2 rather than
 * pretending to pass.
 *
 * Usage: `bun scripts/ui-walkthrough.ts [--json]`.
 */
import { join } from "node:path";
import { runWalkthrough } from "./walkthrough/run.ts";
import { serveUi } from "./walkthrough/server.ts";
import { STUB_SESSIONS, stubSource } from "./walkthrough/stub.ts";

export type { Step } from "./walkthrough/run.ts";
export { STUB_SESSIONS, serveUi, stubSource };

if (import.meta.main) {
	const json = Bun.argv.slice(2).includes("--json");
	const root = join(import.meta.dir, "..", "packages", "desktop", "dist");
	process.exit(await runWalkthrough(json, root));
}

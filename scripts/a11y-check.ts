#!/usr/bin/env bun
/**
 * Prove the desktop UI is readable by assistive technology.
 *
 * A Tauri window exposes no accessibility element of its own, so the honest gate is the page: serve
 * the built `dist/`, stub the one Tauri call the page makes, then read the DOM the way a screen
 * reader would — landmarks, one heading per region, an accessible name on every control, a single
 * current tab, live regions, and no positive `tabindex` reordering. Needs `agent-browser` on PATH;
 * without it the run exits 2 instead of pretending to pass.
 *
 * Usage: `bun scripts/a11y-check.ts [--json]`.
 */
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { $ } from "bun";
import { type Audit, collectSource, type Finding, judge } from "./a11y/audit.ts";
import { browser, evalJson, waitUntil } from "./walkthrough/browser.ts";
import { serveUi } from "./walkthrough/server.ts";
import { stubSource } from "./walkthrough/stub.ts";

const SCREENS = ["call", "config", "opencode", "settings"] as const;

export async function runA11yCheck(json: boolean, root: string): Promise<number> {
	if (!existsSync(join(root, "index.html"))) {
		console.error(`no build at ${root}; run: bun run --cwd packages/desktop build:web`);
		return 2;
	}
	const dir = await mkdtemp(join(tmpdir(), "jyz-a11y-"));
	const stub = join(dir, "tauri-stub.js");
	await writeFile(stub, stubSource(), "utf8");
	const site = serveUi(root);
	const sessionResult = await $`agent-browser session id --scope worktree --prefix a11y`
		.quiet()
		.nothrow();
	if (sessionResult.exitCode !== 0) {
		site.stop();
		await rm(dir, { recursive: true, force: true });
		console.error("agent-browser is not installed: npm i -g agent-browser");
		return 2;
	}
	const session = sessionResult.stdout.toString().trim();
	const findings: Finding[] = [];
	let audited = 0;
	try {
		await browser(session, ["open", site.url, "--init-script", stub]);
		await waitUntil(session, 'document.querySelectorAll("nav [data-screen]").length > 0');
		for (const screen of SCREENS) {
			await browser(session, [
				"eval",
				`document.querySelector('[data-screen="${screen}"]').click()`,
			]);
			await waitUntil(
				session,
				`document.querySelector(".screen.active")?.id === "screen-${screen}"`,
			);
			const audit = evalJson(await browser(session, ["eval", collectSource()])) as Audit;
			if (audit === null || typeof audit !== "object") {
				findings.push({ kind: "audit", target: screen, detail: "no audit returned" });
				continue;
			}
			audited += 1;
			for (const finding of judge(audit)) {
				findings.push({ ...finding, target: `${screen}: ${finding.target}` });
			}
			if (!json) {
				const ok = judge(audit).length === 0;
				console.log(
					`${ok ? "ok" : "FAIL"} ${screen} named ${audit.named}/${audit.interactive} regions ${audit.titledRegions}/${audit.regions} current ${audit.currentTabs}`,
				);
			}
		}
	} finally {
		site.stop();
		await rm(dir, { recursive: true, force: true });
	}

	if (json) {
		console.log(JSON.stringify({ audited, findings }, null, 1));
	} else {
		for (const finding of findings) {
			console.log(`FAIL ${finding.kind} ${finding.target} — ${finding.detail}`);
		}
		console.log(`${audited}/${SCREENS.length} screens audited, ${findings.length} finding(s)`);
	}
	return findings.length === 0 && audited === SCREENS.length ? 0 : 1;
}

if (import.meta.main) {
	const json = Bun.argv.slice(2).includes("--json");
	const root = join(import.meta.dir, "..", "packages", "desktop", "dist");
	process.exit(await runA11yCheck(json, root));
}

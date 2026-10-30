#!/usr/bin/env bun
/**
 * A repeatable click-through of the desktop window's three screens, in a real browser.
 *
 * A Tauri window cannot be driven from CI, so this runs the same `ui/index.html` over HTTP and
 * stubs the only thing the page asks of the shell: `__TAURI_INTERNALS__.invoke`. Every screen then
 * behaves as it does inside the app, because the page's logic is the app's logic.
 *
 * Usage: `bun scripts/ui-walkthrough.ts [--json] [--keep-open]`. Needs `agent-browser` on PATH
 * (`npm i -g agent-browser`); it is a walkthrough tool, not a gate, so a machine without it gets
 * exit code 2 and no false green.
 */
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { $ } from "bun";

export interface Step {
	name: string;
	ok: boolean;
	detail: string;
}

/** The sessions the stub reports, so a step can assert the exact rows it expects. */
export const STUB_SESSIONS = [
	{ id: "ses_alpha", title: "v2 rollout", updatedAt: "2026-10-30T23:00:00Z" },
	{ id: "ses_beta", title: "release notes", updatedAt: "2026-10-30T22:10:00Z" },
];

/**
 * The IPC stub, as the JavaScript an init script runs before the page's own scripts.
 *
 * The manifest has three entries across three kinds so a broken grouping shows up as a missing
 * option rather than as a plausible list.
 */
export function stubSource(): string {
	const manifest = [
		{ name: "config", kind: "config", params: ["action", "key", "value"] },
		{ name: "install", kind: "dispatch", params: ["args"] },
		{ name: "lint", kind: "toolchain", params: ["args"] },
	];
	return `(() => {
	const sessions = ${JSON.stringify(STUB_SESSIONS)};
	const manifest = ${JSON.stringify(manifest)};
	async function invoke(command, args = {}) {
		if (command === "jyz_capabilities") return manifest;
		if (command === "jyz_version") return "jyz/0.0.0 walkthrough";
		if (command === "jyz_update_check") {
			return { current: "0.0.0", version: "9.9.9", notes: "walkthrough offer" };
		}
		if (command === "jyz_oc") {
			const argv = args.args ?? [];
			if (argv[0] === "sessions") return JSON.stringify(sessions);
			return JSON.stringify({ session: argv[3] ?? "", sent: true });
		}
		if (command === "jyz_call") {
			if (args.method === "config") {
				return JSON.stringify({ jsonrpc: "2.0", id: 1, result: { exitCode: 0, stdout: [
					"config: /tmp/walkthrough/jyz.config.toml",
					"project.package_manager = bun (detected)",
					"project.linter = biome (file)",
					"layer: /tmp/walkthrough",
				].join("\\n") } });
			}
			return JSON.stringify({ jsonrpc: "2.0", id: 1, result: { exitCode: 0, argv: ["bun", "install"] } });
		}
		throw new Error("unknown command " + command);
	}
	globalThis.__TAURI_INTERNALS__ = { invoke };
})();`;
}

/** Serve `ui/` on an ephemeral port. One request per file, no caching, no bundler. */
export function serveUi(root: string): { url: string; stop(): void } {
	const server = Bun.serve({
		port: 0,
		async fetch(request) {
			const path = new URL(request.url).pathname;
			const file = Bun.file(`${root}${path === "/" ? "/index.html" : path}`);
			if (!(await file.exists())) return new Response("not found", { status: 404 });
			return new Response(file, {
				headers: { "content-type": "text/html; charset=utf-8" },
			});
		},
	});
	return { url: `http://127.0.0.1:${server.port}/`, stop: () => server.stop(true) };
}

/** Run one `agent-browser` subcommand and return its stdout. */
async function browser(session: string, words: string[]): Promise<string> {
	const result = await $`agent-browser ${words}`
		.env({ ...process.env, AGENT_BROWSER_SESSION: session })
		.quiet()
		.nothrow();
	if (result.exitCode !== 0) {
		throw new Error(`agent-browser ${words.join(" ")}: ${result.stderr.toString().trim()}`);
	}
	return result.stdout.toString().trim();
}

/** JSON out of one `eval`, which the CLI prints as a JSON string or a bare value. */
function evalJson(text: string): unknown {
	try {
		return JSON.parse(text);
	} catch {
		return text;
	}
}

async function main(): Promise<void> {
	const flags = new Set(Bun.argv.slice(2));
	const json = flags.has("--json");
	const root = join(import.meta.dir, "..", "packages", "desktop", "ui");
	const dir = await mkdtemp(join(tmpdir(), "jyz-ui-"));
	const stub = join(dir, "tauri-stub.js");
	await writeFile(stub, stubSource(), "utf8");
	const site = serveUi(root);
	const sessionResult = await $`agent-browser session id --scope worktree --prefix walkthrough`
		.quiet()
		.nothrow();
	if (sessionResult.exitCode !== 0) {
		site.stop();
		console.error("agent-browser is not installed: npm i -g agent-browser");
		process.exit(2);
	}
	const session = sessionResult.stdout.toString().trim();
	const steps: Step[] = [];
	const record = (name: string, ok: boolean, detail: string) => {
		steps.push({ name, ok, detail });
		if (!json) console.log(`${ok ? "ok" : "FAIL"} ${name}${detail === "" ? "" : ` ${detail}`}`);
	};
	try {
		await browser(session, ["open", site.url, "--init-script", stub]);
		const options = evalJson(
			await browser(session, [
				"eval",
				'[...document.querySelectorAll("#method option")].map((o) => o.value)',
			]),
		);
		record(
			"method picker follows the manifest",
			Array.isArray(options) && options.length === 3 && options[0] === "config",
			JSON.stringify(options),
		);

		await browser(session, ["eval", 'document.getElementById("run").click()']);
		const result = evalJson(
			await browser(session, [
				"eval",
				'new Promise((done) => setTimeout(() => done(document.getElementById("result").textContent), 300))',
			]),
		);
		record(
			"call screen prints a result",
			typeof result === "string" && result.includes("bun"),
			typeof result === "string" ? (result.split("\n")[0]?.slice(0, 40) ?? "") : "",
		);

		await browser(session, [
			"eval",
			"document.querySelector('[data-screen=\"config\"]').click()",
		]);
		const config = evalJson(
			await browser(session, [
				"eval",
				'new Promise((done) => setTimeout(() => done(JSON.stringify({ rows: document.querySelectorAll("#config-table tbody tr").length, state: document.getElementById("config-raw").dataset.state })), 400))',
			]),
		);
		const configRows =
			typeof config === "string" && config.startsWith("{")
				? (JSON.parse(config) as { rows: number; state: string })
				: { rows: 0, state: "?" };
		record(
			"config screen renders rows",
			configRows.rows === 2 && configRows.state === "ok",
			`rows=${configRows.rows}`,
		);

		await browser(session, [
			"eval",
			"document.querySelector('[data-screen=\"opencode\"]').click()",
		]);
		const sessions = evalJson(
			await browser(session, [
				"eval",
				'new Promise((done) => setTimeout(() => done(JSON.stringify({ rows: document.querySelectorAll("#oc-table tbody tr").length, status: document.getElementById("oc-status").textContent })), 400))',
			]),
		);
		const sessionState =
			typeof sessions === "string" && sessions.startsWith("{")
				? (JSON.parse(sessions) as { rows: number; status: string })
				: { rows: 0, status: "" };
		record(
			"opencode panel lists sessions",
			sessionState.rows === 2 && sessionState.status.includes("2 session"),
			sessionState.status,
		);

		await browser(session, [
			"eval",
			'document.getElementById("session").value = "ses_alpha"; document.getElementById("prompt").value = "hello"; document.getElementById("send-prompt").click();',
		]);
		const sent = evalJson(
			await browser(session, [
				"eval",
				'new Promise((done) => setTimeout(() => done(document.getElementById("oc-status").textContent), 300))',
			]),
		);
		record(
			"sending a prompt reports the session",
			typeof sent === "string" && sent.includes("ses_alpha"),
			typeof sent === "string" ? sent : "",
		);

		const banner = evalJson(
			await browser(session, [
				"eval",
				'new Promise((done) => setTimeout(() => done(JSON.stringify({ hidden: document.getElementById("update-banner").hidden, text: document.getElementById("update-banner").textContent })), 500))',
			]),
		);
		const bannerState =
			typeof banner === "string" && banner.startsWith("{")
				? (JSON.parse(banner) as { hidden: boolean; text: string })
				: { hidden: true, text: "" };
		record(
			"update banner offers the new version",
			!bannerState.hidden && bannerState.text.includes("9.9.9"),
			bannerState.text,
		);
	} finally {
		await $`agent-browser close`
			.env({ ...process.env, AGENT_BROWSER_SESSION: session })
			.quiet()
			.nothrow();
		site.stop();
		await rm(dir, { recursive: true, force: true });
	}
	if (json) console.log(JSON.stringify(steps, null, 2));
	const failed = steps.filter((step) => !step.ok).length;
	console.log(`${steps.length - failed}/${steps.length} steps ok`);
	process.exit(failed === 0 ? 0 : 1);
}

if (import.meta.main) await main();

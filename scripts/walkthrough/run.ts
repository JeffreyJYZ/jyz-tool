import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { $ } from "bun";
import { browser, evalJson, waitUntil } from "./browser.ts";
import { serveUi } from "./server.ts";
import { stubSource } from "./stub.ts";

export interface Step {
	name: string;
	ok: boolean;
	detail: string;
}

/** The whole walkthrough: serve the build, drive each screen, print a verdict. Returns an exit code. */
export async function runWalkthrough(json: boolean, root: string): Promise<number> {
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
		return 2;
	}
	const session = sessionResult.stdout.toString().trim();
	const steps: Step[] = [];
	const record = (name: string, ok: boolean, detail: string) => {
		steps.push({ name, ok, detail });
		if (!json) console.log(`${ok ? "ok" : "FAIL"} ${name}${detail === "" ? "" : ` ${detail}`}`);
	};
	try {
		await browser(session, ["open", site.url, "--init-script", stub]);
		await waitUntil(session, 'document.querySelectorAll("#method option").length > 0');
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

		await browser(session, [
			"eval",
			'document.getElementById("session").value = "ses_beta"; document.getElementById("prompt").focus();',
		]);
		const held = evalJson(
			await browser(session, [
				"eval",
				'new Promise((done) => setTimeout(() => done(JSON.stringify({ value: document.getElementById("session").value, focus: document.activeElement?.id ?? "" })), 6500))',
			]),
		);
		const heldState =
			typeof held === "string" && held.startsWith("{")
				? (JSON.parse(held) as { value: string; focus: string })
				: { value: "", focus: "" };
		record(
			"a poll keeps the chosen session and the focus",
			heldState.value === "ses_beta" && heldState.focus === "prompt",
			`value=${heldState.value} focus=${heldState.focus}`,
		);

		await browser(session, [
			"eval",
			"document.querySelector('[data-screen=\"settings\"]').click()",
		]);
		await browser(session, ["eval", 'document.getElementById("settings-check").click()']);
		const settings = evalJson(
			await browser(session, [
				"eval",
				'new Promise((done) => setTimeout(() => done(JSON.stringify({ version: document.getElementById("settings-version").textContent, status: document.getElementById("settings-status").textContent, offerHidden: document.getElementById("settings-offer").hidden })), 600))',
			]),
		);
		const settingsState =
			typeof settings === "string" && settings.startsWith("{")
				? (JSON.parse(settings) as {
						version: string;
						status: string;
						offerHidden: boolean;
					})
				: { version: "", status: "", offerHidden: true };
		record(
			"settings checks for updates on demand",
			settingsState.version.includes("walkthrough") &&
				settingsState.status.includes("9.9.9") &&
				!settingsState.offerHidden,
			`${settingsState.version} · ${settingsState.status}`,
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
	return failed === 0 ? 0 : 1;
}

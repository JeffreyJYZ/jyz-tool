import "./app.css";
import { screenFromHash, screenHref } from "./screens.ts";

export { configRows } from "./screens.ts";

import { initCall } from "./call.ts";
import { initConfig } from "./config.ts";
import { initOpencode } from "./opencode.ts";
import { initSettings } from "./settings.ts";
import { initUpdate } from "./updates.ts";

if (typeof document !== "undefined") {
	const tauri = (
		globalThis as {
			__TAURI_INTERNALS__?: {
				invoke?: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
			};
		}
	).__TAURI_INTERNALS__;
	const invoke = tauri?.invoke;

	const app = document.getElementById("app") as HTMLElement;

	const banner = document.createElement("div");
	banner.id = "update-banner";
	banner.hidden = true;
	app.append(banner);

	const nav = document.createElement("nav");
	nav.className = "tabs";
	nav.id = "tabs";
	for (const name of ["call", "config", "opencode", "settings"]) {
		const btn = document.createElement("button");
		btn.type = "button";
		btn.dataset.screen = name;
		btn.textContent =
			name === "opencode" ? "opencode" : name.charAt(0).toUpperCase() + name.slice(1);
		if (name === "call") btn.classList.add("active");
		nav.append(btn);
	}
	app.append(nav);

	const main = document.createElement("main");
	app.append(main);

	function makeScreen(id: string, active: boolean): HTMLElement {
		const sec = document.createElement("section");
		sec.className = "screen" + (active ? " active" : "");
		sec.id = id;
		return sec;
	}

	// Call screen
	const callScreen = makeScreen("screen-call", true);
	const form = document.createElement("form");
	form.id = "call";
	const methodLabel = document.createElement("label");
	methodLabel.textContent = "method";
	const method = document.createElement("select");
	method.id = "method";
	method.name = "method";
	methodLabel.append(method);
	const paramsLabel = document.createElement("label");
	paramsLabel.textContent = "params";
	const params = document.createElement("textarea");
	params.id = "params";
	params.name = "params";
	params.spellcheck = false;
	params.autocomplete = "off";
	paramsLabel.append(params);
	const run = document.createElement("button");
	run.id = "run";
	run.type = "submit";
	run.textContent = "Run";
	form.append(methodLabel, paramsLabel, run);
	const result = document.createElement("pre");
	result.id = "result";
	result.dataset.state = "idle";
	result.textContent = "no call yet";
	callScreen.append(form, result);
	main.append(callScreen);

	// Config screen
	const configScreen = makeScreen("screen-config", false);
	const configRefresh = document.createElement("button");
	configRefresh.id = "config-refresh";
	configRefresh.type = "button";
	configRefresh.textContent = "Refresh";
	const configTable = document.createElement("table");
	configTable.id = "config-table";
	const configTbody = document.createElement("tbody");
	configTable.append(configTbody);
	const configRaw = document.createElement("pre");
	configRaw.id = "config-raw";
	configRaw.dataset.state = "idle";
	configScreen.append(configRefresh, configTable, configRaw);
	main.append(configScreen);

	// Opencode screen
	const ocScreen = makeScreen("screen-opencode", false);
	const sessionLabel = document.createElement("label");
	sessionLabel.textContent = "session";
	const session = document.createElement("select");
	session.id = "session";
	sessionLabel.append(session);
	const promptLabel = document.createElement("label");
	promptLabel.textContent = "prompt";
	const prompt = document.createElement("textarea");
	prompt.id = "prompt";
	prompt.spellcheck = false;
	prompt.autocomplete = "off";
	promptLabel.append(prompt);
	const sendPrompt = document.createElement("button");
	sendPrompt.id = "send-prompt";
	sendPrompt.type = "button";
	sendPrompt.textContent = "Send";
	const ocRefresh = document.createElement("button");
	ocRefresh.id = "oc-refresh";
	ocRefresh.type = "button";
	ocRefresh.textContent = "Refresh";
	const ocStatus = document.createElement("pre");
	ocStatus.id = "oc-status";
	ocStatus.dataset.state = "idle";
	ocStatus.textContent = "no sessions yet";
	const ocTable = document.createElement("table");
	ocTable.id = "oc-table";
	const ocTbody = document.createElement("tbody");
	ocTable.append(ocTbody);
	ocScreen.append(sessionLabel, promptLabel, sendPrompt, ocRefresh, ocStatus, ocTable);
	main.append(ocScreen);

	// Settings screen
	const settingsScreen = makeScreen("screen-settings", false);
	const settingsVersion = document.createElement("div");
	settingsVersion.id = "settings-version";
	settingsVersion.textContent = "checking…";
	const settingsCheck = document.createElement("button");
	settingsCheck.id = "settings-check";
	settingsCheck.type = "button";
	settingsCheck.textContent = "Check for updates";
	const settingsStatus = document.createElement("div");
	settingsStatus.id = "settings-status";
	settingsStatus.dataset.state = "idle";
	settingsStatus.textContent = "idle";
	const settingsOffer = document.createElement("div");
	settingsOffer.id = "settings-offer";
	settingsOffer.hidden = true;
	settingsScreen.append(settingsVersion, settingsCheck, settingsStatus, settingsOffer);
	main.append(settingsScreen);

	const footer = document.createElement("footer");
	footer.id = "version";
	footer.textContent = "jyz · checking";
	app.append(footer);

	initCall(invoke, { method, params, result, run, form });
	initConfig(invoke, { configRefresh, configBody: configTbody, configRaw });
	initOpencode(invoke, { session, prompt, sendPrompt, ocRefresh, ocStatus, ocBody: ocTbody });
	initUpdate(invoke, { banner });
	initSettings(invoke, { settingsVersion, settingsStatus, settingsOffer, settingsCheck, banner });

	// tabs
	function showScreen(name: string): void {
		for (const btn of document.querySelectorAll("nav.tabs button")) {
			(btn as HTMLElement).classList.toggle(
				"active",
				(btn as HTMLElement).dataset.screen === name,
			);
		}
		for (const sec of document.querySelectorAll(".screen")) {
			(sec as HTMLElement).classList.toggle("active", sec.id === "screen-" + name);
		}
		if (name === "config") (window as any).__configLoad?.();
		if (name === "settings") (window as any).__settingsLoad?.();
		if (name === "opencode") {
			(window as any).__ocLoad?.();
			(window as any).__ocStart?.();
		} else (window as any).__ocStop?.();
	}
	window.addEventListener("hashchange", () => showScreen(screenFromHash(location.hash)));
	document.querySelectorAll("nav.tabs button").forEach((btn) => {
		btn.addEventListener("click", () => {
			location.hash = screenHref((btn as HTMLElement).dataset.screen as any);
		});
	});
	showScreen(screenFromHash(location.hash || "#call"));

	if (!invoke) {
		footer.textContent = "jyz · bridge unavailable outside the window";
	} else {
		invoke("jyz_version")
			.then((v) => {
				footer.textContent = String(v);
			})
			.catch((e) => {
				footer.textContent = `jyz · ${String(e?.message ?? e)}`;
			});
		invoke("jyz_update_check")
			.then((offer) => {
				if (offer) (window as any).__renderUpdate?.(offer);
			})
			.catch(() => {});
	}
}

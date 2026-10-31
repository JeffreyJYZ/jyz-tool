import { makeScreen, markLive } from "./a11y.ts";
import { makeBanner, makeFooter } from "./chrome.ts";

export interface Shell {
	app: HTMLElement;
	banner: HTMLDivElement;
	nav: HTMLElement;
	main: HTMLElement;
	callScreen: HTMLElement;
	method: HTMLSelectElement;
	params: HTMLTextAreaElement;
	result: HTMLElement;
	run: HTMLButtonElement;
	execute: HTMLInputElement;
	form: HTMLFormElement;
	configScreen: HTMLElement;
	configRefresh: HTMLButtonElement;
	configBody: HTMLElement;
	configRaw: HTMLElement;
	configTable: HTMLTableElement;
	ocScreen: HTMLElement;
	session: HTMLSelectElement;
	prompt: HTMLTextAreaElement;
	sendPrompt: HTMLButtonElement;
	ocRefresh: HTMLButtonElement;
	ocStatus: HTMLElement;
	ocBody: HTMLElement;
	ocEvents: HTMLElement;
	ocTable: HTMLTableElement;
	settingsScreen: HTMLElement;
	settingsVersion: HTMLElement;
	settingsCheck: HTMLButtonElement;
	settingsStatus: HTMLElement;
	settingsOffer: HTMLElement;
	footer: HTMLElement;
}
export function buildShell(): Shell {
	const app = document.getElementById("app") as HTMLElement;
	const banner = makeBanner();
	app.append(banner);
	const nav = document.createElement("nav");
	nav.className = "tabs";
	nav.id = "tabs";
	nav.setAttribute("aria-label", "Screens");
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

	// Call screen
	const callScreen = makeScreen("screen-call", true, "Call");
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
	const execute = Object.assign(document.createElement("input"), {
		id: "execute",
		type: "checkbox",
	});
	const executeLabel = Object.assign(document.createElement("label"), { textContent: "Run it" });
	executeLabel.append(execute);
	form.append(methodLabel, paramsLabel, executeLabel, run);
	const result = document.createElement("pre");
	result.id = "result";
	result.dataset.state = "idle";
	result.textContent = "no call yet";
	markLive(result);
	callScreen.append(form, result);
	main.append(callScreen);
	// Config screen
	const configScreen = makeScreen("screen-config", false, "Config");
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
	const ocScreen = makeScreen("screen-opencode", false, "opencode");
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
	markLive(ocStatus);
	const ocTable = document.createElement("table");
	ocTable.id = "oc-table";
	const ocTbody = document.createElement("tbody");
	ocTable.append(ocTbody);
	const ocEvents = Object.assign(document.createElement("pre"), { id: "oc-events" });
	ocEvents.dataset.state = "idle";
	ocScreen.append(sessionLabel, promptLabel, sendPrompt, ocRefresh, ocStatus, ocTable, ocEvents);
	main.append(ocScreen);
	// Settings screen
	const settingsScreen = makeScreen("screen-settings", false, "Settings");
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
	markLive(settingsStatus);
	const settingsOffer = document.createElement("div");
	settingsOffer.id = "settings-offer";
	settingsOffer.hidden = true;
	settingsScreen.append(settingsVersion, settingsCheck, settingsStatus, settingsOffer);
	main.append(settingsScreen);
	const footer = makeFooter();
	app.append(footer);
	return {
		app,
		banner: banner as HTMLDivElement,
		nav,
		main,
		callScreen,
		method: method as HTMLSelectElement,
		params: params as HTMLTextAreaElement,
		result,
		run: run as HTMLButtonElement,
		execute: execute as HTMLInputElement,
		form: form as HTMLFormElement,
		configScreen,
		configRefresh: configRefresh as HTMLButtonElement,
		configBody: configTbody,
		configRaw,
		configTable,
		ocScreen,
		session: session as HTMLSelectElement,
		prompt: prompt as HTMLTextAreaElement,
		sendPrompt: sendPrompt as HTMLButtonElement,
		ocRefresh: ocRefresh as HTMLButtonElement,
		ocStatus,
		ocBody: ocTbody,
		ocEvents,
		ocTable,
		settingsScreen,
		settingsVersion,
		settingsCheck: settingsCheck as HTMLButtonElement,
		settingsStatus,
		settingsOffer,
		footer,
	};
}

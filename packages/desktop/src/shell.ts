import { makeScreen, markLive } from "./a11y.ts";
import { makeBanner, makeFooter, makeTabs } from "./chrome.ts";

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
/** Build the shell in `doc`; the parameter keeps tests off the global document. */
export function buildShell(doc: Document = document): Shell {
	const app = doc.getElementById("app") as HTMLElement;
	const banner = makeBanner(doc);
	app.append(banner);
	const nav = makeTabs(doc);
	app.append(nav);
	const main = doc.createElement("main");
	app.append(main);

	// Call screen
	const callScreen = makeScreen("screen-call", true, "Call", doc);
	const form = doc.createElement("form");
	form.id = "call";
	const methodLabel = doc.createElement("label");
	methodLabel.textContent = "method";
	const method = doc.createElement("select");
	method.id = "method";
	method.name = "method";
	methodLabel.append(method);
	const paramsLabel = doc.createElement("label");
	paramsLabel.textContent = "params";
	const params = doc.createElement("textarea");
	params.id = "params";
	params.name = "params";
	params.spellcheck = false;
	params.autocomplete = "off";
	paramsLabel.append(params);
	const run = doc.createElement("button");
	run.id = "run";
	run.type = "submit";
	run.textContent = "Run";
	const execute = Object.assign(doc.createElement("input"), {
		id: "execute",
		type: "checkbox",
	});
	const executeLabel = Object.assign(doc.createElement("label"), { textContent: "Run it" });
	executeLabel.append(execute);
	form.append(methodLabel, paramsLabel, executeLabel, run);
	const result = doc.createElement("pre");
	result.id = "result";
	result.dataset.state = "idle";
	result.textContent = "no call yet";
	markLive(result);
	callScreen.append(form, result);
	main.append(callScreen);
	// Config screen
	const configScreen = makeScreen("screen-config", false, "Config", doc);
	const configRefresh = doc.createElement("button");
	configRefresh.id = "config-refresh";
	configRefresh.type = "button";
	configRefresh.textContent = "Refresh";
	const configTable = doc.createElement("table");
	configTable.id = "config-table";
	const configTbody = doc.createElement("tbody");
	configTable.append(configTbody);
	const configRaw = doc.createElement("pre");
	configRaw.id = "config-raw";
	configRaw.dataset.state = "idle";
	configScreen.append(configRefresh, configTable, configRaw);
	main.append(configScreen);
	// Opencode screen
	const ocScreen = makeScreen("screen-opencode", false, "opencode", doc);
	const sessionLabel = doc.createElement("label");
	sessionLabel.textContent = "session";
	const session = doc.createElement("select");
	session.id = "session";
	sessionLabel.append(session);
	const promptLabel = doc.createElement("label");
	promptLabel.textContent = "prompt";
	const prompt = doc.createElement("textarea");
	prompt.id = "prompt";
	prompt.spellcheck = false;
	prompt.autocomplete = "off";
	promptLabel.append(prompt);
	const sendPrompt = doc.createElement("button");
	sendPrompt.id = "send-prompt";
	sendPrompt.type = "button";
	sendPrompt.textContent = "Send";
	const ocRefresh = doc.createElement("button");
	ocRefresh.id = "oc-refresh";
	ocRefresh.type = "button";
	ocRefresh.textContent = "Refresh";
	const ocStatus = doc.createElement("pre");
	ocStatus.id = "oc-status";
	ocStatus.dataset.state = "idle";
	ocStatus.textContent = "no sessions yet";
	markLive(ocStatus);
	const ocTable = doc.createElement("table");
	ocTable.id = "oc-table";
	const ocTbody = doc.createElement("tbody");
	ocTable.append(ocTbody);
	const ocEvents = Object.assign(doc.createElement("pre"), { id: "oc-events" });
	ocEvents.dataset.state = "idle";
	ocScreen.append(sessionLabel, promptLabel, sendPrompt, ocRefresh, ocStatus, ocTable, ocEvents);
	main.append(ocScreen);
	// Settings screen
	const settingsScreen = makeScreen("screen-settings", false, "Settings", doc);
	const settingsVersion = doc.createElement("div");
	settingsVersion.id = "settings-version";
	settingsVersion.textContent = "checking…";
	const settingsCheck = doc.createElement("button");
	settingsCheck.id = "settings-check";
	settingsCheck.type = "button";
	settingsCheck.textContent = "Check for updates";
	const settingsStatus = doc.createElement("div");
	settingsStatus.id = "settings-status";
	settingsStatus.dataset.state = "idle";
	settingsStatus.textContent = "idle";
	markLive(settingsStatus);
	const settingsOffer = doc.createElement("div");
	settingsOffer.id = "settings-offer";
	settingsOffer.hidden = true;
	settingsScreen.append(settingsVersion, settingsCheck, settingsStatus, settingsOffer);
	main.append(settingsScreen);
	const footer = makeFooter(doc);
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

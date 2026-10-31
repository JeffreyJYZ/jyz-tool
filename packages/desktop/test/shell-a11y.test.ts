import { beforeEach, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { buildShell } from "../src/shell.ts";

/**
 * The shell markup, asserted without a browser so the a11y contract is gated on every CI job.
 * `bun run a11y` still reads the built page the way a screen reader does; this test catches a
 * regression at the source, before a build exists.
 */
/** A document per test; nothing is installed on globalThis, so other suites are unaffected. */
function mount(): Document {
	const window = new Window({ url: "http://localhost/" });
	const app = window.document.createElement("div");
	app.id = "app";
	window.document.body.append(app);
	return window.document as unknown as Document;
}

beforeEach(() => {
	expect(mount().getElementById("app")).not.toBeNull();
});

test("one main, a labelled nav and a footer", () => {
	const document = mount();
	buildShell(document);
	expect(document.querySelectorAll("main")).toHaveLength(1);
	expect(document.querySelector("nav")?.getAttribute("aria-label")).toBe("Screens");
	expect(document.querySelectorAll("footer")).toHaveLength(1);
});

test("every control carries an accessible name", () => {
	const document = mount();
	const shell = buildShell(document);
	const controls = [
		shell.method,
		shell.params,
		shell.run,
		shell.execute,
		shell.configRefresh,
		shell.session,
		shell.prompt,
		shell.sendPrompt,
		shell.ocRefresh,
		shell.settingsCheck,
	];
	for (const control of controls) {
		const id = control.getAttribute("id");
		const labelled =
			control.getAttribute("aria-label") ??
			(id ? document.querySelector(`label[for="${id}"]`)?.textContent : null) ??
			control.closest("label")?.textContent ??
			// A button is named by its own text, which is the usual case here.
			(control.tagName === "BUTTON" ? control.textContent : null);
		expect(labelled?.trim()).toBeTruthy();
	}
});

test("each screen is a region with a heading", () => {
	const document = mount();
	buildShell(document);
	const screens = [...document.querySelectorAll(".screen")];
	expect(screens).toHaveLength(5);
	for (const screen of screens) {
		expect(screen.getAttribute("role")).toBe("region");
		const id = screen.getAttribute("aria-labelledby");
		expect(id).toBeTruthy();
		expect(document.getElementById(id ?? "")?.textContent?.trim()).toBeTruthy();
	}
});

test("status regions announce, and the active tab is current", () => {
	const document = mount();
	const shell = buildShell(document);
	for (const region of [shell.result, shell.ocStatus, shell.settingsStatus]) {
		expect(region.getAttribute("role")).toBe("status");
		expect(region.getAttribute("aria-live")).toBe("polite");
	}
	const current = document.querySelectorAll('nav [aria-current="page"]');
	expect(current).toHaveLength(1);
});

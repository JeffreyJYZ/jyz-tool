import "./app.css";
import { screenFromHash, screenHref } from "./screens.ts";

export { configRows } from "./screens.ts";

import { initCall } from "./call.ts";
import { initConfig } from "./config.ts";
import { initOpencode } from "./opencode.ts";
import { initSettings } from "./settings.ts";
import { buildShell } from "./shell.ts";
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

	const s = buildShell();

	initCall(invoke, {
		method: s.method,
		params: s.params,
		result: s.result,
		run: s.run,
		execute: s.execute,
		form: s.form,
	});
	initConfig(invoke, {
		configRefresh: s.configRefresh,
		configBody: s.configBody,
		configRaw: s.configRaw,
	});
	initOpencode(invoke, {
		session: s.session,
		prompt: s.prompt,
		sendPrompt: s.sendPrompt,
		ocRefresh: s.ocRefresh,
		ocStatus: s.ocStatus,
		ocBody: s.ocBody,
		ocEvents: s.ocEvents,
	});
	initUpdate(invoke, { banner: s.banner });
	initSettings(invoke, {
		settingsVersion: s.settingsVersion,
		settingsStatus: s.settingsStatus,
		settingsOffer: s.settingsOffer,
		settingsCheck: s.settingsCheck,
		banner: s.banner,
	});

	// tabs
	function showScreen(name: string): void {
		for (const btn of document.querySelectorAll("nav.tabs button")) {
			const active = (btn as HTMLElement).dataset.screen === name;
			(btn as HTMLElement).classList.toggle("active", active);
			if (active) (btn as HTMLElement).setAttribute("aria-current", "page");
			else (btn as HTMLElement).removeAttribute("aria-current");
		}
		for (const sec of document.querySelectorAll(".screen")) {
			(sec as HTMLElement).classList.toggle("active", sec.id === `screen-${name}`);
		}
		if (name === "config") window.__configLoad?.();
		if (name === "settings") window.__settingsLoad?.();
		if (name === "opencode") {
			window.__ocLoad?.();
			window.__ocStart?.();
		} else window.__ocStop?.();
	}
	window.addEventListener("hashchange", () => showScreen(screenFromHash(location.hash)));
	document.querySelectorAll("nav.tabs button").forEach((btn) => {
		btn.addEventListener("click", () => {
			location.hash = screenHref(
				screenFromHash(`#${(btn as HTMLElement).dataset.screen ?? ""}`),
			);
		});
	});
	showScreen(screenFromHash(location.hash || "#call"));

	if (!invoke) {
		s.footer.textContent = "jyz · bridge unavailable outside the window";
	} else {
		invoke("jyz_version")
			.then((v) => {
				s.footer.textContent = String(v);
			})
			.catch((e) => {
				s.footer.textContent = `jyz · ${String(e?.message ?? e)}`;
			});
		invoke("jyz_update_check")
			.then((offer) => {
				if (offer)
					window.__renderUpdate?.(
						offer as { current: string; version: string; notes: string | null },
					);
			})
			.catch(() => {});
	}
}

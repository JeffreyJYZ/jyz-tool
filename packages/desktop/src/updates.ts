// Desktop update shaping, kept free of Tauri so bun:test can reach it.
//
// The page in ui/index.html drives the updater through the bridge; the helpers here are
// the pure parts (shaping the offer into banner text) that the page mirrors in plain JS.

export interface UpdateOffer {
	current: string;
	version: string;
	notes: string | null;
}

export interface UpdateDescription {
	headline: string;
	detail: string;
}

/** Shape an update offer into banner text; null when there is nothing to offer. */
export function describeUpdate(
	offer: { current: string; version: string; notes: string | null } | null,
): { headline: string; detail: string } | null {
	if (offer === null) return null;
	return {
		headline: `update available: ${offer.version}`,
		detail: offer.notes === null ? "" : offer.notes,
	};
}

/** One-line message for a failed update check. */
export function updateCheckFailed(error: unknown): string {
	if (error instanceof Error) return error.message;
	return String(error);
}

/** Shape a check result into a status line. */
export function checkStatus(
	result: { current: string; version: string; notes: string | null } | null,
): { state: "current" | "available"; text: string } {
	if (result === null || result.version === result.current) {
		const version = result === null ? "" : result.current;
		const text =
			version === ""
				? "you are on the newest build"
				: `you are on the newest build (${version})`;
		return { state: "current", text };
	}
	return { state: "available", text: `update available: ${result.version}` };
}

/** One-line message for a failed check, never a stack. */
export function checkFailure(error: unknown): string {
	if (error instanceof Error) return error.message;
	return String(error);
}

import { listenUpdateCheck, listenUpdateProgress, unwrapResult } from "./events.ts";

interface Refs {
	banner: HTMLElement;
}

export function initUpdate(
	invoke: ((c: string, a?: Record<string, unknown>) => Promise<unknown>) | undefined,
	refs: Refs,
): void {
	const { banner } = refs;
	function renderUpdate(offer: { current: string; version: string; notes: string | null }): void {
		const desc = describeUpdate(offer);
		if (!desc) return;
		banner.hidden = false;
		banner.textContent = "";
		const span = document.createElement("span");
		span.textContent = `update available: ${offer.version}`;
		banner.append(span);
		if (typeof offer.notes === "string" && offer.notes !== "") {
			const detail = document.createElement("span");
			detail.textContent = offer.notes;
			banner.append(detail);
		}
		const btn = document.createElement("button");
		btn.type = "button";
		btn.textContent = "Install";
		installButton = btn;
		btn.addEventListener("click", async () => {
			if (!invoke) return;
			btn.disabled = true;
			btn.textContent = "installing…";
			try {
				await invoke("jyz_update_install");
			} catch (error) {
				btn.disabled = false;
				btn.textContent = "Install";
				installButton = null;
				banner.append(
					Object.assign(document.createElement("span"), {
						textContent: error instanceof Error ? error.message : String(error),
					}),
				);
			}
		});
		banner.append(btn);
	}

	// A ~47 MB download with a still button reads as a hang, so the button carries the byte count.
	let installButton: HTMLButtonElement | null = null;
	listenUpdateProgress(({ downloaded, total }) => {
		if (installButton === null) return;
		const mb = (downloaded / 1_048_576).toFixed(1);
		installButton.textContent =
			total !== null && total > 0
				? `installing… ${Math.min(100, Math.floor((downloaded / total) * 100))}% · ${mb} of ${(total / 1_048_576).toFixed(1)} MB`
				: `installing… ${mb} MB`;
	});
	window.__renderUpdate = (offer) => {
		if (offer !== null && offer !== undefined) renderUpdate(offer);
	};
	// "Check for Updates…" runs in Rust, so its answer arrives as an event. Show it either way:
	// silence on "you are on the newest build" reads like the menu did nothing.
	listenUpdateCheck((payload) => {
		const result = unwrapResult(payload);
		if ("error" in result) {
			showStatus(`update check failed: ${result.error}`);
			return;
		}
		const offer = result.offer as {
			current: string;
			version: string;
			notes: string | null;
		} | null;
		if (offer !== null && offer.version !== offer.current) {
			renderUpdate(offer);
			return;
		}
		showStatus(checkStatus(offer).text);
	});

	function showStatus(text: string): void {
		banner.hidden = false;
		banner.textContent = text;
	}
}

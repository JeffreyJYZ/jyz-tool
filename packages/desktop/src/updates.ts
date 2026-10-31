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
		btn.addEventListener("click", async () => {
			if (!invoke) return;
			btn.disabled = true;
			btn.textContent = "installing… the app will restart";
			try {
				await invoke("jyz_update_install");
			} catch (error) {
				btn.disabled = false;
				btn.textContent = "Install";
				banner.append(
					Object.assign(document.createElement("span"), {
						textContent: error instanceof Error ? error.message : String(error),
					}),
				);
			}
		});
		banner.append(btn);
	}
	(window as any).__renderUpdate = renderUpdate;
}

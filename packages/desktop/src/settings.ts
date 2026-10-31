import { checkStatus } from "./updates.ts";

interface Refs {
	settingsVersion: HTMLElement;
	settingsStatus: HTMLElement;
	settingsOffer: HTMLElement;
	settingsCheck: HTMLButtonElement;
	banner: HTMLElement;
}

export function initSettings(
	invoke: ((c: string, a?: Record<string, unknown>) => Promise<unknown>) | undefined,
	refs: Refs,
): void {
	const { settingsVersion, settingsStatus, settingsOffer, settingsCheck, banner } = refs;

	async function loadSettingsVersion(): Promise<void> {
		if (!invoke) {
			settingsVersion.textContent =
				"bridge unavailable: open this page inside the jyz window";
			return;
		}
		try {
			settingsVersion.textContent = String(await invoke("jyz_version"));
		} catch (error) {
			settingsVersion.textContent = `jyz · ${error instanceof Error ? error.message : String(error)}`;
		}
	}

	function renderSettingsOffer(offer: {
		current: string;
		version: string;
		notes: string | null;
	}): void {
		settingsOffer.hidden = false;
		settingsOffer.textContent = "";
		const span = document.createElement("span");
		span.textContent = `update available: ${offer.version}`;
		settingsOffer.append(span);
		if (typeof offer.notes === "string" && offer.notes !== "") {
			const detail = document.createElement("span");
			detail.textContent = offer.notes;
			settingsOffer.append(detail);
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
				settingsOffer.append(
					Object.assign(document.createElement("span"), {
						textContent: error instanceof Error ? error.message : String(error),
					}),
				);
			}
		});
		settingsOffer.append(btn);
	}

	async function checkSettings(): Promise<void> {
		if (!invoke) {
			settingsStatus.dataset.state = "error";
			settingsStatus.textContent = "bridge unavailable: open this page inside the jyz window";
			return;
		}
		settingsCheck.disabled = true;
		settingsStatus.dataset.state = "idle";
		settingsStatus.textContent = "checking…";
		settingsOffer.hidden = true;
		settingsOffer.textContent = "";
		try {
			const offer = (await invoke("jyz_update_check")) as {
				current: string;
				version: string;
				notes: string | null;
			} | null;
			const status = checkStatus(offer);
			settingsStatus.dataset.state = status.state === "available" ? "ok" : "ok";
			settingsStatus.textContent =
				status.text === "you are on the newest build" ? status.text : status.text;
			if (offer && offer.version !== offer.current) {
				settingsStatus.textContent = `update available: ${offer.version}`;
				renderSettingsOffer(offer);
				banner.hidden = true;
			} else {
				settingsStatus.textContent = offer
					? `you are on the newest build (${offer.current})`
					: "you are on the newest build";
			}
		} catch (error) {
			settingsStatus.dataset.state = "error";
			settingsStatus.textContent = error instanceof Error ? error.message : String(error);
		} finally {
			settingsCheck.disabled = false;
		}
	}
	settingsCheck.addEventListener("click", checkSettings);
	window.__settingsLoad = loadSettingsVersion;
}

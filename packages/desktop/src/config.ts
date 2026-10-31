import { configRows as parseConfig } from "./screens.ts";

interface Refs {
	configRefresh: HTMLButtonElement;
	configBody: HTMLElement;
	configRaw: HTMLElement;
}

export function initConfig(
	invoke: ((c: string, a?: Record<string, unknown>) => Promise<unknown>) | undefined,
	refs: Refs,
): void {
	const { configRefresh, configBody, configRaw } = refs;
	async function loadConfig(): Promise<void> {
		if (!invoke) {
			configRaw.dataset.state = "error";
			configRaw.textContent = "bridge unavailable: open this page inside the jyz window";
			return;
		}
		configRaw.dataset.state = "idle";
		configRaw.textContent = "loading…";
		try {
			const line = await invoke("jyz_call", {
				method: "config",
				params: JSON.stringify({ action: "show" }),
			});
			const frame = JSON.parse(String(line)) as { result?: { stdout?: string } };
			const stdout = frame?.result?.stdout ?? frame?.result;
			const text = typeof stdout === "string" ? stdout : JSON.stringify(frame?.result);
			configBody.innerHTML = "";
			for (const row of parseConfig(text)) {
				const tr = document.createElement("tr");
				for (const v of [row.key, row.value, row.source]) {
					const td = document.createElement("td");
					td.textContent = v;
					tr.append(td);
				}
				configBody.append(tr);
			}
			configRaw.dataset.state = "ok";
			configRaw.textContent = text;
		} catch (error) {
			configRaw.dataset.state = "error";
			configRaw.textContent = error instanceof Error ? error.message : String(error);
		}
	}
	configRefresh.addEventListener("click", loadConfig);
	(window as Window & { __configLoad?: () => void }).__configLoad = loadConfig;
}

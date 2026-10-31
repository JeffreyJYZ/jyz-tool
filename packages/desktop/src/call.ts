import { buildCall, formatResult, mapError, readResult, selectableMethods } from "./bridge.ts";
import { runSummary } from "./run.ts";

interface Refs {
	method: HTMLSelectElement;
	params: HTMLTextAreaElement;
	result: HTMLElement;
	run: HTMLButtonElement;
	execute: HTMLInputElement;
	form: HTMLFormElement;
}

export function initCall(
	invoke: ((c: string, a?: Record<string, unknown>) => Promise<unknown>) | undefined,
	refs: Refs,
): void {
	const { method, params, result, run, execute, form } = refs;
	async function loadMethods(): Promise<void> {
		if (!invoke) return;
		let manifest: { name: string; kind: string }[] = [];
		try {
			const m = await invoke("jyz_capabilities");
			if (Array.isArray(m)) manifest = m as { name: string; kind: string }[];
		} catch {
			manifest = [];
		}
		const groups: Record<string, string[]> = {};
		for (const entry of manifest) {
			if (!groups[entry.kind]) groups[entry.kind] = [];
			const bucket = groups[entry.kind];
			if (bucket !== undefined) bucket.push(entry.name);
		}
		for (const [kind, names] of Object.entries(groups)) {
			const optgroup = document.createElement("optgroup");
			optgroup.label = kind;
			for (const name of names) {
				const option = document.createElement("option");
				option.value = name;
				option.textContent = name;
				optgroup.append(option);
			}
			method.append(optgroup);
		}
		if (manifest.length > 0) method.value = selectableMethods(manifest)[0] ?? "";
	}
	void loadMethods();

	function show(state: string, text: string): void {
		result.dataset.state = state;
		result.textContent = text;
	}
	form.addEventListener("submit", async (event) => {
		event.preventDefault();
		if (!invoke) {
			show("error", "bridge unavailable: open this page inside the jyz window");
			return;
		}
		const text = params.value.trim();
		if (text !== "") {
			try {
				JSON.parse(text);
			} catch (error) {
				show(
					"error",
					`params is not JSON: ${error instanceof Error ? error.message : String(error)}`,
				);
				return;
			}
		}
		run.disabled = true;
		result.setAttribute("aria-busy", "true");
		show("idle", "running…");
		try {
			const call = buildCall(method.value, text);
			const executeFlag = execute.checked;
			const line = await invoke("jyz_call", {
				method: call.method,
				params: call.params,
				execute: executeFlag,
			});
			const value = readResult(String(line));
			if (executeFlag) {
				const summary = runSummary(
					value as {
						exitCode: number;
						stdout?: string;
						stderr?: string;
						argv?: string[];
					},
				);
				show(summary.state, summary.text);
			} else {
				show("ok", formatResult(value));
			}
		} catch (error) {
			show("error", mapError(error));
		} finally {
			result.setAttribute("aria-busy", "false");
			run.disabled = false;
		}
	});
}

import { eventLines } from "./run.ts";
import { diffSessions, sessionRows as parseSessions, promptArgv } from "./screens.ts";

interface Refs {
	session: HTMLSelectElement;
	prompt: HTMLTextAreaElement;
	sendPrompt: HTMLButtonElement;
	ocRefresh: HTMLButtonElement;
	ocStatus: HTMLElement;
	ocBody: HTMLElement;
	ocEvents: HTMLElement;
}

export function initOpencode(
	invoke: ((c: string, a?: Record<string, unknown>) => Promise<unknown>) | undefined,
	refs: Refs,
): void {
	const { session, prompt, sendPrompt, ocRefresh, ocStatus, ocBody, ocEvents } = refs;
	let previous: ReturnType<typeof parseSessions> = [];
	let watchTimer: number | null = null;

	function renderSessions(rows: ReturnType<typeof parseSessions>, changed: string[]): void {
		const chosen = session.value;
		const wanted = rows.map((row) => `${row.id}|${row.title}`).join("\n");
		if (session.dataset.signature !== wanted) {
			session.innerHTML = "";
			for (const row of rows) {
				const option = document.createElement("option");
				option.value = row.id;
				option.textContent = `${row.title} (${row.id})${changed.includes(row.id) ? " *" : ""}`;
				session.append(option);
			}
			session.dataset.signature = wanted;
			if (rows.some((row) => row.id === chosen)) session.value = chosen;
		}
		ocBody.innerHTML = "";
		for (const row of rows) {
			const tr = document.createElement("tr");
			for (const v of [row.id, row.title, row.updatedAt]) {
				const td = document.createElement("td");
				td.textContent = v;
				tr.append(td);
			}
			ocBody.append(tr);
		}
	}

	async function loadSessions(): Promise<void> {
		if (!invoke) {
			ocStatus.dataset.state = "error";
			ocStatus.textContent = "bridge unavailable: open this page inside the jyz window";
			return;
		}
		try {
			const out = await invoke("jyz_oc", { args: ["sessions", "--json"] });
			const rows = parseSessions(String(out));
			const changed = diffSessions(previous, rows);
			previous = rows;
			renderSessions(rows, changed);
			ocStatus.dataset.state = "ok";
			ocStatus.textContent =
				rows.length === 0
					? "no sessions"
					: `${rows.length} session(s)` +
						(changed.length ? ` · changed: ${changed.join(", ")}` : "");
		} catch (error) {
			ocStatus.dataset.state = "error";
			ocStatus.textContent = `opencode server unavailable: ${error instanceof Error ? error.message : String(error)}`;
		}
	}

	ocRefresh.addEventListener("click", loadSessions);
	sendPrompt.addEventListener("click", async () => {
		if (!invoke) return;
		const s = session.value;
		const text = prompt.value.trim();
		if (!s || !text) {
			ocStatus.dataset.state = "error";
			ocStatus.textContent = "pick a session and type a prompt";
			return;
		}
		try {
			const argv = promptArgv(s, text);
			await invoke("jyz_oc", { args: argv });
			ocStatus.dataset.state = "ok";
			ocStatus.textContent = `sent to ${s}`;
		} catch (error) {
			ocStatus.dataset.state = "error";
			ocStatus.textContent = error instanceof Error ? error.message : String(error);
		}
	});

	async function loadEvents(): Promise<void> {
		if (!invoke) return;
		try {
			const out = await invoke("jyz_oc", {
				args: ["watch", "--timeout", "4000", "--json"],
			});
			const lines = eventLines(String(out));
			for (const entry of lines) {
				const li = document.createElement("div");
				li.textContent = `${entry.type}  ${entry.summary}`;
				ocEvents.append(li);
			}
			if (lines.length === 0) {
				const li = document.createElement("div");
				li.textContent = "no events";
				ocEvents.append(li);
			}
		} catch (error) {
			const li = document.createElement("div");
			li.textContent = `opencode server unavailable: ${error instanceof Error ? error.message : String(error)}`;
			ocEvents.append(li);
		}
	}
	function startWatch(): void {
		stopWatch();
		watchTimer = window.setInterval(() => {
			void loadSessions();
			void loadEvents();
		}, 5000);
	}
	function stopWatch(): void {
		if (watchTimer !== null) {
			clearInterval(watchTimer);
			watchTimer = null;
		}
	}
	window.__ocLoad = loadSessions;
	window.__ocStart = startWatch;
	window.__ocStop = stopWatch;
}

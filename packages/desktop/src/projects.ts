import { makeScreen } from "./a11y.ts";

export interface ProjectRow {
	name: string;
	packageManager: string;
	typechecker: string;
	linter: string;
	formatter: string;
}

interface Refs {
	projectsRefresh: HTMLButtonElement;
	projectsBody: HTMLElement;
	projectsStatus: HTMLElement;
}

function dirName(path: string): string {
	const parts = path.replace(/\/+$/, "").split("/");
	parts.pop();
	return parts.pop() ?? "";
}

function fieldValue(obj: Record<string, unknown>, key: string): string {
	const field = obj[key];
	if (typeof field !== "object" || field === null || Array.isArray(field)) return "—";
	const value = (field as Record<string, unknown>).value;
	return typeof value === "string" && value !== "" ? value : "—";
}

export function projectRows(payload: unknown): ProjectRow[] {
	let data: unknown = payload;
	if (typeof payload === "string") {
		try {
			data = JSON.parse(payload);
		} catch {
			return [];
		}
	}
	if (typeof data !== "object" || data === null || Array.isArray(data)) return [];
	const rec = data as Record<string, unknown>;
	const project =
		typeof rec.project === "object" && rec.project !== null && !Array.isArray(rec.project)
			? (rec.project as Record<string, unknown>)
			: {};
	const path = typeof rec.path === "string" ? rec.path : "";
	const layers = Array.isArray(rec.layers)
		? rec.layers.filter((x): x is string => typeof x === "string")
		: [];
	const seen = new Set<string>();
	const rows: ProjectRow[] = [];
	const mainName = path ? dirName(path) : "";
	if (mainName !== "" && !seen.has(mainName)) {
		seen.add(mainName);
		rows.push({
			name: mainName,
			packageManager: fieldValue(project, "package_manager"),
			typechecker: fieldValue(project, "typechecker"),
			linter: fieldValue(project, "linter"),
			formatter: fieldValue(project, "formatter"),
		});
	}
	for (const layer of layers) {
		const name = dirName(layer);
		if (name === "" || seen.has(name)) continue;
		seen.add(name);
		rows.push({
			name,
			packageManager: "—",
			typechecker: "—",
			linter: "—",
			formatter: "—",
		});
	}
	return rows;
}

export function makeProjectsScreen(doc: Document = document): {
	screen: HTMLElement;
	refresh: HTMLButtonElement;
	body: HTMLElement;
	status: HTMLElement;
} {
	const screen = makeScreen("screen-projects", false, "Projects", doc);
	const refresh = doc.createElement("button");
	refresh.id = "projects-refresh";
	refresh.type = "button";
	refresh.textContent = "Refresh";
	const table = doc.createElement("table");
	const thead = doc.createElement("thead");
	const headRow = doc.createElement("tr");
	for (const heading of ["Project", "Package manager", "Typechecker", "Linter", "Formatter"]) {
		const th = doc.createElement("th");
		th.textContent = heading;
		headRow.append(th);
	}
	thead.append(headRow);
	table.append(thead);
	const body = doc.createElement("tbody");
	body.id = "projects-body";
	table.append(body);
	const status = doc.createElement("p");
	status.id = "projects-status";
	status.setAttribute("role", "status");
	status.setAttribute("aria-live", "polite");
	screen.append(refresh, table, status);
	return { screen, refresh, body, status };
}

export function initProjects(
	invoke: ((c: string, a?: Record<string, unknown>) => Promise<unknown>) | undefined,
	refs: Refs,
): void {
	const { projectsRefresh, projectsBody, projectsStatus } = refs;
	async function load(): Promise<void> {
		projectsStatus.textContent = "loading…";
		projectsBody.innerHTML = "";
		if (!invoke) {
			projectsStatus.textContent = "bridge unavailable: open this page inside the jyz window";
			return;
		}
		try {
			const line = await invoke("jyz_call", {
				method: "config",
				params: JSON.stringify({ action: "show", json: true }),
			});
			const frame = JSON.parse(String(line)) as { result?: { stdout?: string } };
			const stdout = frame?.result?.stdout ?? frame?.result;
			const text = typeof stdout === "string" ? stdout : JSON.stringify(frame?.result);
			const rows = projectRows(text);
			projectsBody.innerHTML = "";
			for (const row of rows) {
				const tr = document.createElement("tr");
				for (const value of [
					row.name,
					row.packageManager,
					row.typechecker,
					row.linter,
					row.formatter,
				]) {
					const td = document.createElement("td");
					td.textContent = value;
					tr.append(td);
				}
				projectsBody.append(tr);
			}
			projectsStatus.textContent = `${rows.length} project(s)`;
		} catch (error) {
			projectsStatus.textContent = error instanceof Error ? error.message : String(error);
		}
	}
	projectsRefresh.addEventListener("click", load);
	(window as Window & { __projectsLoad?: () => void }).__projectsLoad = load;
	load();
}

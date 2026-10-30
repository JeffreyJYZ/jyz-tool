// Desktop screen shaping, kept free of Tauri so bun:test can reach it.
//
// The page in ui/index.html drives the three screens through the bridge; the helpers here are
// the pure parts (parsing, diffing, routing) that the page mirrors in plain JS.

export type Screen = "call" | "config" | "opencode";

export interface ConfigRow {
	key: string;
	value: string;
	source: string;
}

export interface SessionRow {
	id: string;
	title: string;
	updatedAt: string;
}

const SKIP_PREFIXES = ["config:", "layer:", "warning:", "aliases:", "scripts:"];

/** Parse `key = value (source)` lines; skip headers and meta lines. */
export function configRows(stdout: string): ConfigRow[] {
	const rows: ConfigRow[] = [];
	for (const raw of stdout.split(/\r?\n/)) {
		const line = raw.trim();
		if (line === "") continue;
		if (SKIP_PREFIXES.some((prefix) => line.startsWith(prefix))) continue;
		const match = line.match(/^(.+?) = (.+) \(([^)]+)\)$/);
		if (match === null) continue;
		const key = match[1];
		const value = match[2];
		const source = match[3];
		if (key === undefined || value === undefined || source === undefined) continue;
		rows.push({ key: key.trim(), value: value.trim(), source: source.trim() });
	}
	return rows;
}

/** Parse a sessions JSON string; bad input or non-array yields []. */
export function sessionRows(json: string): SessionRow[] {
	let parsed: unknown;
	try {
		parsed = JSON.parse(json);
	} catch {
		return [];
	}
	if (!Array.isArray(parsed)) return [];
	const rows: SessionRow[] = [];
	for (const item of parsed) {
		if (typeof item !== "object" || item === null || Array.isArray(item)) continue;
		const record = item as Record<string, unknown>;
		if (typeof record.id !== "string" || record.id === "") continue;
		rows.push({
			id: record.id,
			title: typeof record.title === "string" ? record.title : record.id,
			updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : "",
		});
	}
	return rows;
}

/** Ids that are new or whose title/updatedAt changed, in next order. */
export function diffSessions(previous: SessionRow[], next: SessionRow[]): string[] {
	const byId = new Map(previous.map((row) => [row.id, row]));
	const changed: string[] = [];
	for (const row of next) {
		const prior = byId.get(row.id);
		if (prior === undefined || prior.title !== row.title || prior.updatedAt !== row.updatedAt) {
			changed.push(row.id);
		}
	}
	return changed;
}

/** Build the argv for `jyz oc prompt`. */
export function promptArgv(session: string, text: string): string[] {
	return ["prompt", text, "--session", session, "--json"];
}

const SCREENS: readonly Screen[] = ["call", "config", "opencode"];

/** Map a location hash to a screen; junk and empty map to "call". */
export function screenFromHash(hash: string): Screen {
	const cleaned = hash.replace(/^#/, "").replace(/^\/+/, "").toLowerCase();
	const candidate = cleaned.split(/[/?]/)[0] ?? "";
	return SCREENS.includes(candidate as Screen) ? (candidate as Screen) : "call";
}

/** Hash for a screen, addressable in the tab strip. */
export function screenHref(screen: Screen): string {
	return `#${screen}`;
}

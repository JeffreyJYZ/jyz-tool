export interface RunResult {
	exitCode: number;
	stdout?: string;
	stderr?: string;
	argv?: string[];
}

export interface RunSummary {
	state: "ok" | "error";
	text: string;
}

export function runSummary(result: RunResult): RunSummary {
	const lines: string[] = [];
	if (Array.isArray(result.argv) && result.argv.length > 0) {
		lines.push(`$ ${result.argv.join(" ")}`);
	}
	if (typeof result.stdout === "string" && result.stdout !== "") {
		lines.push(result.stdout);
	}
	if (typeof result.stderr === "string" && result.stderr !== "") {
		lines.push(result.stderr);
	}
	const text = lines.join("\n");
	return { state: result.exitCode === 0 ? "ok" : "error", text };
}

export interface EventLine {
	type: string;
	summary: string;
}

export function eventLines(text: string): EventLine[] {
	const out: EventLine[] = [];
	for (const raw of text.split(/\r?\n/)) {
		const line = raw.trim();
		if (line === "") continue;
		let parsed: unknown;
		try {
			parsed = JSON.parse(line);
		} catch {
			continue;
		}
		if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) continue;
		const record = parsed as Record<string, unknown>;
		const type = typeof record.type === "string" ? record.type : "event";
		const summary =
			typeof record.summary === "string"
				? record.summary
				: typeof record.message === "string"
					? record.message
					: "";
		out.push({ type, summary });
	}
	return out;
}

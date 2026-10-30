/** Machine-readable output mode (`--json`). */

export function isJson(argv: string[] = process.argv): boolean {
	return argv.includes("--json");
}

export function emit(value: unknown): void {
	console.log(JSON.stringify(value, null, 2));
}

export function emitList(rows: Record<string, unknown>[]): void {
	emit(rows);
}

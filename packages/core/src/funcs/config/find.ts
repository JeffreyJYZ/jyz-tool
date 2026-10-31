import { dirname, join, resolve } from "node:path";
import { CONFIG_FILENAME } from "../../const/defaults.ts";
import { existsAsFile } from "./helpers.ts";

export function findConfigPath(startDir: string): string | null {
	let dir = resolve(startDir);
	for (;;) {
		const candidate = join(dir, CONFIG_FILENAME);
		if (existsAsFile(candidate)) return candidate;
		const parent = dirname(dir);
		if (parent === dir) return null;
		dir = parent;
	}
}

export function findConfigPaths(startDir: string): string[] {
	const paths: string[] = [];
	let dir = resolve(startDir);
	for (;;) {
		const candidate = join(dir, CONFIG_FILENAME);
		if (existsAsFile(candidate)) paths.push(candidate);
		const parent = dirname(dir);
		if (parent === dir) break;
		dir = parent;
	}
	return paths;
}

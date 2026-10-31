import { existsSync } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { CreateError } from "./errors.ts";

export async function assertUsableTarget(target: string): Promise<void> {
	if (!existsSync(target)) return;
	const info = await stat(target);
	if (!info.isDirectory()) {
		throw new CreateError(`Target ${target} exists and is not a directory.`);
	}
	const entries = await readdir(target);
	if (entries.length > 0) {
		throw new CreateError(
			`Target directory ${target} is not empty; choose another name or --dir.`,
		);
	}
}

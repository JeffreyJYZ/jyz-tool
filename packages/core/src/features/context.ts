import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export interface FeatureContext {
	read(path: string): Promise<string>;
	write(path: string, content: string): Promise<void>;
	exists(path: string): boolean | Promise<boolean>;
	join(...parts: string[]): string;
}

export function makeFsContext(dir: string): FeatureContext {
	return {
		read: async (path) => await readFile(join(dir, path), "utf8"),
		write: async (path, content) => {
			await mkdir(dirname(join(dir, path)), { recursive: true });
			await writeFile(join(dir, path), content, "utf8");
		},
		exists: (path) => existsSync(join(dir, path)),
		join: (...parts) => join(dir, ...parts),
	};
}

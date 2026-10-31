import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, sep } from "node:path";
import { fileURLToPath } from "node:url";

/** Directories a template never ships into a project, even if a stray copy exists in the source. */
const SKIP_DIRS = new Set(["node_modules", ".git", "target", ".next"]);

const PLACEHOLDER = /__[A-Z][A-Z0-9_]*__/g;

/**
 * Source files whose extension would make a repo-level tool read a template as real source carry a
 * `.tmpl` suffix; rendering drops it. Keeping it means a template can import a package that is not
 * installed here without reddening the parent repository's typecheck.
 */
const TEMPLATE_SUFFIX = ".tmpl";

/** Destination path of a template source file, with the `.tmpl` marker removed. */
export function destinationPath(sourceRelative: string): string {
	return sourceRelative.endsWith(TEMPLATE_SUFFIX)
		? sourceRelative.slice(0, -TEMPLATE_SUFFIX.length)
		: sourceRelative;
}

/** Absolute path of `packages/core/templates/`. */
export function templatesRoot(): string {
	return fileURLToPath(new URL("../../templates/", import.meta.url));
}

/**
 * Lists the files of a template as `/`-separated paths relative to its root. `docs/` is included
 * only when the caller asked for it; build output and VCS directories never are.
 */
export async function collectTemplateFiles(root: string, includeDocs: boolean): Promise<string[]> {
	const files: string[] = [];
	await walk(root, "", includeDocs, files);
	return files.sort();
}

async function walk(
	dir: string,
	prefix: string,
	includeDocs: boolean,
	out: string[],
): Promise<void> {
	const entries = await readdir(dir, { withFileTypes: true });
	for (const entry of entries) {
		if (SKIP_DIRS.has(entry.name)) continue;
		const relative = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
		if (!includeDocs && relative === "docs") continue;
		if (entry.isDirectory()) {
			await walk(join(dir, entry.name), relative, includeDocs, out);
			continue;
		}
		if (entry.isFile()) out.push(relative);
	}
}

/**
 * Renders every listed template file into `targetRoot`, replacing known placeholders and dropping
 * the `.tmpl` marker from the destination name. Binary files are copied byte for byte so a template
 * may ship an icon or a fixture.
 */
export async function renderTemplate(
	sourceRoot: string,
	targetRoot: string,
	files: string[],
	values: Record<string, string>,
): Promise<void> {
	for (const relative of files) {
		const source = join(sourceRoot, ...relative.split("/"));
		const destination = join(targetRoot, ...destinationPath(relative).split("/"));
		await mkdir(dirname(destination), { recursive: true });
		const bytes = await readFile(source);
		if (bytes.includes(0)) {
			await writeFile(destination, bytes);
			continue;
		}
		await writeFile(destination, substitute(bytes.toString("utf8"), values), "utf8");
	}
}

/** Replaces `__PLACEHOLDER__` tokens; an unknown token is left visible rather than blanked. */
export function substitute(text: string, values: Record<string, string>): string {
	return text.replace(PLACEHOLDER, (token) => values[token] ?? token);
}

/** True when the template directory is present in this checkout. */
export function templateExists(dir: string): boolean {
	return existsSync(join(templatesRoot(), dir));
}

/** Converts a native path segment list to the `/` form every `CreateResult.files` entry uses. */
export function toPosix(path: string): string {
	return sep === "/" ? path : path.split(sep).join("/");
}

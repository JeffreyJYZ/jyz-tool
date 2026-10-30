import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { type ProjectContext, ProjectError } from "../types/project.ts";
import { loadConfig } from "./config.ts";
import {
	detectFormatter,
	detectLinter,
	detectPackageManager,
	detectTypechecker,
} from "./detect.ts";

function isPackageDir(dir: string): boolean {
	return (
		existsSync(join(dir, "package.json")) ||
		existsSync(join(dir, "Cargo.toml")) ||
		existsSync(join(dir, "Makefile")) ||
		existsSync(join(dir, "justfile"))
	);
}

function findGitRoot(start: string): string {
	let cur = start;
	while (true) {
		if (existsSync(join(cur, ".git"))) return cur;
		const parent = dirname(cur);
		if (parent === cur) return start;
		cur = parent;
	}
}

function readPackageName(dir: string): string {
	const p = join(dir, "package.json");
	if (existsSync(p)) {
		try {
			const j = JSON.parse(readFileSync(p, "utf8")) as { name?: string };
			if (j.name) return j.name;
		} catch {
			// ignore
		}
	}
	const cargo = join(dir, "Cargo.toml");
	if (existsSync(cargo)) {
		const match = /^\s*name\s*=\s*"([^"]+)"/m.exec(readFileSync(cargo, "utf8"));
		if (match?.[1]) return match[1];
	}
	return basename(dir);
}

function collectPackages(root: string, out: string[] = [], depth = 0): string[] {
	if (depth > 4) return out;
	if (isPackageDir(root) && root !== findGitRoot(root)) {
		// root itself handled separately
	}
	try {
		for (const entry of readdirSync(root, { withFileTypes: true })) {
			if (!entry.isDirectory()) continue;
			if (entry.name === "node_modules" || entry.name === "target" || entry.name === ".git")
				continue;
			const full = join(root, entry.name);
			if (isPackageDir(full)) out.push(full);
			collectPackages(full, out, depth + 1);
		}
	} catch {
		// ignore
	}
	return out;
}

export function resolveProject(startDir: string, opts?: { filter?: string }): ProjectContext {
	const root = findGitRoot(startDir);

	// nearest package walking up
	let packageDir = startDir;
	while (true) {
		if (isPackageDir(packageDir)) break;
		const parent = dirname(packageDir);
		if (parent === packageDir) {
			packageDir = startDir;
			break;
		}
		packageDir = parent;
		if (packageDir === "/" || packageDir === root) {
			if (!isPackageDir(packageDir)) {
				// keep going to fs root
			}
		}
	}
	// ensure found
	if (!isPackageDir(packageDir)) {
		// walk all the way up
		let cur = startDir;
		while (true) {
			if (isPackageDir(cur)) {
				packageDir = cur;
				break;
			}
			const parent = dirname(cur);
			if (parent === cur) break;
			cur = parent;
		}
	}

	if (opts?.filter) {
		const candidates = collectPackages(root);
		// include root if package
		if (isPackageDir(root)) candidates.unshift(root);
		const matches = candidates.filter((d) => {
			const name = basename(d);
			const pkgName = readPackageName(d);
			return name === opts.filter || pkgName === opts.filter;
		});
		if (matches.length === 0) {
			throw new ProjectError(
				"filter_no_match",
				`no package matches filter ${opts.filter}`,
				candidates,
			);
		}
		if (matches.length > 1) {
			throw new ProjectError(
				"ambiguous",
				`multiple packages match filter ${opts.filter}`,
				matches,
			);
		}
		const only = matches[0];
		if (!only) {
			throw new ProjectError(
				"filter_no_match",
				`no package matches filter ${opts.filter}`,
				candidates,
			);
		}
		packageDir = only;
	}

	if (!isPackageDir(packageDir)) {
		throw new ProjectError("not_found", "no project found", []);
	}

	const warnings: string[] = [];

	function attempt<T>(fn: (dir: string) => T | null): T | undefined {
		try {
			return fn(packageDir) ?? undefined;
		} catch (error) {
			// Ambiguous detection is a warning, never a hard stop: a jyz.config.toml value or the
			// default can still settle the key, and a repo may legitimately carry two signals
			// (biome.json for linting plus bunfig [fmt] for formatting).
			warnings.push(error instanceof Error ? error.message : String(error));
			return undefined;
		}
	}

	const detected = {
		package_manager: attempt(detectPackageManager),
		typechecker: attempt(detectTypechecker),
		linter: attempt(detectLinter),
		formatter: attempt(detectFormatter),
	};

	const config = loadConfig(packageDir, { detected });

	return {
		root,
		packageDir,
		packageName: readPackageName(packageDir),
		config,
		warnings: config.warnings,
	};
}

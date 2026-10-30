import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ProjectError } from "../types/project.ts";

function exists(dir: string, name: string): boolean {
	return existsSync(join(dir, name));
}

function readText(dir: string, name: string): string {
	return readFileSync(join(dir, name), "utf8");
}

function readPackageJson(
	dir: string,
): { packageManager?: string; name?: string; prettier?: unknown } | null {
	const p = join(dir, "package.json");
	if (!existsSync(p)) return null;
	try {
		return JSON.parse(readFileSync(p, "utf8")) as {
			packageManager?: string;
			name?: string;
			prettier?: unknown;
		};
	} catch {
		return null;
	}
}

export function detectPackageManager(dir: string): "bun" | "pnpm" | null {
	const bunLock = exists(dir, "bun.lock") || exists(dir, "bun.lockb");
	const pnpmLock = exists(dir, "pnpm-lock.yaml");
	if (bunLock && pnpmLock) {
		throw new ProjectError("ambiguous", "conflicting package manager lockfiles", [
			"bun.lock",
			"pnpm-lock.yaml",
		]);
	}
	if (bunLock) return "bun";
	if (pnpmLock) return "pnpm";
	const pkg = readPackageJson(dir);
	if (pkg?.packageManager) {
		const name = pkg.packageManager.split("@")[0];
		if (name === "bun" || name === "pnpm") return name;
	}
	return null;
}

function hasBunfigSection(dir: string, section: string): boolean {
	if (!exists(dir, "bunfig.toml")) return false;
	const text = readText(dir, "bunfig.toml");
	return new RegExp(`^\\s*\\[${section}\\]`, "m").test(text);
}

function eslintConfigs(dir: string): string[] {
	const out: string[] = [];
	if (exists(dir, "biome.json")) return out;
	try {
		const entries = (globalThis as { Deno?: unknown }).Deno ? [] : [];
		void entries;
	} catch {
		// ignore
	}
	for (const name of readdirSync(dir)) {
		if (
			name === "eslint.config.js" ||
			name === "eslint.config.mjs" ||
			name === "eslint.config.cjs" ||
			name === "eslint.config.ts"
		) {
			out.push(name);
		}
		if (name.startsWith(".eslintrc")) {
			out.push(name);
		}
	}
	return out;
}

function prettierConfigs(dir: string): string[] {
	const out: string[] = [];
	const candidates = [
		".prettierrc",
		".prettierrc.json",
		".prettierrc.yml",
		".prettierrc.yaml",
		".prettierrc.js",
		".prettierrc.cjs",
		".prettierrc.mjs",
		".prettierrc.toml",
		"prettier.config.js",
		"prettier.config.cjs",
		"prettier.config.mjs",
		"prettier.config.ts",
	];
	for (const c of candidates) if (exists(dir, c)) out.push(c);
	const pkg = readPackageJson(dir);
	if (pkg && (pkg as { prettier?: unknown }).prettier) out.push("package.json#prettier");
	return out;
}

export function detectTypechecker(
	dir: string,
): "bun-check" | "tsc" | "tsgo" | "tsrs" | "cargo" | "clang" | "none" | null {
	if (exists(dir, "Cargo.toml")) return "cargo";
	if (existsSync(join(dir, "node_modules", ".bin", "tsgo"))) return "tsgo";
	if (existsSync(join(dir, "node_modules", ".bin", "tsrs"))) return "tsrs";
	if (exists(dir, "tsconfig.json")) return "tsc";
	if (exists(dir, "bunfig.toml")) return "bun-check";
	return null;
}

export function detectLinter(
	dir: string,
): "biome" | "eslint" | "bun-lint" | "cargo-clippy" | "clang-tidy" | "none" | null {
	const signals: string[] = [];
	if (exists(dir, "biome.json")) signals.push("biome.json");
	const eslint = eslintConfigs(dir);
	for (const e of eslint) signals.push(e);
	if (hasBunfigSection(dir, "lint")) signals.push("bunfig.toml#[lint]");
	if (exists(dir, ".clang-tidy")) signals.push(".clang-tidy");
	if (exists(dir, "Cargo.toml")) signals.push("Cargo.toml");
	if (signals.length > 1) {
		throw new ProjectError("ambiguous", "conflicting linter signals", signals);
	}
	if (exists(dir, "biome.json")) return "biome";
	if (eslint.length > 0) return "eslint";
	if (hasBunfigSection(dir, "lint")) return "bun-lint";
	if (exists(dir, ".clang-tidy")) return "clang-tidy";
	if (exists(dir, "Cargo.toml")) return "cargo-clippy";
	return null;
}

export function detectFormatter(
	dir: string,
): "biome" | "bun-fmt" | "prettier" | "clang-format" | "rustfmt" | "none" | null {
	const signals: string[] = [];
	if (exists(dir, "biome.json")) signals.push("biome.json");
	if (hasBunfigSection(dir, "fmt")) signals.push("bunfig.toml#[fmt]");
	const prettier = prettierConfigs(dir);
	for (const p of prettier) signals.push(p);
	if (exists(dir, ".clang-format")) signals.push(".clang-format");
	if (exists(dir, "rustfmt.toml") || exists(dir, "Cargo.toml"))
		signals.push(exists(dir, "rustfmt.toml") ? "rustfmt.toml" : "Cargo.toml");
	if (signals.length > 1) {
		throw new ProjectError("ambiguous", "conflicting formatter signals", signals);
	}
	if (exists(dir, "biome.json")) return "biome";
	if (hasBunfigSection(dir, "fmt")) return "bun-fmt";
	if (prettier.length > 0) return "prettier";
	if (exists(dir, ".clang-format")) return "clang-format";
	if (exists(dir, "rustfmt.toml") || exists(dir, "Cargo.toml")) return "rustfmt";
	return null;
}

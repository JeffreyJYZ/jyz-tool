import type { GitMode, Template } from "../types/create.ts";

/** Version stamped into a generated manifest; independent of jyz's own version. */
export const DEFAULT_PROJECT_VERSION = "0.1.0";

/** Ranges declared when the engine has to add a formatter, linter or typechecker dependency. */
export const TOOL_VERSIONS: Record<string, string> = {
	"@biomejs/biome": "^2.6.4",
	eslint: "^9.30.0",
	prettier: "^3.6.2",
	"typescript-eslint": "^8.40.0",
};

/** Toolchain versions a publishable manifest pins. */
export const PACKAGE_MANAGER_VERSIONS: Record<string, string> = {
	bun: "1.4.4",
	pnpm: "10.15.0",
};

export interface TemplateProfile {
	/** Directory under `packages/core/templates/`. */
	dir: string;
	/** Placeholder values used when the matching flag is absent. */
	packageManager: string;
	typechecker: string;
	linter: string;
	formatter: string;
	/** Template ships a JS manifest, so tooling files, scripts and deps are generated. */
	js: boolean;
	docs: boolean;
	git: GitMode;
}

const jsTemplate = (dir: string): TemplateProfile => ({
	dir,
	packageManager: "bun",
	typechecker: "bun-check",
	linter: "biome",
	formatter: "biome",
	js: true,
	docs: false,
	git: "init",
});

const rustTemplate = (dir: string): TemplateProfile => ({
	dir,
	packageManager: "cargo",
	typechecker: "cargo",
	linter: "cargo-clippy",
	formatter: "rustfmt",
	js: false,
	docs: false,
	git: "init",
});

const cTemplate = (dir: string): TemplateProfile => ({
	dir,
	packageManager: "none",
	typechecker: "clang",
	linter: "clang-tidy",
	formatter: "clang-format",
	js: false,
	docs: false,
	git: "init",
});

export const TEMPLATE_PROFILES: Record<Template, TemplateProfile> = {
	next: jsTemplate("next"),
	"vite-tauri": jsTemplate("vite-tauri"),
	cli: jsTemplate("cli"),
	"rust-bin": rustTemplate("cargo-bin"),
	"rust-lib": rustTemplate("cargo-lib"),
	c: cTemplate("c"),
	monorepo: jsTemplate("monorepo"),
};

export const PACKAGE_MANAGER_VALUES = ["bun", "pnpm"] as const;
export type PackageManager = (typeof PACKAGE_MANAGER_VALUES)[number];

export const TYPECHECKER_VALUES = [
	"bun-check",
	"tsc",
	"tsgo",
	"tsrs",
	"cargo",
	"clang",
	"none",
] as const;
export type Typechecker = (typeof TYPECHECKER_VALUES)[number];

export const LINTER_VALUES = [
	"biome",
	"eslint",
	"bun-lint",
	"cargo-clippy",
	"clang-tidy",
	"none",
] as const;
export type Linter = (typeof LINTER_VALUES)[number];

export const FORMATTER_VALUES = [
	"biome",
	"bun-fmt",
	"prettier",
	"clang-format",
	"rustfmt",
	"none",
] as const;
export type Formatter = (typeof FORMATTER_VALUES)[number];

export type Source = "flag" | "env" | "config" | "detected" | "default";

export interface JyzConfig {
	project: {
		package_manager: "auto" | PackageManager;
		typechecker: "auto" | Typechecker;
		linter: Linter;
		formatter: Formatter;
	};
	aliases: Record<string, string>;
	scripts: Record<string, string>;
	create: {
		default_template: string;
		default_package_manager: PackageManager;
		git: "skip" | "init" | "commit" | "github";
	};
	monorepo: { default_filter: boolean };
}

export interface Resolved<T> {
	value: T;
	source: Source;
}

export interface ResolvedConfig {
	project: {
		package_manager: Resolved<PackageManager>;
		typechecker: Resolved<Typechecker>;
		linter: Resolved<Linter>;
		formatter: Resolved<Formatter>;
	};
	aliases: Record<string, string>;
	scripts: Record<string, string>;
	create: JyzConfig["create"];
	monorepo: JyzConfig["monorepo"];
	path: string | null;
	layers: string[];
	warnings: string[];
}

/**
 * One config file as written: every key optional at every level, so a reader cannot mistake an
 * absent key for a defaulted one.
 */
export type ConfigFile = {
	project?: Partial<JyzConfig["project"]>;
	aliases?: Record<string, string>;
	scripts?: Record<string, string>;
	create?: Partial<JyzConfig["create"]>;
	monorepo?: Partial<JyzConfig["monorepo"]>;
};

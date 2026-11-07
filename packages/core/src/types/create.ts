import type { Formatter, Linter, PackageManager, Typechecker } from "./config.ts";

/** Templates `jyz create --template` accepts, in the order the help lists them. */
export const TEMPLATES = [
	"next",
	"vite-tauri",
	"cli",
	"rust-bin",
	"rust-lib",
	"c",
	"monorepo",
	"rune-native",
] as const;

export type Template = (typeof TEMPLATES)[number];

/** Git modes `jyz create --git` accepts. */
export type GitMode = "skip" | "init" | "commit" | "github";

export interface CreateOptions {
	name: string;
	dir?: string;
	template: Template;
	packageManager?: PackageManager;
	typechecker?: Typechecker;
	linter?: Linter;
	formatter?: Formatter;
	docs?: boolean;
	git?: GitMode;
	install?: boolean;
	publishable?: boolean;
	yes?: boolean;
	features?: string[];
}

export interface CreateResult {
	/** Absolute path of the directory the template was rendered into. */
	dir: string;
	/** Written files, relative to `dir`, with `/` separators on every platform. */
	files: string[];
	warnings: string[];
	/** Features applied during creation. */
	features: string[];
	applied: string[];
	appliedFeatures: string[];
}

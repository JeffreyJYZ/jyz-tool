import type { Formatter, Linter, PackageManager, Typechecker } from "./config.ts";

/** Templates `jyz create --template` accepts. */
export type Template = "next" | "vite-tauri" | "cli" | "rust-bin" | "rust-lib" | "c" | "monorepo";

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
}

export interface CreateResult {
	/** Absolute path of the directory the template was rendered into. */
	dir: string;
	/** Written files, relative to `dir`, with `/` separators on every platform. */
	files: string[];
	warnings: string[];
}

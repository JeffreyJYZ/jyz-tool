## Task 5 — core create engine and templates

Wave A. Model tier: hard.

Owns: `packages/core/src/types/create.ts`, `packages/core/src/create/**`, `packages/core/templates/**`, `packages/core/test/create.test.ts`.

`types/create.ts`:

```ts
export type Template = "next" | "vite-tauri" | "cli" | "rust-bin" | "rust-lib" | "c" | "monorepo";
export interface CreateOptions {
	name: string;
	dir?: string;
	template: Template;
	packageManager?: PackageManager;
	typechecker?: Typechecker;
	linter?: Linter;
	formatter?: Formatter;
	docs?: boolean;
	git?: "skip" | "init" | "commit" | "github";
	install?: boolean;
	publishable?: boolean;
	yes?: boolean;
}
export interface CreateResult {
	dir: string;
	files: string[];
	warnings: string[];
}
```

`src/create/index.ts` exports `createProject(opts: CreateOptions, cwd: string): Promise<CreateResult>`: renders the template directory `packages/core/templates/<template>/` into the target dir, substituting `__NAME__`, `__PACKAGE_MANAGER__`, `__TYPECHECKER__`, `__LINTER__`, `__FORMATTER__` and `__VERSION__`, skipping `docs/` unless `opts.docs`, writing `AGENTS.md` from the template, and returning the written paths. `--yes` fills unspecified options from defaults; a missing required value throws `CreateError` listing the missing flag instead of prompting. An incompatible pair (`linter` `bun-lint` with a formatter other than `bun-fmt`) throws before writing anything. Existing non-empty target dir throws.

Templates to ship in this task: `cli`, `next`, `cargo-bin`, plus `c` and `monorepo` layouts as directories. Each template carries its own `AGENTS.md` with that project's real commands. No external scaffolder, no network.

Tests: `cli` template renders into a temp dir with substituted name, package manager and version; `docs/` skipped unless requested; `--yes` fills defaults; missing template throws; existing dir throws; substituted values appear in `package.json` and `AGENTS.md`.

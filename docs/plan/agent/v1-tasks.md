---
updated: 202610301530
version: 1.0
---

# jyz v1 implementation tasks

Derived from [main.md](main.md) (M1–M4) and the feature files beside it. Every task below runs in the same wave: each owns a disjoint set of paths, so all seven proceed in parallel without touching each other's files. `packages/core/src/index.ts` is controller-owned and never edited by a task; the controller also performs the integration pass (exports, cross-module imports, full gates) after all tasks report.

While a task runs, sibling modules named in this plan may not exist yet. Write against the contract in your own task, verify with your own test file only (`bun test packages/<pkg>/test/<your-file>.test.ts`), and do not run whole-project typecheck as a failure signal: the controller runs the full gates once the wave lands. If a sibling module is missing at your last step, leave your code compiling against the documented signature rather than inlining a substitute.

## Global Constraints

- Bun only, never npm. TypeScript with `.ts` import specifiers, tabs at 4 wide, `printWidth` 100.
- Tests use `bun:test`, live in `packages/*/test/`, and must pass with `bun test`.
- Gates before reporting: `bun run typecheck`, `bun run lint`, `bun run format:check`, `bun test`.
- No git commands, no commits, no version bumps: the controller commits.
- Never edit `package.json`, `tsconfig.json`, `biome.json`, `bunfig.toml`, `.github/**`, `docs/**`, or another task's paths.
- Never spawn subagents.
- Every public symbol a task adds is exported from its own module file; the controller re-exports from `packages/core/src/index.ts`.
- Do as much as possible in one turn: batch independent calls, chain dependent steps, never yield between them.
- `rg` never `grep`; `fd` never `find`. Write the deliverable to disk as you go, not at the end.

## Task 1 — core config: types, defaults, load, write

Wave A. Model tier: hard.

Owns: `packages/core/src/types/config.ts`, `packages/core/src/const/defaults.ts`, `packages/core/src/funcs/config.ts`, `packages/core/test/config.test.ts`.

Dependency available: `smol-toml` (already installed in `packages/core`).

Exports from `types/config.ts`:

```ts
export type PackageManager = "bun" | "pnpm";
export type Typechecker = "bun-check" | "tsc" | "tsgo" | "tsrs" | "cargo" | "clang" | "none";
export type Linter = "biome" | "eslint" | "bun-lint" | "cargo-clippy" | "clang-tidy" | "none";
export type Formatter = "biome" | "bun-fmt" | "prettier" | "clang-format" | "rustfmt" | "none";
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
```

Exports from `const/defaults.ts`: `CONFIG_FILENAME = "jyz.config.toml"` and `DEFAULT_CONFIG: JyzConfig` (package_manager `"auto"`, typechecker `"auto"`, linter `"biome"`, formatter `"biome"`, empty aliases and scripts, create defaults from the plan's `config.md`, `monorepo.default_filter` false).

Exports from `funcs/config.ts`:

- `findConfigPath(startDir: string): string | null` walks up to the filesystem root and returns the first `jyz.config.toml`.
- `readConfigFile(path: string): { config: Partial<JyzConfig>; warnings: string[] }` parses with `smol-toml`; unknown keys produce a warning naming the dotted key; a malformed file throws `ConfigError`.
- `loadConfig(startDir: string, opts?: { flags?: Partial<Pick<JyzConfig["project"], "package_manager" | "typechecker" | "linter" | "formatter">>; detected?: { package_manager?: PackageManager; typechecker?: Typechecker; linter?: Linter; formatter?: Formatter } }): ResolvedConfig` applies precedence flag > env (`JYZ_PACKAGE_MANAGER`, `JYZ_TYPECHECKER`, `JYZ_LINTER`, `JYZ_FORMATTER`) > nearest config > `opts.detected` > defaults, recording the source of each of the four values, and resolving `"auto"` through detected or default so the returned values are never `"auto"`.
- `writeConfigValue(path: string, dottedKey: string, rawValue: string): { text: string }` returns the rewritten file text without writing it. It is line-based: it replaces the value of an existing key in place, preserving every comment, blank line and ordering; when the key is absent it appends it under its section header, creating the section at the end of the file if needed. It throws `ConfigWriteError` when the key cannot be located unambiguously (for example the key appears more than once) or when the file cannot round-trip.
- `class ConfigError extends Error` and `class ConfigWriteError extends Error` with a `path` field.

Tests: precedence per layer; `"auto"` resolution; unknown-key warning; malformed TOML error; comment-preserving write byte-for-byte on a fixture; append to an existing section; create a missing section; duplicate-key refusal.

## Task 2 — core detection and project resolution

Wave A. Model tier: easy.

Owns: `packages/core/src/types/project.ts`, `packages/core/src/funcs/detect.ts`, `packages/core/src/funcs/project.ts`, `packages/core/test/detect.test.ts`, `packages/core/test/project.test.ts`.

`types/project.ts` exports `ProjectContext` (`root`, `packageDir`, `packageName`, `config: ResolvedConfig`, `warnings: string[]`) and `class ProjectError extends Error` with `code: "not_found" | "ambiguous" | "filter_no_match"` and `candidates: string[]`.

`funcs/detect.ts` exports `detectPackageManager`, `detectTypechecker`, `detectLinter`, `detectFormatter`, each `(dir: string) => T | null`, implementing the signal tables in [config.md](config.md): lockfiles for the package manager, `tsconfig.json` / `bunfig.toml` / `node_modules/.bin` presence for checkers, `biome.json` / `eslint.config.*` / `.eslintrc*` for linters, `biome.json` / `[fmt]` in `bunfig.toml` / Prettier config for formatters, plus `.clang-format`, `.clang-tidy`, `rustfmt.toml`, `Cargo.toml`. Two conflicting signals of the same kind must raise `ProjectError` with code `"ambiguous"` naming both files.

`funcs/project.ts` exports `resolveProject(startDir: string, opts?: { filter?: string }): ProjectContext`: walk up to the git root (or filesystem root), find the acting package (nearest dir with `package.json`, `Cargo.toml`, or `Makefile`/`justfile`), apply `-F` matching on package directory name or `package.json` name, call `loadConfig` with the detected values, and return the context. Zero or several filter matches raise `ProjectError` listing candidates.

Tests: bun-only and pnpm-only trees, conflicting lockfiles, monorepo filter by dir name and by package name, no-match filter, `src/` layout, C and Rust project roots.

## Task 3 — core command building and execution

Wave A. Model tier: easy.

Owns: `packages/core/src/types/command.ts`, `packages/core/src/funcs/argv.ts`, `packages/core/src/funcs/exec.ts`, `packages/core/test/argv.test.ts`, `packages/core/test/exec.test.ts`.

`types/command.ts` exports `Verb` (`install`, `add`, `remove`, `run`, `exec`, `update`, `outdated`), `ArgvRequest` (`verb`, `args`, `dev?`, `latest?`) and `CommandSpec` (`file`, `argv`, `cwd`).

`funcs/argv.ts` exports `buildArgv(pm: PackageManager, req: ArgvRequest): string[]` producing exactly the argv in [dispatch.md](dispatch.md):

- `install` → `["install", ...args]`
- `add` → `["add", ...(dev ? [pm === "bun" ? "-d" : "-D"] : []), ...args]`
- `remove` → `["remove", ...args]`
- `run` → `["run", ...args]`
- `exec` → bun `["bunx", ...args]`, pnpm `["exec", ...args]`
- `update` → `["update", ...(latest ? ["--latest"] : []), ...args]`
- `outdated` → `["outdated", ...args]`

`funcs/exec.ts` exports `resolveExecutable(pm: PackageManager, dir: string, bin: string): string` (walk up for `node_modules/.bin/<bin>`, else the package manager's runner) and `runCommand(spec: CommandSpec, opts?: { stdio?: "inherit" | "pipe"; signal?: AbortSignal }): Promise<{ exitCode: number; stdout: string; stderr: string }>` which spawns without a shell, inherits stdio by default, mirrors the child's exit code, forwards `SIGINT`/`SIGTERM`, and returns empty strings for captured streams when stdio is inherit.

Tests: exact argv per verb per package manager; dev flag per manager; `--latest` forwarding; `.bin` hit preferred over runner; runner used when absent; a child that exits 3 returns `exitCode` 3; a pipe-mode child captures stdout.

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

## Task 4 — CLI surface

Wave A. Model tier: easy.

Owns: `packages/cli/src/bin.ts`, `packages/cli/src/commands/config.ts`, `packages/cli/src/commands/dispatch.ts`, `packages/cli/src/commands/create.ts`, `packages/cli/src/lib/**`, `packages/cli/test/**`, `scripts/bump-alpha.ts`. It imports `registerToolchain(cli)` from `packages/cli/src/commands/toolchain.ts`, which Task 6 owns: never create or edit that file.

Builds the whole surface with `cac`, one module per verb group under `packages/cli/src/commands/`, help text per verb, and `--verbose` printing the resolved command. Commands: `config show|get|set|path|check`, `install`, `add`, `remove`, `run`, `exec`, `update`, `outdated`, `create`, `lint`, `typecheck`, `check`, `fmt`, plus user aliases and the bare-script fallback from [dispatch.md](dispatch.md). Unknown verb that matches a script runs it; otherwise print help and exit 1. Aliases that shadow a core verb fail validation naming the alias.

`scripts/bump-alpha.ts` increments the alpha suffix of every manifest (`package.json`, `packages/{core,cli,desktop}/package.json`, `packages/desktop/src-tauri/tauri.conf.json`, `packages/desktop/src-tauri/Cargo.toml`), prints the new version, and with `--tag` creates `v<version>`. It never pushes.

Tests: each command builds the expected `CommandSpec` against a temp fixture project (call the pure builder, not the CLI binary); alias expansion; shadowed-alias refusal; unknown verb behaviour; bump script updates all six files and increments `alpha.N` to `alpha.N+1`.

## Task 6 — core toolchain verbs and CLI wiring

Wave A. Model tier: easy.

Owns: `packages/core/src/funcs/toolchain.ts`, `packages/core/test/toolchain.test.ts`, `packages/cli/src/commands/toolchain.ts`.

`packages/cli/src/commands/toolchain.ts` exports `registerToolchain(cli: CAC): void`, registering `lint`, `typecheck`, `check` and `fmt` against the core builders. Nothing else in the CLI tree belongs to this task.

`funcs/toolchain.ts` exports `buildLintCommand(ctx: ProjectContext, args?: string[]): CommandSpec`, `buildTypecheckCommand(...)`, `buildCheckCommand(...)` (returns an array of `CommandSpec` for the applicable halves), and `buildFmtCommand(ctx, { check }: { check?: boolean })`, following [toolchain.md](toolchain.md). A configured tool whose binary does not resolve throws `ToolchainError` naming the tool and config key; a project with nothing configured exits with a `ToolchainError` naming what was looked for.

Tests: one per checker and linter; `none` skipping a half; `check` returning both halves and skipping `none`; `fmt --check` read-only form; missing-binary error message contains the config key.

## Task 7 — desktop wiring and release docs

Wave A. Model tier: easy.

Owns: `packages/desktop/src/**`, `packages/desktop/README.md`.

Adds the desktop placeholder for the CLI bridge: a `packages/desktop/src/rpc.ts` module documenting and stubbing the stdio JSON-RPC client shape used at v2, with unit tests for message framing only. No Tauri commands are registered in v1; the window stays a shell.

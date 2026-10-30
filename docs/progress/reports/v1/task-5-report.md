# Task 5 report — core create engine and templates

Status: complete. `bun test packages/core/test/create.test.ts` → 14 pass, 0 fail, 66 assertions.

## Files

Engine:

- `packages/core/src/types/create.ts` — `Template`, `GitMode`, `CreateOptions`, `CreateResult` exactly as the brief specifies, toolchain unions imported type-only from `../types/config.ts`.
- `packages/core/src/create/errors.ts` — `CreateError`.
- `packages/core/src/create/defaults.ts` — `DEFAULT_PROJECT_VERSION` (`0.1.0`), `TOOL_VERSIONS`, `PACKAGE_MANAGER_VERSIONS`, and `TEMPLATE_PROFILES` (template to directory, per-family placeholder defaults, `js` flag, docs/git defaults).
- `packages/core/src/create/template.ts` — template root resolution, recursive collection (skips `docs/` unless asked, always skips `node_modules`, `.git`, `dist`, `target`, `.next`), placeholder substitution, binary passthrough, `.tmpl` suffix stripping.
- `packages/core/src/create/tooling.ts` — resolves `biome.json`, `bunfig.toml`, `.prettierrc` + `.prettierignore`, `eslint.config.js`, `jyz.config.toml`, the matching `format`/`lint`/`typecheck` scripts and the dev dependencies, from the resolved formatter, linter and typechecker.
- `packages/core/src/create/index.ts` — `createProject(opts, cwd)`, validation, target checks, manifest finalisation (`--publishable`).

Templates (`packages/core/templates/`): `cli`, `next`, `cargo-bin`, `c`, `monorepo`, each with its own `AGENTS.md`, `.gitignore`, source split and `docs/` scaffold. `rust-bin` maps to `cargo-bin`; `rust-lib` maps to `cargo-lib` and correctly throws "not available" until that directory ships. `vite-tauri` likewise throws.

Tests: `packages/core/test/create.test.ts` — render + substitution, explicit toolchain, docs skip/include, `--yes` defaults, missing/unknown/unavailable template, non-empty target, incompatible pair, rust-bin mapping, C Makefile tabs + justfile, monorepo member naming, publishable fields, publishable warning on a non-JS template.

## Decisions

- **`.tmpl` suffix on template files a repo tool would read as source** (`.ts`, `.tsx`, `.md`). Biome 2.6 formats Markdown and rewrites `__NAME__` to `**NAME**` on the first `biome check --write`, and the root tsconfig would typecheck template TS whose dependencies are not installed here. The engine strips the suffix on write, so generated trees are normal. This is documented in `template.ts`; nothing else in the repo needs to know.
- **`__VERSION__` is the generated project's version (`0.1.0`)**, not jyz's own version. jyz's version does not appear in generated files.
- **Toolchain is resolved once and written to `jyz.config.toml`**, with package.json `format`/`lint`/`typecheck` scripts matching the resolved tools. Templates therefore ship no formatter or linter config of their own, and a non-default choice cannot leave a stale `biome.json` behind.
- **`--yes` is not a separate path**: every option except `name` and `template` has a per-template default, so the engine never blocks on a missing flag other than those two. `yes` is accepted and recorded for the CLI to use when it decides whether to prompt.
- **The engine runs no git command, no package manager and no network.** `git` and `install` are validated/passed through for the CLI task; `--publishable` only rewrites manifest fields.
- **`--publishable` on a non-JS template returns a warning** rather than silently doing nothing.
- **`docs` defaults to false per template profile**, matching "skipping `docs/` unless `opts.docs`".

## Verification

- `bun test packages/core/test/create.test.ts` — 14 pass, 0 fail.
- End-to-end render into a temp dir: `bun src/bin.ts --version` prints `acme 0.1.0`; `make -n build` in the C output prints the tab-indented compile recipe; `next`, `monorepo` and `--publishable` manifests inspected by hand.
- `bunx biome check packages/core/src/create packages/core/src/types/create.ts packages/core/test/create.test.ts packages/core/templates` — no fixes, no errors.
- `bun run typecheck` — zero errors in Task 5 paths. Remaining errors (15) are in sibling-owned files: `packages/cli/src/commands/config.ts`, `packages/cli/src/commands/toolchain.ts`, `packages/cli/src/lib/dispatch.ts`, `packages/core/src/funcs/project.ts`, `packages/core/test/project.test.ts`.
- Root `bun test` — 79 pass, 1 fail ("rust root" in `packages/core/test/project.test.ts`, sibling-owned).
- `bun fmt --check` lists no Task 5 file; it lists 17 sibling files that need formatting.

## Concerns for the integrator

1. `packages/core/src/index.ts` is not mine and does not export `createProject` or the create types yet; the CLI task needs that export.
2. `TOOL_VERSIONS` in `create/defaults.ts` is a deliberate stack snapshot (`@biomejs/biome ^2.6.4`, `eslint ^9.30.0`, `prettier ^3.6.2`, `typescript-eslint ^8.40.0`, `bun 1.4.4`, `pnpm 10.15.0`). It was not checked against the registry (no network this task); re-verify on the next dependency sweep.
3. The engine writes `jyz.config.toml` for JS templates only. Rust and C templates have no jyz config; if jyz is meant to manage those directories, that file needs a schema decision (`package_manager` has no `cargo`/`none` member in `types/config.ts`).
4. `template.ts` uses Bun-independent node APIs throughout (`node:fs/promises`, `node:path`, `node:url`), so it stays portable, but the `.tmpl` convention is new to this repo and worth a line in the plan's create doc when the docs are next touched.
5. The engine ignores `git` and `install` by design; the CLI task must implement all four git modes and name the failing step, per `create.md`.

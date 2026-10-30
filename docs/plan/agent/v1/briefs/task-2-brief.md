## Task 2 — core detection and project resolution

Wave A. Model tier: easy.

Owns: `packages/core/src/types/project.ts`, `packages/core/src/funcs/detect.ts`, `packages/core/src/funcs/project.ts`, `packages/core/test/detect.test.ts`, `packages/core/test/project.test.ts`.

`types/project.ts` exports `ProjectContext` (`root`, `packageDir`, `packageName`, `config: ResolvedConfig`, `warnings: string[]`) and `class ProjectError extends Error` with `code: "not_found" | "ambiguous" | "filter_no_match"` and `candidates: string[]`.

`funcs/detect.ts` exports `detectPackageManager`, `detectTypechecker`, `detectLinter`, `detectFormatter`, each `(dir: string) => T | null`, implementing the signal tables in [config.md](config.md): lockfiles for the package manager, `tsconfig.json` / `bunfig.toml` / `node_modules/.bin` presence for checkers, `biome.json` / `eslint.config.*` / `.eslintrc*` for linters, `biome.json` / `[fmt]` in `bunfig.toml` / Prettier config for formatters, plus `.clang-format`, `.clang-tidy`, `rustfmt.toml`, `Cargo.toml`. Two conflicting signals of the same kind must raise `ProjectError` with code `"ambiguous"` naming both files.

`funcs/project.ts` exports `resolveProject(startDir: string, opts?: { filter?: string }): ProjectContext`: walk up to the git root (or filesystem root), find the acting package (nearest dir with `package.json`, `Cargo.toml`, or `Makefile`/`justfile`), apply `-F` matching on package directory name or `package.json` name, call `loadConfig` with the detected values, and return the context. Zero or several filter matches raise `ProjectError` listing candidates.

Tests: bun-only and pnpm-only trees, conflicting lockfiles, monorepo filter by dir name and by package name, no-match filter, `src/` layout, C and Rust project roots.

# jyz

## Where things are

- Plan of record: `docs/plan/agent/main.md` — overview, decisions, milestones, feature index. One file per feature sits beside it.
- Work logs to `docs/progress/log/`, decisions and gotchas to `docs/progress/notes/`.
- `docs/progress/reports/` holds subagent reports verbatim, one report per milestone, and one per released version.
- No source yet. `packages/core` and `packages/cli` arrive at M0; until then this repo is docs only.

## Status

- Planning finished 2026-10-30, plan version 1.2.
- Scaffold landed 2026-10-30 at `0.1.0-alpha.1`: bun workspace, cac CLI shell, Tauri desktop shell. No capability is implemented; `jyz` only answers `--version` and `--help`.
- M0 gate: `bun run typecheck`, `bun run lint`, `bun run format:check`, `bun run jyz --version` green on macOS, Linux and Windows.

## Identity

- Owner and copyright holder: Yizhou Jiang. GitHub handle `JeffreyJYZ`, email `yizhoujiang11@gmail.com`.
- Use that name in `LICENSE`, `NOTICE`, `package.json` author and any legal text; never invent a variant.

## Decisions not to relitigate

- TypeScript on Bun. One `packages/core` behind thin adapters, so CLI, desktop and MCP cannot drift.
- `jyz.config.toml` holds jyz settings only. Native configs are never ingested or generated outside `jyz create`.
- jyz delegates to the installed package manager and never resolves dependencies itself.
- No `publish` verb.
- `jyz check` aggregates `lint` and `typecheck`; each also runs alone.
- Tabs at 4 wide, `printWidth` 100. Formatter is `biome`, `bun fmt`, `prettier`, `clang-format` or `rustfmt`, picked per project in `jyz.config.toml`.
- Linter is `biome`, `eslint`, `bun lint`, `cargo clippy`, `clang-tidy` or none, picked per project. One tool owns each job, never two.
- The CLI is built with `cac`, a cli-making tool: `cac("jyz")` gives the command, option, alias, version and help API, so argv parsing is never hand-rolled. Version 7.x.

## House rules

- `rg` never `grep`; `fd` never `find`; `sd` never `sed`.
- Bun only, never npm. A writing formatter is never a gate: verify with `bun fmt --check` and `biome check`.
- Never measure a gate by prose. A milestone ends when its named command fails loudly.

## Commands

- `bun run jyz` prints help; `bun run jyz --version` prints `jyz/<version> <os>-<arch> bun-v<ver>`.
- Gates: `bun run typecheck` (`bun check`), `bun run lint` (`biome check .`), `bun run format:check` (`bun fmt --check`), `bun run test`.
- Desktop: `cd packages/desktop && bunx tauri build`; needs Rust plus Xcode CLT on macOS.
- Release: `bun run scripts/release.ts --all --publish` builds `core-`, `cli-` and `desktop-` artefacts into `dist/release` and publishes them to the `v<version>` GitHub release; it is idempotent, `--clobber` on an existing tag.
- CI: `.github/workflows/ci.yml` gates every push; `.github/workflows/release.yml` runs on `v*` tags across macOS, Linux and Windows.

## Traps

- `bun fmt` formats Markdown at width 80 and reflows prose; `.prettierignore` excludes `docs/` and `local/` because `bun fmt` reads it.
- Never name a package script `fmt` or `check`: both shadow Bun builtins, so `bun fmt --check` would write and `bun check` would stop typechecking.
- Biome installed as 2.6.4, where `rules.recommended` is deprecated in favour of `rules.preset`; run `bunx biome migrate --write` after a bump.
- One version source: `packages/core/src/const/version.ts` imports `packages/core/package.json`, and the CLI reads it. Bump all four `package.json` files together or the release tag lies.
- The CLI bin is `packages/cli/src/bin.ts` with a bun shebang, so `bun link` gives a working `jyz` with no build step; compiled binaries come from `bun build --compile`.
- Tauri icons are generated from `packages/desktop/app-icon.svg` by `bun run --cwd packages/desktop icon`; never hand-edit the derived files, and never call `bunx tauri`, which resolves the wrong npm package.
- Tauri builds only on the matching OS, so desktop installers come from the CI matrix, never from one machine.

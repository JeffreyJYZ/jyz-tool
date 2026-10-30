# jyz

## Where things are

- Plan of record: `docs/plan/agent/main.md` — overview, decisions, milestones, feature index. One file per feature sits beside it.
- Work logs to `docs/progress/log/`, decisions and gotchas to `docs/progress/notes/`.
- `docs/progress/reports/` holds subagent reports verbatim, one report per milestone, and one per released version.
- No source yet. `packages/core` and `packages/cli` arrive at M0; until then this repo is docs only.

## Status

- Planning finished 2026-10-30, plan version 1.2. Nothing implemented.
- M0 is the first thing that can be called done: CI green on macOS, Linux and Windows for `bun install`, `bun check`, `biome check .`, `jyz --version`.

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

## House rules

- `rg` never `grep`; `fd` never `find`; `sd` never `sed`.
- Bun only, never npm. A writing formatter is never a gate: verify with `bun fmt --check` and `biome check`.
- Never measure a gate by prose. A milestone ends when its named command fails loudly.

# jyz

## Where things are

- Plan of record: `docs/plan/agent/main.md` — overview, decisions, milestones, feature index. One file per feature sits beside it.
- Task plans live at `docs/progress/subagent/tasks/<plan>.md`, with their briefs in `docs/progress/subagent/briefs/<plan>/` and their reports in `docs/progress/subagent/reports/<plan>/`.
- Ledgers and work logs go to `docs/progress/log/`, decisions and gotchas to `docs/progress/notes/`.
- `docs/progress/subagent/reports/` holds subagent reports verbatim, plus one per milestone and one per released version.
- Never write coordination artefacts to `.superpowers/` or any hidden scratch dir: everything lives under `docs/`.
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

- `jyz` is linked globally with `bun link` (`~/.bun/install/global/node_modules/jyz` → `packages/cli`), so call `jyz …` from anywhere and edits take effect with no reinstall; never spell out `bun packages/cli/src/bin.ts`.
- `bun run mcp` (or `bun packages/mcp/src/bin.ts`) runs the MCP server from the checkout; `--cwd <dir>` picks the project.
- `bun run jyz` prints help; `jyz --version` prints `jyz/<version> <os>-<arch> bun-v<ver>`.
- Gates: `bun run typecheck` (`bun check`), `bun run lint` (`biome check .`), `bun run format:check` (`bun fmt --check`), `bun run test`.
- Desktop: `bun run --cwd packages/desktop build`; it stages the CLI sidecar (`scripts/stage-sidecar.ts`, output `src-tauri/binaries/jyz-<triple>`, gitignored) then runs `tauri build`. Needs Rust plus Xcode CLT on macOS.
- Release: `bun run scripts/alpha-release.ts --push` runs the four gates, bumps every manifest, commits, tags and pushes; `--dry-run` shows the version without touching anything. `bun scripts/verify-release.ts` checks the published assets.
- Updates: the app checks `latest.json` on start and installs on a button press; bundles are signed with `~/.config/jyz/updater.key`, and `bun scripts/updater-manifest.ts` merges the per-platform partials and restamps the version before upload.
- Machine surfaces: `jyz capabilities [--json]` prints the capability manifest; `jyz serve` speaks JSON-RPC over stdio; `bun scripts/mcp-smoke.ts` walks initialize, tools, resources, watch and cancel against the real MCP server.
- Perf: `bun scripts/bench.ts --runs 5` prints p50/p95 for `--version`, `config path` and `run`.
- Desktop walkthrough: `bun scripts/ui-walkthrough.ts` serves `packages/desktop/ui` and drives all three screens in a real browser with the Tauri IPC stubbed; needs `agent-browser` on PATH and exits 2 without it.
- CI: `.github/workflows/ci.yml` gates every push; `.github/workflows/release.yml` runs on `v*` tags across macOS, Linux and Windows.

## Traps

- `bun fmt` does NOT wrap Markdown by default (`proseWrap` is `preserve`); `[[fmt.overrides]]` with `proseWrap = "never"` pins that for `**/*.md`. What it does change is table column alignment and `*emphasis*` style. `.prettierignore` now excludes only `local/`.
- Never hard-wrap markdown by hand even though the formatter allows it: one line per bullet, no soft wraps.
- Never name a package script `fmt` or `check`: both shadow Bun builtins, so `bun fmt --check` would write and `bun check` would stop typechecking.
- Biome installed as 2.6.4, where `rules.recommended` is deprecated in favour of `rules.preset`; run `bunx biome migrate --write` after a bump.
- One version source: `packages/core/src/const/version.ts` imports `packages/core/package.json`, and the CLI reads it. Bump all four `package.json` files together or the release tag lies.
- The CLI bin is `packages/cli/src/bin.ts` with a bun shebang, so `bun link` gives a working `jyz` with no build step; compiled binaries come from `bun build --compile`.
- Tauri icons are generated from `packages/desktop/app-icon.svg` by `bun run --cwd packages/desktop icon`; never hand-edit the derived files, and never call `bunx tauri`, which resolves the wrong npm package.
- Tauri builds only on the matching OS, so desktop installers come from the CI matrix, never from one machine.
- `.deb` rejects a hyphen in the version and `.msi` requires a numeric pre-release, so bundles are built with `--config '{"version":"0.1.0"}'` while the artefact names and the git tag keep `0.1.0-alpha.1`.
- The updater's `latest.json` inherits that `0.1.0` and `0.1.0` sorts _above_ every `0.1.0-alpha.N`, so `scripts/updater-manifest.ts` restamps its `version` from `package.json` after every bundle; without that step each installed alpha is offered an update to itself in a loop.
- Updater signing: private key `~/.config/jyz/updater.key` (never commit, never print), public half in `tauri.conf.json` `plugins.updater.pubkey`, CI secret `TAURI_SIGNING_PRIVATE_KEY`. Losing the private key means no installer can ever update again.
- GitHub serves release assets only on a **public** repo: `releases/latest/download/latest.json` answered 404 while `jyz-tool` was private, token or not. It is public as of 2026-10-30, so the updater endpoint resolves; a private release can still be verified through `gh api repos/JeffreyJYZ/jyz-tool/releases/latest` instead of fetching it.
- Alphas ship as **non-prerelease** releases marked `--latest` (Quarry's shape): `/releases/latest/` skips prereleases, so a `--prerelease` alpha would 404 its own update endpoint.

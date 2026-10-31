# 2026-10-31 — scaffold and window

What landed since the v1 milestone report and the 2026-10-30 notes. Release line `0.1.0-alpha.4` → `0.1.0-alpha.21`.

## Landed

- **`jyz create` feature flags** — `--feature <name>` (repeatable), `--features a,b`, `--list-features`. With no feature flag on a TTY it asks interactively; non-TTY with a missing required value exits non-zero instead of hanging.
- **Templates** — `next`, `cli`, `rust-bin`, `c`, `monorepo`, `vite-tauri`. **Features** — `updater` (vite-tauri), `cac-cli` (cli, monorepo).
- **Desktop is Vite + TypeScript, no framework** — `packages/desktop/index.html` is boilerplate, `src/main.ts` imports the tested modules, and the old `ui/` directory is gone.
- **The window can run a resolved command** — `jyz serve --execute`, answered by a **Run it** checkbox on the Call screen (off by default).
- **200-line limit enforced** — `bun run size` (`scripts/check-file-size.ts`); `docs/refactor/oversized.txt` is currently empty.
- **Scaffold smoke** — `bun scripts/scaffold-smoke.ts` scaffolds a `vite-tauri` app with the updater and runs `cargo check` on it.
- **Self-update** — signed releases, `latest.json`, Settings screen with a manual check, in-place install; measured end to end on this machine.

## Traps recorded

- Tauri never writes `latest.json`; only `tauri-action` does. Manifest is written by `scripts/updater-manifest.ts`.
- Release assets are downloadable only on a public repo; `jyz-tool` is public now.
- `/releases/latest/` skips prereleases, so alphas publish without `--prerelease` and with `--latest`.
- `cac` prints the Node compatibility version under Bun, so `jyz` answers `--version` itself.
- A scaffold can pass string tests while emitting code that does not compile — the smoke runs `cargo check`, not just text assertions.
- Bundle version `0.1.0` sorts above `0.1.0-alpha.N`, so the manifest restamps the version from `package.json`.

## Still open

- MCP streaming is handler-level only; no host has driven it end to end.
- Desktop parity is a manifest test, not a UI walkthrough.
- `--git github` remains stub-tested only.
- opencode integration talks to a server it never starts; spawn mode is unimplemented.

---
updated: 202610311330
version: 1.0
---

# jyz v7 — Vite for the window, and a 200-line gate

Two structural changes. The desktop page stops being a hand-written single file that duplicates tested logic in plain JS, and the repo gains Quarry's file-size rule as a real gate.

Controller owns `docs/**`, `scripts/release*.ts`, `scripts/alpha-release.ts` and every commit.

## Global Constraints

- Bun only; `.ts` specifiers, tabs 4 wide, printWidth 100, bun:test.
- No git commands, no commits, no subagents, no network in tests.
- Verify with `bun test <your paths>`; `bun check` and `bun run lint` stay clean on your files.
- Do as much as possible in one turn: batch independent calls, chain dependent steps, never yield.

## Task 50 — the desktop is Vite + TypeScript

Owns: `packages/desktop/package.json`, `packages/desktop/index.html` (new, replaces `ui/index.html`), `packages/desktop/vite.config.ts` (new), `packages/desktop/tsconfig.json` (new), `packages/desktop/src/main.ts` (new) and any new module under `packages/desktop/src/`, `packages/desktop/test/**`, `packages/desktop/src-tauri/tauri.conf.json`.

- Add `vite` and `typescript` as devDependencies (latest), a `build:web` script (`vite build`), and make `dev` run Vite + Tauri the way a Vite-Tauri app does (document the chosen shape in a comment).
- `vite.config.ts`: `root` = the package, `build.outDir` = `dist`, `emptyOutDir` true, no framework plugin; `base: "./"` so the Tauri webview resolves assets from `tauri://localhost`.
- `index.html` is boilerplate only: `<div id="app">` skeleton, `<link rel="stylesheet" href="./src/app.css">`, `<script type="module" src="./src/main.ts">`.
- `src/main.ts` and its modules build the DOM and **import** the existing tested helpers — `screens.ts`, `updates.ts`, `bridge.ts`, `rpc.ts` — so the shipped page runs the same code the tests cover. Delete the plain-JS copies of `configRows`, `sessionRows`, `diffSessions`, `describeUpdate`, `screenFromHash` from the page.
- Keep every behaviour already shipped: three screens plus Settings, the update banner, the manual check, the install button, the session picker that survives a poll, the focus that survives a poll, dark theme, graceful degradation when `window.__TAURI_INTERNALS__` is absent.
- `tauri.conf.json`: `build.frontendDist` = `../dist`, `build.beforeBuildCommand` = `bun run build:web`, `build.devUrl` = `http://localhost:1420` (and Vite's `server.port` = 1420, strictPort).
- Delete `packages/desktop/ui/` once nothing references it.
- Update `scripts/ui-walkthrough.ts`'s root path to the built `dist` directory — that file is yours for exactly this edit; change nothing else in it except the root and its comment.

Every new module stays under 200 lines (the gate in Task 51 enforces it).

Tests: the existing desktop suites stay green; add one that imports a module and proves a helper is the same function object the page uses (e.g. `screens.ts`'s `configRows`), which is the whole point of the move. Validate with `bun run --cwd packages/desktop build:web` and report the emitted file list.

## Task 51 — a 200-line file-size gate

Owns: `scripts/check-file-size.ts` (new), `scripts/test/check-file-size.test.ts` (new), `docs/refactor/oversized.txt` (new), `package.json` (root, scripts only), `.github/workflows/ci.yml`, `AGENTS.md` (House rules line only).

Copy Quarry's shape from `~/dev/monorepos/quarry/scripts/check-file-size.ts`:

- `LIMIT = 200`. Walk `packages` and `scripts`, extension list `.ts`, `.tsx`, `.css`, `.rs`, skipping `node_modules`, `target`, `dist`, `gen`, `.git`.
- Files already oversized when the rule lands are listed one per line in `docs/refactor/oversized.txt` with their current line count as a comment-free `path` line. The check fails when a **new** file crosses the limit, and also when a listed file is no longer oversized — the list may only shrink.
- Export `countLines`, `lineCount`, `findViolations(...)` so the test drives them with fixture strings and a temp dir; print one `ok` line on success and one line per violation on failure, exit 1.
- Root `package.json` gains `"size": "bun scripts/check-file-size.ts"`; CI gets a step running it right after `bun run lint`; `AGENTS.md` House rules gains one line naming the rule and the exception file.

Seed `docs/refactor/oversized.txt` from the tree as it is when you start (run your own script with the gate off, or `wc -l`), sorted, so the first run is green. Do not refactor any oversized file — that is later work.

Tests: `countLines` for an empty string, a one-liner, a trailing newline, and CRLF; `findViolations` with a clean temp dir, a new 201-line file, and a listed file that shrunk below the limit.

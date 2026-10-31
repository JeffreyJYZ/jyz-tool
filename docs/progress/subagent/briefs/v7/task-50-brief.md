## Task 50 — the desktop is Vite + TypeScript

Owns: `packages/desktop/package.json`, `packages/desktop/index.html` (new, replaces `ui/index.html`),
`packages/desktop/vite.config.ts` (new), `packages/desktop/tsconfig.json` (new),
`packages/desktop/src/main.ts` (new) and any new module under `packages/desktop/src/`,
`packages/desktop/test/**`, `packages/desktop/src-tauri/tauri.conf.json`.

- Add `vite` and `typescript` as devDependencies (latest), a `build:web` script (`vite build`), and make
  `dev` run Vite + Tauri the way a Vite-Tauri app does (document the chosen shape in a comment).
- `vite.config.ts`: `root` = the package, `build.outDir` = `dist`, `emptyOutDir` true, no framework
  plugin; `base: "./"` so the Tauri webview resolves assets from `tauri://localhost`.
- `index.html` is boilerplate only: `<div id="app">` skeleton, `<link rel="stylesheet" href="./src/app.css">`,
  `<script type="module" src="./src/main.ts">`.
- `src/main.ts` and its modules build the DOM and **import** the existing tested helpers —
  `screens.ts`, `updates.ts`, `bridge.ts`, `rpc.ts` — so the shipped page runs the same code the tests
  cover. Delete the plain-JS copies of `configRows`, `sessionRows`, `diffSessions`, `describeUpdate`,
  `screenFromHash` from the page.
- Keep every behaviour already shipped: three screens plus Settings, the update banner, the manual check,
  the install button, the session picker that survives a poll, the focus that survives a poll, dark theme,
  graceful degradation when `window.__TAURI_INTERNALS__` is absent.
- `tauri.conf.json`: `build.frontendDist` = `../dist`, `build.beforeBuildCommand` = `bun run build:web`,
  `build.devUrl` = `http://localhost:1420` (and Vite's `server.port` = 1420, strictPort).
- Delete `packages/desktop/ui/` once nothing references it.
- Update `scripts/ui-walkthrough.ts`'s root path to the built `dist` directory — that file is yours for
  exactly this edit; change nothing else in it except the root and its comment.

Every new module stays under 200 lines (the gate in Task 51 enforces it).

Tests: the existing desktop suites stay green; add one that imports a module and proves a helper is the
same function object the page uses (e.g. `screens.ts`'s `configRows`), which is the whole point of the
move. Validate with `bun run --cwd packages/desktop build:web` and report the emitted file list.


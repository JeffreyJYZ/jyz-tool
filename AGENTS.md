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
- No source file over 200 lines; exceptions listed in `docs/refactor/oversized.txt` (list may only shrink).

## Commands

- `jyz` is linked globally with `bun link` (`~/.bun/install/global/node_modules/jyz` → `packages/cli`), so call `jyz …` from anywhere and edits take effect with no reinstall; never spell out `bun packages/cli/src/bin.ts`.
- `bun run mcp` (or `bun packages/mcp/src/bin.ts`) runs the MCP server from the checkout; `--cwd <dir>` picks the project.
- `jyz oc sessions|prompt|watch` finds the live opencode server from `~/.local/state/opencode/service.json` (HTTP Basic), so the desktop panel can list sessions, send a prompt into one, and stream its events — the panel is a chat ingress, not a reader.
- `bun run jyz` prints help; `jyz --version` prints `jyz/<version> <os>-<arch> bun-<bun version>` (answered by the CLI itself: cac appends the Node compatibility version under Bun).
- Gates: `bun run typecheck` (`bun check`), `bun run lint` (`biome check .`), `bun run format:check` (`bun fmt --check`), `bun run test`, `bun run size`.
- Accessibility: `bun run a11y` loads the built `dist/` in a real browser with the Tauri call stubbed and reads the DOM the way a screen reader does — landmarks, one heading per region, one `aria-current` tab, live regions, an accessible name on every control. It exits 2 without `agent-browser` and is a local gate, not a CI one; rebuild with `build:web` first.
- `bun scripts/scaffold-smoke.ts` runs every scaffold scenario; `--scenario=c` proves the C template with `make check`, `make build` and a run, and CI does that on macOS and Ubuntu. Scenarios call `packages/cli/src/bin.ts` directly, never a linked `jyz`, because CI has no `bun link`.
- Desktop: `bun run --cwd packages/desktop build` stages the CLI sidecar (`scripts/stage-sidecar.ts`, output `src-tauri/binaries/jyz-<triple>`, gitignored) then runs `tauri build`. That **also bundles a dmg**, and Tauri's `bundle_dmg.sh` mounts a `jyz` volume and asks Finder to lay out the drag window — one pop-up per build, which the user notices. For local checks use `build:web` or `build:app` (`tauri build --bundles app`); the dmg path is for releases only.
- Packages: `jyz-tool` (bin `jyz`) and `@jeffreyjyz/mcp` (bin `jyz-mcp`) ship as self-contained bundles (`bun build --target=bun`, core and cac inlined, `dependencies: {}`), with a shim bin that runs `src/` in a checkout and `dist/` in a packed install. `bun scripts/cli-pack.ts` and `bun scripts/mcp-pack.ts` install each tarball alone and are gated on ubuntu CI.
- npm: the CLI publishes as `jyz-tool` (bin `jyz`) and the MCP server as `@jeffreyjyz/mcp` (bin `jyz-mcp`) — bare `jyz` on npm is someone else's `0.0.0` placeholder. Trusted publishing is registered per package (`.github/workflows/publish.yml`), so tags `cli-v*` / `mcp-v*` publish with no token and no prompt; alphas land on the `alpha` dist-tag, and `latest` stays on a non-prerelease.
- npm refuses a publish whose provenance names a repository the manifest omits: `E422 ... repository.url is ""`. Both packages therefore carry `repository` and `homepage`; adding one to only half the manifests fails the other at publish time.
- Release: `bun run scripts/alpha-release.ts --push` runs the four gates, bumps every manifest, commits, tags and pushes; `--dry-run` shows the version without touching anything. `bun scripts/verify-release.ts` checks the published assets.
- Updates: the app checks `latest.json` on start and installs on a button press; bundles are signed with `~/.config/jyz/updater.key`, and `bun scripts/updater-manifest.ts` merges the per-platform partials and restamps the version before upload.
- Machine surfaces: `jyz capabilities [--json]` prints the capability manifest; `jyz serve` speaks JSON-RPC over stdio; `bun scripts/mcp-smoke.ts` walks initialize, tools, resources, watch and cancel against the real MCP server.
- Perf: `bun scripts/bench.ts --runs 5` prints p50/p95 for `--version`, `config path` and `run`.
- Desktop walkthrough: `bun scripts/ui-walkthrough.ts` serves `packages/desktop/ui` and drives all three screens in a real browser with the Tauri IPC stubbed; needs `agent-browser` on PATH and exits 2 without it.
- CI: `.github/workflows/ci.yml` gates every push; `.github/workflows/release.yml` runs on `v*` tags across macOS, Linux and Windows.

## Traps

- A Tauri window on macOS exposes **no accessibility element**: `agent-desktop snapshot --app jyz` answers `WINDOW_NOT_FOUND`, and by window id `ACTION_NOT_SUPPORTED: window_without_accessibility_element`, so the accessibility tree cannot drive the app — only `screenshot` plus coordinate input (`--headed --xy`) can, and the Vite page in a browser with the IPC stubbed stays the automatable path.
- The native menu **is** in the accessibility tree, and `osascript` reads it without taking focus: `tell application "System Events" to tell process "jyz-desktop" to get name of every menu item of menu 1 of menu bar item "jyz" of menu bar 1` answers `Check for Updates…, Install Update, missing value, Close Window, …, Quit jyz`. That is the proof the menu is real; use it instead of a screenshot.
- `open -g` starts the app without activating it, and while it is not front the window is absent from both the AX tree (`Can't get window 1 … Invalid index`) and `agent-desktop screenshot --window-id` (blank capture). Activate with `open -a /Applications/jyz.app` before concluding the UI is broken.
- Padding lives on `#app`, never on `main` alone: the tab strip is a sibling of `main`, so padding on `main` leaves the tabs flush against the window edges (the alpha.23 window shipped exactly that).
- The updater downloads a ~45–47 MB `jyz.app.tar.gz` (measured 9.99 s at 4.7 MB/s), so `jyz_update_install` emits `jyz:update-progress` per chunk and the Install button prints percent and MB; a still button reads as a hang.
- A Windows `.cmd` stub must end `exit /b %ERRORLEVEL%`, never a fixed code: a fixed one reports success for every failing stub and hides the failure the test exists to catch.
- Test `PATH` is joined with `delimiter` from `node:path`, never `":"` — a hardcoded colon makes the stub directory one bogus entry on Windows, and the CLI then answers `Executable not found in $PATH`, which reads as a resolver bug and is not.
- Spawning a resolved `.cmd`/`.bat` goes through `cmd.exe /c`: `Bun.spawn` cannot execute a batch file directly. `which()` walks PATH with PATHEXT and `spawnArgv()` does the wrapping.
- `agent-desktop screenshot --window-id <id>` writes a 2x PNG; read it directly to see the real UI, and remember a stale install shows exactly what that build had (alpha.11 has no Settings tab).

- `bun fmt` does NOT wrap Markdown by default (`proseWrap` is `preserve`); `[[fmt.overrides]]` with `proseWrap = "never"` pins that for `**/*.md`. What it does change is table column alignment and `*emphasis*` style. `.prettierignore` now excludes only `local/`.
- Never hard-wrap markdown by hand even though the formatter allows it: one line per bullet, no soft wraps.
- Never name a package script `fmt` or `check`: both shadow Bun builtins, so `bun fmt --check` would write and `bun check` would stop typechecking.
- Biome installed as 2.6.4, where `rules.recommended` is deprecated in favour of `rules.preset`; run `bunx biome migrate --write` after a bump.
- One version source: `packages/core/src/const/version.ts` imports `packages/core/package.json`, and the CLI reads it. Bump all four `package.json` files together or the release tag lies.
- The CLI bin is `packages/cli/src/bin.ts` with a bun shebang, so `bun link` gives a working `jyz` with no build step; compiled binaries come from `bun build --compile`.
- Tauri icons are generated from `packages/desktop/app-icon.svg` by `bun run --cwd packages/desktop icon`; never hand-edit the derived files, and never call `bunx tauri`, which resolves the wrong npm package.
- Tauri builds only on the matching OS, so desktop installers come from the CI matrix, never from one machine.
- `enable_webview_accessibility` (an Accessibility override pushed onto the WKWebView in `lib.rs`) segfaulted at launch inside `NSAccessibilitySetOverriddenAttributesForUIElement`, `KERN_INVALID_ADDRESS at 0x1`, killing the app before its window painted — so every later launch looked like a broken build or a crash loop. Never re-add it; the safe accessible surface is the native menu in `src/menu.rs`.
- `.deb` rejects a hyphen in the version and `.msi` requires a numeric pre-release, so bundles are built with `--config '{"version":"0.1.0"}'` while the artefact names and the git tag keep `0.1.0-alpha.1`.
- The updater's `latest.json` inherits that `0.1.0` and `0.1.0` sorts _above_ every `0.1.0-alpha.N`, so `scripts/updater-manifest.ts` restamps its `version` from `package.json` after every bundle; without that step each installed alpha is offered an update to itself in a loop.
- Updater signing: private key `~/.config/jyz/updater.key` (never commit, never print), public half in `tauri.conf.json` `plugins.updater.pubkey`, CI secret `TAURI_SIGNING_PRIVATE_KEY`. Losing the private key means no installer can ever update again.
- `/releases/latest/download/latest.json` is CDN-cached: right after a publish it can still serve the previous version for a minute or two, and the updater reads exactly that URL. Verify a fresh publish with the tag URL (`/releases/download/v<version>/latest.json`) or `gh release download`, never by concluding the manifest is wrong.
- GitHub serves release assets only on a **public** repo: `releases/latest/download/latest.json` answered 404 while `jyz-tool` was private, token or not. It is public as of 2026-10-30, so the updater endpoint resolves; a private release can still be verified through `gh api repos/JeffreyJYZ/jyz-tool/releases/latest` instead of fetching it.
- Alphas ship as **non-prerelease** releases marked `--latest` (Quarry's shape): `/releases/latest/` skips prereleases, so a `--prerelease` alpha would 404 its own update endpoint.

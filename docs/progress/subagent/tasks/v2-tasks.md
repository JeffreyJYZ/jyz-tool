---
updated: 202610302355
version: 1.0
---

# jyz v2 — distribution and the human halves

Closes the four v2 items that were seams only: MCP distribution, usable desktop screens, a desktop installer that ships the CLI, and an opencode panel with session watch. Four parallel tasks with disjoint paths.

Controller owns root and package `package.json` files except where a task is named below to edit one, plus `packages/core/**`, `packages/cli/src/bin.ts`, `scripts/*.ts`, `.github/**`, `docs/**` and every commit.

## Global Constraints

- Bun only; `.ts` specifiers, tabs 4 wide, printWidth 100, bun:test.
- Never edit `tsconfig.json`, `biome.json`, `.github/**`, `docs/**`, or another task's paths.
- No new dependencies, no subagents, no network in tests beyond localhost.
- No git commands, no commits, no publishing.
- Verify with `bun test <your paths>`; `bun check` must stay clean on your files.
- Do as much as possible in one turn: batch independent calls, chain dependent steps, never yield.

## Shared contracts (all four tasks agree on these; do not change them)

- `jyz oc sessions --json` prints one JSON array on stdout: `[{"id": string, "title": string, "updatedAt": string}]`.
- `jyz oc prompt <text> --session <id> --json` prints `{"session": string, "sent": true}`.
- Tauri command `jyz_oc(args: string[]) -> Result<String, String>` runs the resolved `jyz` as `jyz oc <args...>` and returns stdout verbatim; the first element must be `sessions` or `prompt`, anything else is an `Err`. The page calls it as `invoke("jyz_oc", { args: ["sessions", "--json"] })`.
- The desktop installer ships the CLI as a Tauri sidecar: `bundle.externalBin: ["binaries/jyz"]`, the file staged at `packages/desktop/src-tauri/binaries/jyz-<rust-target-triple>`, and the shell prefers that sibling binary over `PATH`.

## Task 34 — MCP distribution manifest

Owns: `packages/mcp/package.json`, `packages/mcp/src/bin.ts`, `packages/mcp/README.md`, `packages/mcp/test/bin.test.ts`, `scripts/test/mcp-package.test.ts`.

The server runs from a repo checkout today. Make it installable and shippable:

- `packages/mcp/package.json` gains `bin: { "jyz-mcp": "./src/bin.ts" }`, `description`, `license`, `engines.bun`, `files` covering `src/**` and `README.md`, `publishConfig.access: "public"`, and keeps `private: true` until a publish decision is made (note that in the README).
- `src/bin.ts` is a thin, documented entry: `#!/usr/bin/env bun`, resolves the project directory from `--cwd <dir>` then `JYZ_MCP_CWD` then `process.cwd()`, and calls `startServer(cwd)` from `server.ts`. It must not re-implement the loop.
- `README.md` states what the server is, how to run it from a checkout (`bun packages/mcp/src/bin.ts`), how a host points at it (`command: jyz-mcp`, no args), and that standalone binaries are attached to each GitHub release by `scripts/release.ts`.

Tests: the manifest invariants (bin path exists, has a shebang, `files` includes `src`, engines and publishConfig present); `bun packages/mcp/src/bin.ts` driven over stdio answers an `initialize` handshake and lists 15 tools; `--cwd <tmp>` wins over the environment. A second test file asserts the same invariants by reading the manifest from the repo root, so a broken package cannot ship.

Do not edit `scripts/release.ts`; the controller wires the compiled binaries.

## Task 35 — desktop screens: runner, config viewer, opencode panel

Owns: `packages/desktop/ui/index.html`, `packages/desktop/src/screens.ts`, `packages/desktop/test/screens.test.ts`.

The window is one form and a result pane. Give it three screens behind a tab strip, all of them sending their work through the existing bridge (`jyz_call` for capabilities, `jyz_oc` for opencode) and all of their shaping in `screens.ts` so bun:test reaches it:

1. **Call** — today's runner, unchanged in behaviour: method picker from `jyz_capabilities`, params box, result pane.
2. **Config** — runs `config` with `{"action":"show"}` on load and on a Refresh button, then renders the returned `stdout` as a table of key, value and source. No params box on this screen.
3. **opencode** — lists sessions via `jyz_oc(["sessions","--json"])`, lets a person pick one, type a prompt and send it via `jyz_oc(promptArgv(session, text))`, and keeps a watch ticker: poll the session list every 5 s while the screen is visible, diff against the previous list and mark changed or new session ids. A stopped server must read as a one-line message, not a stack.

`screens.ts` exports, all pure and tested:

- `configRows(stdout: string): { key: string; value: string; source: string }[]` — parses `key = value (source)` lines and skips `config:`, `layer:`, `warning:`, `aliases:`, `scripts:`.
- `sessionRows(json: string): { id: string; title: string; updatedAt: string }[]` — tolerant: bad JSON or a non-array is `[]`.
- `diffSessions(previous: SessionRow[], next: SessionRow[]): string[]` — ids that are new or whose title or updatedAt changed, in `next` order.
- `promptArgv(session: string, text: string): string[]` → `["prompt", text, "--session", session, "--json"]`.
- `screenFromHash(hash: string): Screen` and `screenHref(screen: Screen): string` so the tab strip is addressable and the mapping is testable.

Keep the dark theme and the existing CSS vocabulary; the page stays framework-free, one `<script>`, no bundler. `bridge.ts` and `rpc.ts` are not yours.

Tests: each helper on its happy path and its malformed input; `diffSessions` for new, changed, unchanged and reordered lists; `screenFromHash` for every screen and for junk.

## Task 36 — the installer carries the CLI, and the shell can drive opencode

Owns: `packages/desktop/src-tauri/src/lib.rs`, `packages/desktop/src-tauri/src/linux_process.rs`, `packages/desktop/src-tauri/tauri.conf.json`, `packages/desktop/scripts/stage-sidecar.ts`, `scripts/test/desktop-bundle.test.ts`.

Two jobs, both about what a person gets after installing:

- **Sidecar.** `tauri.conf.json` declares `bundle.externalBin: ["binaries/jyz"]`. `packages/desktop/scripts/stage-sidecar.ts` computes the Rust host triple (`rustc -vV`, the `host:` line), compiles the CLI with `bun build --compile packages/cli/src/bin.ts --outfile packages/desktop/src-tauri/binaries/jyz-<triple>` (add `.exe` on Windows), and is idempotent. It prints one line naming the staged path. `binaries/` stays out of git.
- **Lookup.** The shell prefers `jyz` sitting beside its own executable (`current_exe()`'s directory, with `.exe` on Windows) before anything on `PATH`, because that is where the installer puts the sidecar. Keep the existing `PATH` and Linux-location fallbacks, and keep `linux_process::resolve` as the last resort.
- **`jyz_oc(args: string[]) -> Result<String, String>`** per the shared contract: runs the resolved CLI as `jyz oc <args...>`, allowlists the first element (`sessions`, `prompt`), returns stdout trimmed, and maps a non-zero exit to the child's stderr. Register it in the invoke handler.

Rust unit tests for the allowlist and for the sibling-path lookup (build a temp dir with a fake `jyz` file and assert it wins over `PATH`). Validate with `cargo check` and `cargo fmt --check` inside `packages/desktop/src-tauri` and report both verbatim.

`scripts/test/desktop-bundle.test.ts` (bun:test) asserts from the repo root: `tauri.conf.json` declares exactly that `externalBin` entry, the bundle is active with `targets: "all"`, the stage script exists and names the same output directory, and `.gitignore` ignores `packages/desktop/src-tauri/binaries/`. Do not edit `.gitignore` yourself; if it lacks the line, report it instead.

## Task 37 — `oc` speaks JSON

Owns: `packages/cli/src/commands/oc.ts`, `packages/cli/test/oc-json.test.ts`.

`oc` prints for humans only, so the desktop cannot read it. Add an opt-in `--json` that never changes the prose path:

- `jyz oc sessions --json` prints the array in the shared contract shape, one compact document, and nothing else on stdout.
- `jyz oc prompt <text> --session <id> --json` prints `{"session": "<id>", "sent": true}`.
- without `--json`, output is byte-for-byte what it is today.
- errors keep going through `guard`, with a non-zero exit and the message on stderr, in both modes.

Tests stub `fetch` (no real server): the JSON array shape and field names, the prompt envelope, the prose path unchanged, and a failing request producing a non-zero exit with no partial JSON on stdout.

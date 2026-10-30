---
updated: 202610301900
version: 1.0
---

# jyz v1e tasks — bridge, verification, MCP streaming

Three parallel tasks, disjoint paths. Controller owns `package.json`, `packages/core/src/index.ts`, `docs/**`, `.github/**`, `scripts/release*.ts`, `packages/cli/src/bin.ts`, `packages/cli/src/lib/verbs.ts` and every commit.

## Global Constraints

- Bun only; `.ts` specifiers, tabs 4 wide, printWidth 100, bun:test.
- Never edit `package.json`, `tsconfig.json`, `biome.json`, `bunfig.toml`, `.github/**`, `docs/**`, or another task's paths.
- No git commands, no commits, no subagents, no network.
- New runtime dependencies are not allowed. `@tauri-apps/api` already exists in the desktop package; use it only where the brief says so.
- Verify with `bun test <your paths>`; `bun check` must stay clean.
- Do as much as possible in one turn: batch independent calls, chain dependent steps, never yield.

## Task 19 — desktop bridge to `jyz serve`

Owns: `packages/desktop/src-tauri/src/linux_process.rs`, `packages/desktop/src-tauri/src/main.rs`, `packages/desktop/src-tauri/src/lib.rs`, `packages/desktop/src-tauri/capabilities/default.json`, `packages/desktop/ui/index.html`, `packages/desktop/src/bridge.ts`, `packages/desktop/test/bridge.test.ts`.

- Add one Tauri command `jyz_call(method: String, params: serde_json::Value)` that spawns `jyz serve --cwd <cwd>`, writes one JSON-RPC request line, reads one response line, kills the child, and returns the parsed `result` or an error string
- Add `jyz_version()` returning `jyz --version` output for the window footer
- Permission entry for the command in `capabilities/default.json`
- `ui/index.html`: a single form — method select (from a short hardcoded list of capabilities), a JSON params box, a Run button, and a `<pre>` result pane; dark, no framework, no bundler
- `packages/desktop/src/bridge.ts`: the pure request/response shaping used by the UI, exported and unit tested; it must not import Tauri

Tests: `packages/desktop/test/bridge.test.ts` covers request shaping, error mapping and result extraction. Rust is validated with `cargo check` inside `src-tauri`; report the exact command you ran.

## Task 20 — verify-release script

Owns: `scripts/verify-release.ts`, `scripts/test/verify-release.test.ts`.

A committed, reusable check for a published release — the rules require one per releasing project, never an ad-hoc shell probe.

- `bun scripts/verify-release.ts [tag]` defaults the tag to the current package version as `v<version>` and the repo from `git remote get-url origin`
- fetches the release with `gh release view <tag> --json tagName,isPrerelease,assets,url` and asserts: the release exists, `tagName` matches, at least one `cli-` asset, at least one `desktop-` asset, and every expected platform suffix appears (`darwin-arm64`, `darwin-x64`, `linux-x64`, `windows-x64`)
- prints one verdict line (`ok <tag> <n> assets` or `missing: <what>`) and exits non-zero on any gap
- polls up to `--timeout <seconds>` (default 0, single check) with `--wait` enabling polling every 15s
- export the pure function `checkAssets(assets: {name: string}[], version: string): string[]` returning a list of problems, so it is testable without network

Tests: pure-function coverage for the happy path, a missing cli asset, a missing desktop asset, a missing platform, and an empty asset list.

## Task 21 — MCP streaming tools and resources

Owns: `packages/mcp/src/{tools,handler}.ts`, `packages/mcp/src/resources.ts`, `packages/mcp/test/{tools,streaming,resources}.test.ts`.

Extend the existing layer:

- streaming tools: `jyz_watch` (runs a script and streams output) and `jyz_cancel`, declared with `streaming: true` and a `handle` in the schema; the handler layer returns a handle immediately and emits frames through an injected `onProgress` callback supplied in the call options
- `src/resources.ts`: `listResources()` and `readResource(uri)` exposing `jyz://config` (the merged config with source layers, as JSON text) and `jyz://capabilities` (the capability manifest)
- handler options grow to `{ cwd, onProgress?, signal? }` without breaking the existing two-argument call shape

Tests: streaming start emits at least one progress frame and cancel stops the child; resources list contains both URIs; reading `jyz://config` returns parseable JSON with a `project` key; unknown URI throws a typed error.

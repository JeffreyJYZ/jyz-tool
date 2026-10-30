---
updated: 202610302345
version: 1.0
---

# jyz v1k — close the parity loop

Two parallel tasks. Controller owns `packages/cli/**`, `scripts/*.ts`, `docs/**`, `package.json`, `.github/**` and every commit.

## Global Constraints

- Bun only; `.ts` specifiers, tabs 4 wide, printWidth 100, bun:test.
- Never edit `package.json`, `tsconfig.json`, `biome.json`, `.github/**`, `docs/**`, `scripts/*.ts`, or another task's paths.
- No new dependencies, no subagents, no network in tests.
- `jyz capabilities --json` now exists and prints the manifest; `jyz serve` accepts capability names over JSON-RPC.
- Verify with `bun test <your paths>`; `bun check` must stay clean.
- Do as much as possible in one turn: batch independent calls, chain dependent steps, never yield.

## Task 32 — the desktop window gets the manifest from the CLI

Owns: `packages/desktop/src-tauri/src/{lib.rs,linux_process.rs}`, `packages/desktop/ui/index.html`, `packages/desktop/src/bridge.ts`, `packages/desktop/test/{bridge,parity}.test.ts`.

The UI currently falls back to a hardcoded list because nothing supplies the manifest. Close it:

- a Tauri command `jyz_capabilities()` runs `jyz capabilities --json`, parses it, and returns the array; a non-zero exit or bad JSON returns an empty array rather than throwing into the page
- `lib.rs` passes the manifest to the window (either through an initialization script or an `invoke` the page performs on load — pick one and document why in a comment)
- `ui/index.html` populates the method select from that manifest only; the inline fallback list is removed
- `bridge.ts` gains `selectableMethods(manifest): string[]` (manifest order, no duplicates) and keeps `methodsFromManifest`/`groupByKind`
- `packages/desktop/test/parity.test.ts` asserts every capability the core manifest exposes is selectable in the UI path, i.e. `selectableMethods(listCapabilities())` equals the manifest names

Validate Rust with `cargo check` and `cargo fmt --check` inside `packages/desktop/src-tauri`; report both.

## Task 33 — smoke the streaming pair too

Owns: `scripts/mcp-smoke.ts`, `scripts/test/mcp-smoke.test.ts`.

The walkthrough covers initialize, tools, resources but not the streaming tools that exist now:

- add a `tools/call` step for `jyz_watch` with a short sleep command, asserting at least one progress frame arrives before completion, then a `jyz_cancel` step that succeeds
- a stream that never emits progress must fail that step, not hang: hard timeout per step, child always killed
- keep the existing five steps and the `--json` shape; the verdict grows to seven steps

Tests: the real-server path reports seven ok steps; a scripted child that sends no progress fails the watch step and still exits non-zero; the JSON shape counts seven.

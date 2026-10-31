---
updated: 202610311700
version: 1.0
---

# jyz v9 — keep shrinking the size debt

The gate is real and the list must only shrink. Fourteen files remain, mostly scripts and tests. This wave takes the three worst again, one per agent, all disjoint.

Controller owns `docs/**`, `packages/core/src/index.ts` (except the blocks a task exports through), `packages/cli/src/bin.ts`, root manifests and every commit.

## Global Constraints

- Behaviour identical; every export keeps its name and signature.
- Every file under 200 lines; strike the split file's line from `docs/refactor/oversized.txt` (a listed file that shrinks below the limit is a gate failure, by design).
- Tabs 4 wide, printWidth 100, bun:test; `bun check`, `bun run size`, `bun run lint`, `bun fmt --check` and the package's own tests green.
- No new dependencies, no git commands, no commits, no subagents, no network.

## Task 60 — `packages/desktop/src-tauri/src/lib.rs` (416 lines)

Own: that file plus new modules under `packages/desktop/src-tauri/src/`. Split the JSON-RPC call plumbing, the capability read, the opencode command and the updater commands into their own modules; keep the `#[tauri::command]` names, the invoke handler list and `run()` byte-identical in behaviour. Rust unit tests stay, and `cargo check` plus `cargo fmt --check` must pass in `src-tauri`.

## Task 61 — `scripts/release-local.ts` (393 lines)

Own: that file plus new modules under `scripts/release/`. Split the manifest and asset helpers from the build/publish orchestration; keep the exported pure helpers (`expectedTag`, `signatureVersion`, `assetPlan`, `refusals`, `requiredAssets`, `releaseAssets`, `uptodateDmgName`) importable from `scripts/release-local.ts` so its test keeps passing unchanged.

## Task 62 — `scripts/ui-walkthrough.ts` (286 lines)

Own: that file plus new modules under `scripts/walkthrough/`. Split the stub source, the static server and the agent-browser helpers out of the step list; keep `serveUi` and `stubSource` exported from the script itself, and keep the walkthrough printing the same steps and exit codes.

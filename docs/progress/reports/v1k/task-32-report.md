# Task 32 report

Status: done.

Files changed:

- `packages/desktop/src-tauri/src/lib.rs` — added `jyz_capabilities()` command running `jyz capabilities --json`, returning parsed array or empty on failure; registered in handler.
- `packages/desktop/src/bridge.ts` — added `selectableMethods(manifest)` (manifest order, dedup).
- `packages/desktop/ui/index.html` — removed hardcoded fallback; populates method select from `jyz_capabilities` invoke on load.
- `packages/desktop/test/parity.test.ts` — new parity assertion.
- `packages/desktop/src-tauri/Cargo.toml` — direct `serde_json` dependency.

Tests: 30 pass, 0 fail (bridge + parity + rpc).

Cargo: `cargo check` OK; `cargo fmt --check` OK.

Concerns: none.

# Task 19 — desktop bridge to CLI JSON-RPC

Status: complete.

Files:

- packages/desktop/src-tauri/src/lib.rs (commands made non-pub to compile with Tauri 2.12 macros)
- packages/desktop/src-tauri/src/linux_process.rs (fixed `.ok()` → `.flatten()` on Option)
- packages/desktop/src-tauri/capabilities/default.json (added allow-jyz-call, allow-jyz-version)
- packages/desktop/src/bridge.ts, packages/desktop/test/bridge.test.ts (unchanged, already complete)
- packages/desktop/ui/index.html (unchanged, already complete)

Tests: bun test packages/desktop/test — 25 pass, 0 fail. Cargo: cargo check passes (Finished dev profile). cargo fmt --check fails only on tab-vs-space indentation in main.rs (project uses tabs; rustfmt defaults to spaces); no other diffs.

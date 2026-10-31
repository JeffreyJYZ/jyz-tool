# Task 60 report

Split `packages/desktop/src-tauri/src/lib.rs` (416 lines) into modules:

- `program.rs` — `PROGRAM`, `CALL_TIMEOUT`, sibling resolution, `program()`, `serve_argv`, `project_dir`.
- `rpc.rs` — `spawn`, `round_trip`, `read_to_string`, `answered_nothing`, `request_frame`, `json_string`.
- `capabilities.rs` — `jyz_capabilities`, `jyz_version`.
- `opencode.rs` — `oc_allowed`, `jyz_oc`.
- `updater.rs` — `UpdateOffer`, `updater_pubkey_from_config`, `jyz_update_check`, `jyz_update_install`.
- `lib.rs` — `jyz_call`, `run()`, tests (117 lines).

Command names, invoke handler list and `run()` behaviour unchanged. Removed the `lib.rs` line from `docs/refactor/oversized.txt`.

Gates:

- `cargo check` (in `packages/desktop/src-tauri`): passed.
- `cargo fmt --check` (in `packages/desktop/src-tauri`): passed.
- `bun run size`: fails on unrelated pre-existing `scripts/release/run.ts` (293 lines); `lib.rs` no longer flagged.
- `bun check`: passed (0 type errors).
- `bun run lint`: pre-existing errors in `packages/core` and elsewhere; no new errors from this change.

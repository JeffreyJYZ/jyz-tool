## Task 60 — `packages/desktop/src-tauri/src/lib.rs` (416 lines)

Own: that file plus new modules under `packages/desktop/src-tauri/src/`. Split the JSON-RPC call plumbing, the capability read, the opencode command and the updater commands into their own modules; keep the `#[tauri::command]` names, the invoke handler list and `run()` byte-identical in behaviour. Rust unit tests stay, and `cargo check` plus `cargo fmt --check` must pass in `src-tauri`.

# Task 52c report

Fixed updater.rs generation: explicit `app.updater()` error mapping, `app.restart()` moved inside the update branch, removed unused `tauri::Manager` import.

cargo check result: only failure is template icon panic (`icons/icon.png` missing) — separate task. `cargo check ... | rg 'updater.rs'` prints no errors.

Gates: bun test packages/core/test (160 pass), bun check (0 errors), bun run size (18 oversized), biome clean. EOF

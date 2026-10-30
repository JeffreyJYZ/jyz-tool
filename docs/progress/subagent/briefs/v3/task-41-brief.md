## Task 41 — the Rust side and the bundle config

Owns: `packages/desktop/src-tauri/src/lib.rs`, `packages/desktop/src-tauri/tauri.conf.json`, `packages/desktop/src-tauri/Cargo.toml`, `scripts/test/updater-config.test.ts`.

- Add `tauri-plugin-updater = "2"` and register it in the builder chain before `run()`.
- `tauri.conf.json`: `bundle.createUpdaterArtifacts: true` and a `plugins.updater` block with the pubkey and endpoint from the shared contract.
- Implement `jyz_update_check` and `jyz_update_install` with the signatures above. Check must not download; install must emit nothing to stdout and must not restart when the install fails. Read the pubkey from the config, not from an environment variable.
- Rust unit tests: the offer shape serializes the three fields, and a missing config key is reported as an error rather than a panic.

`scripts/test/updater-config.test.ts` asserts from the repo root: `createUpdaterArtifacts` is true, the pubkey decodes from base64 and starts with `untrusted comment:`, the endpoint is the GitHub URL, the Cargo manifest carries the plugin, and `lib.rs` registers it.

Validate with `cargo check` and `cargo fmt --check` in `packages/desktop/src-tauri` and quote both.

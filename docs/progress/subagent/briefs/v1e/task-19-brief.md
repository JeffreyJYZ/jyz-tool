## Task 19 — desktop bridge to `jyz serve`

Owns: `packages/desktop/src-tauri/src/linux_process.rs`, `packages/desktop/src-tauri/src/main.rs`, `packages/desktop/src-tauri/src/lib.rs`, `packages/desktop/src-tauri/capabilities/default.json`, `packages/desktop/ui/index.html`, `packages/desktop/src/bridge.ts`, `packages/desktop/test/bridge.test.ts`.

- Add one Tauri command `jyz_call(method: String, params: serde_json::Value)` that spawns `jyz serve --cwd <cwd>`, writes one JSON-RPC request line, reads one response line, kills the child, and returns the parsed `result` or an error string
- Add `jyz_version()` returning `jyz --version` output for the window footer
- Permission entry for the command in `capabilities/default.json`
- `ui/index.html`: a single form — method select (from a short hardcoded list of capabilities), a JSON params box, a Run button, and a `<pre>` result pane; dark, no framework, no bundler
- `packages/desktop/src/bridge.ts`: the pure request/response shaping used by the UI, exported and unit tested; it must not import Tauri

Tests: `packages/desktop/test/bridge.test.ts` covers request shaping, error mapping and result extraction. Rust is validated with `cargo check` inside `src-tauri`; report the exact command you ran.

## Task 7 — desktop wiring and release docs

Wave A. Model tier: easy.

Owns: `packages/desktop/src/**`, `packages/desktop/README.md`.

Adds the desktop placeholder for the CLI bridge: a `packages/desktop/src/rpc.ts` module documenting and stubbing the stdio JSON-RPC client shape used at v2, with unit tests for message framing only. No Tauri commands are registered in v1; the window stays a shell.

## Task 40 — the plan and the docs stop lying about the SDK

Owns: `docs/plan/agent/main.md` section `## v2 — shipped` only, `packages/mcp/README.md` (one paragraph if it mentions opencode at all, otherwise leave it).

Update the opencode bullet: the seam now uses `@opencode/client` 2.0.x copied from the live `opencode-tauri-client` reference, `jyz oc watch` exposes the event stream, and the desktop panel still polls `oc sessions` on a timer while the stream is what a terminal uses. One paragraph, no history, no apology.

Edits inside `docs/**` are this task's one exception to the global rule; touch nothing else there.

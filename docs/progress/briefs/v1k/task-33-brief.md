## Task 33 — smoke the streaming pair too

Owns: `scripts/mcp-smoke.ts`, `scripts/test/mcp-smoke.test.ts`.

The walkthrough covers initialize, tools, resources but not the streaming tools that exist now:

- add a `tools/call` step for `jyz_watch` with a short sleep command, asserting at least one progress frame arrives before completion, then a `jyz_cancel` step that succeeds
- a stream that never emits progress must fail that step, not hang: hard timeout per step, child always killed
- keep the existing five steps and the `--json` shape; the verdict grows to seven steps

Tests: the real-server path reports seven ok steps; a scripted child that sends no progress fails the watch step and still exits non-zero; the JSON shape counts seven.

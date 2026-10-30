## Task 31 — MCP host walkthrough

Owns: `scripts/mcp-smoke.ts`, `scripts/test/mcp-smoke.test.ts`.

Prove the MCP server works from a host's side, not just from unit tests:

- `bun scripts/mcp-smoke.ts [--json]` spawns `bun packages/mcp/src/server.ts`, performs `initialize`, `tools/list`, one `tools/call` (`jyz_config` with action `path`), `resources/list` and `resources/read` on `jyz://capabilities`, then shuts the child down and prints a one-line verdict per step
- exit non-zero if any step errors or a response frame is malformed; `--json` prints the collected frames as one document
- export `runSmoke(cmd: string[], cwd: string): Promise<{ step: string; ok: boolean; detail: string }[]>` so the test can drive it with a scripted child
- the whole run has a hard timeout, and the child is always killed

Tests: `runSmoke` against the real server (fast, local) asserts five ok steps; a scripted child that returns a malformed frame yields one failed step and a non-zero verdict; the JSON shape is stable.

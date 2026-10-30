---
updated: 202610302300
version: 1.0
---

# jyz v1j — opencode spawn mode, MCP host walkthrough

Two parallel tasks, disjoint paths. Controller owns `package.json`, `packages/core/src/index.ts`, `docs/**`, `.github/**` and every commit.

## Global Constraints

- Bun only; `.ts` specifiers, tabs 4 wide, printWidth 100, bun:test.
- Never edit `package.json`, `tsconfig.json`, `biome.json`, `.github/**`, `docs/**`, or another task's paths.
- No new dependencies, no subagents, no network. Tests may bind `Bun.serve` on port 0 or spawn a local stub, never an outside host.
- Verify with `bun test <your paths>`; `bun check` must stay clean.
- Do as much as possible in one turn: batch independent calls, chain dependent steps, never yield.

## Task 30 — opencode spawn mode

Owns: `packages/core/src/funcs/opencode.ts`, `packages/core/test/opencode-spawn.test.ts`, `packages/cli/src/commands/oc.ts`, `packages/cli/test/oc-spawn.test.ts`.

The seam can talk to a server but cannot start one. Add opt-in spawn, keeping every existing export's signature:

- `spawnServer(opts: { command?: string; cwd: string }): Promise<{ pid: number; baseUrl: string; stop(): Promise<void> }>` — starts `command` (default `opencode`) in `cwd`, waits for the port it was told to use via `JYZ_OPENCODE_URL` or the default, gives up after a timeout with a typed error
- `spawnedServers()` lists PIDs jyz started in this process, so a test can assert cleanup
- the returned `stop()` kills only a server this process spawned and is idempotent; killing an unknown PID is a no-op, never a signal to an unrelated process
- `oc` grows `--spawn`, which spawns, runs the requested action, then stops in a `finally`

Tests: a stub script on `PATH` (not a real opencode) that opens a socket and prints readiness; spawn then list then stop leaves no PID; stop twice is safe; `--spawn` with a failing stub exits non-zero and reports the reason.

## Task 31 — MCP host walkthrough

Owns: `scripts/mcp-smoke.ts`, `scripts/test/mcp-smoke.test.ts`.

Prove the MCP server works from a host's side, not just from unit tests:

- `bun scripts/mcp-smoke.ts [--json]` spawns `bun packages/mcp/src/server.ts`, performs `initialize`, `tools/list`, one `tools/call` (`jyz_config` with action `path`), `resources/list` and `resources/read` on `jyz://capabilities`, then shuts the child down and prints a one-line verdict per step
- exit non-zero if any step errors or a response frame is malformed; `--json` prints the collected frames as one document
- export `runSmoke(cmd: string[], cwd: string): Promise<{ step: string; ok: boolean; detail: string }[]>` so the test can drive it with a scripted child
- the whole run has a hard timeout, and the child is always killed

Tests: `runSmoke` against the real server (fast, local) asserts five ok steps; a scripted child that returns a malformed frame yields one failed step and a non-zero verdict; the JSON shape is stable.

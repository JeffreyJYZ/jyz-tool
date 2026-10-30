## Task 30 — opencode spawn mode

Owns: `packages/core/src/funcs/opencode.ts`, `packages/core/test/opencode-spawn.test.ts`, `packages/cli/src/commands/oc.ts`, `packages/cli/test/oc-spawn.test.ts`.

The seam can talk to a server but cannot start one. Add opt-in spawn, keeping every existing export's signature:

- `spawnServer(opts: { command?: string; cwd: string }): Promise<{ pid: number; baseUrl: string; stop(): Promise<void> }>` — starts `command` (default `opencode`) in `cwd`, waits for the port it was told to use via `JYZ_OPENCODE_URL` or the default, gives up after a timeout with a typed error
- `spawnedServers()` lists PIDs jyz started in this process, so a test can assert cleanup
- the returned `stop()` kills only a server this process spawned and is idempotent; killing an unknown PID is a no-op, never a signal to an unrelated process
- `oc` grows `--spawn`, which spawns, runs the requested action, then stops in a `finally`

Tests: a stub script on `PATH` (not a real opencode) that opens a socket and prints readiness; spawn then list then stop leaves no PID; stop twice is safe; `--spawn` with a failing stub exits non-zero and reports the reason.

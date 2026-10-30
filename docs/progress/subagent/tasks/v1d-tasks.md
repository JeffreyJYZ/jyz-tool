---
updated: 202610301800
version: 1.0
---

# jyz v1d tasks — transports and create fixes

Three parallel tasks, disjoint paths. Controller owns `package.json`, `packages/core/src/index.ts`, `docs/**`, `.github/**`, `scripts/release*.ts` and every commit.

## Global Constraints

- Bun only; `.ts` specifiers, tabs 4 wide, printWidth 100, bun:test.
- Never edit `package.json`, `tsconfig.json`, `biome.json`, `bunfig.toml`, `.github/**`, `docs/**`, or another task's paths.
- No git commands, no commits, no subagents, no new dependencies, no network.
- Verify with `bun test <your paths>`; `bun check` must stay clean.
- Do as much as possible in one turn: batch independent calls, chain dependent steps, never yield.

## Task 16 — MCP stdio server

Owns: `packages/mcp/src/server.ts`, `packages/mcp/src/stdio.ts`, `packages/mcp/test/server.test.ts`.

Build on the existing handler layer (`packages/mcp/src/{tools,handler}.ts`) to speak MCP over newline-delimited JSON-RPC on stdio:

- `src/stdio.ts` — `serve({ read, write }, { cwd })` loop: reads one JSON object per line, dispatches, writes one JSON response per line, never throws on malformed input (responds with a JSON-RPC error object instead)
- implement `initialize` (returns `protocolVersion`, `capabilities.tools`, `serverInfo`), `tools/list`, `tools/call`, and `ping`; anything else returns `-32601 Method not found`
- `tools/call` validates the tool name, passes `input` to the handler, and returns content blocks of type `text` carrying JSON, plus `isError: true` when the handler threw
- `src/server.ts` — `startServer()` wiring `Bun.stdin`/`Bun.stdout` to `serve`, only when `import.meta.main`

Tests drive `serve` with an in-memory pipe: initialize handshake, tools/list count and shape, a successful tools/call, an unknown tool name, malformed JSON line, unknown method.

## Task 17 — create CLI fixes

Owns: `packages/cli/src/commands/create.ts`, `packages/cli/test/create-cli.test.ts`.

Two known defects in the CLI create path:

- `--install` currently installs twice when the core create already installed; make the CLI pass the flag through exactly once and never run its own install when `createProject` did
- `--git github` prints nothing about the created repository; print the URL the core layer reports (add a `repoUrl?: string` read from `CreateResult.warnings` if that is where it lands — do not change core)

Also make `--yes` non-interactive: with `--yes` and no `--template`, use `create.default_template` from config; without either, exit non-zero naming `--template`.

Tests: stub `bun`/`git`/`gh` on `PATH`, assert a single install invocation, that the github URL is printed, and that `--yes` picks the config default.

## Task 18 — CLI JSON-RPC serve mode and capability manifest

Owns: `packages/cli/src/rpc.ts`, `packages/cli/src/commands/serve.ts`, `packages/core/src/funcs/capabilities.ts`, `packages/core/test/capabilities.test.ts`, `packages/cli/test/rpc.test.ts`.

Give the desktop parity rule a real seam:

- `packages/core/src/funcs/capabilities.ts` — `listCapabilities(): Capability[]` where `Capability` is `{ name: string; kind: "dispatch" | "config" | "create" | "toolchain"; params: string[] }`, covering every verb the CLI registers, in a deterministic order
- `packages/cli/src/rpc.ts` — `createRpcServer({ cwd })` exposing `call(method, params)` where `method` is a capability name, returning `{ exitCode, argv?, stdout?, stderr? }`; unknown method throws with code `-32601`
- `packages/cli/src/commands/serve.ts` — registers a hidden `serve` command that reads newline-delimited JSON-RPC on stdin and writes responses on stdout, reusing `packages/desktop/src/rpc.ts` framing if importing it is cheap, otherwise its own framing
- the same capability list must be reachable from the CLI: a test asserting `listCapabilities()` covers every command name registered in `bin.ts`

Tests: capability list is non-empty, ordered, and covers the dispatch verbs; `createRpcServer().call("install", {})` on a fixture returns a spec with the detected package manager; unknown method rejects with `-32601`.

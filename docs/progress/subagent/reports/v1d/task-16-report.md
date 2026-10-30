# Task 16 — MCP stdio server

Status: done.

Files:

- packages/mcp/src/stdio.ts
- packages/mcp/src/server.ts
- packages/mcp/test/server.test.ts

## What landed

`src/stdio.ts` implements `serve({ read, write }, { cwd })`: newline-delimited JSON-RPC 2.0 over an injected stream pair, so tests drive it with an in-memory pipe. Framing helpers are local to the package (the desktop copy in `packages/desktop/src/rpc.ts` carries the same wire shape but is not a dependency). The loop buffers partial chunks, reassembles frames split across reads, handles a final unterminated line, and never throws on input: malformed JSON yields `-32700`, a non-object frame or a missing `jsonrpc`/`method` yields `-32600`, and an unknown method yields `-32601`.

Methods: `initialize` (returns `protocolVersion`, `capabilities.tools.listChanged`, `serverInfo`), `tools/list`, `tools/call`, `ping`. `initialize` echoes the client's protocol version when it is one of the supported set (`2024-11-05`, `2025-03-26`, `2025-06-18`) and otherwise answers the newest. `tools/list` maps `listTools()` onto the wire as `name`/`description`/`inputSchema` plus `annotations.destructiveHint`, as `docs/plan/agent/mcp.md` requires for confirmation-gated verbs.

`tools/call` accepts `params.name` plus `params.arguments` (also `params.input`, the brief's spelling). An unknown tool name is rejected before the handler runs, as a JSON-RPC `-32602` carrying `data.validNames`; a handler that throws becomes a normal result with `isError: true` and the error message as its text block. Successful results are one `text` block carrying `JSON.stringify(ToolResult)`.

`src/server.ts` exports `startServer(cwd)` binding `Bun.stdin.stream()` and `Bun.stdout` to `serve`, and starts only under `import.meta.main`.

## Tests

`bun test packages/mcp/test` — 15 pass, 0 fail (13 in `server.test.ts`): initialize handshake, protocol-version fallback, tools/list count and shape, a successful `tools/call` on a temp-dir fixture, a thrown handler reported as `isError`, unknown tool name, malformed JSON followed by a valid frame (loop survives), non-object frame, unknown method, ping, notification with no reply, a frame split across two chunks, and a final unterminated line.

`bun check` — no type errors in 67 files. `bun fmt --check` — all 145 files formatted. `biome check` on the three new files — clean.

Manual smoke against the real entry point:

```
printf ... | bun packages/mcp/src/server.ts
```

returns the initialize result, the 13-tool list, and a `-32601` for an unknown method.

## Concerns

- `packages/mcp/src/index.ts` does not re-export `serve` or `startServer`; the package entry point therefore exposes no server surface. That file is outside this task's ownership, so task 17 (or whichever owns the bin/export) needs to add it.
- `serverInfo.version` comes from `@jyz/core` (root `0.1.0-alpha.3`) while `packages/mcp/package.json` still says `0.1.0-alpha.2`. Version drift is pre-existing and out of scope here.
- No streaming tools, no resources, no cancellation: the brief scoped this task to the four methods, and the streaming tools in `docs/plan/agent/mcp.md` remain unbuilt.

## Task 16 — MCP stdio server

Owns: `packages/mcp/src/server.ts`, `packages/mcp/src/stdio.ts`, `packages/mcp/test/server.test.ts`.

Build on the existing handler layer (`packages/mcp/src/{tools,handler}.ts`) to speak MCP over newline-delimited JSON-RPC on stdio:

- `src/stdio.ts` — `serve({ read, write }, { cwd })` loop: reads one JSON object per line, dispatches, writes one JSON response per line, never throws on malformed input (responds with a JSON-RPC error object instead)
- implement `initialize` (returns `protocolVersion`, `capabilities.tools`, `serverInfo`), `tools/list`, `tools/call`, and `ping`; anything else returns `-32601 Method not found`
- `tools/call` validates the tool name, passes `input` to the handler, and returns content blocks of type `text` carrying JSON, plus `isError: true` when the handler threw
- `src/server.ts` — `startServer()` wiring `Bun.stdin`/`Bun.stdout` to `serve`, only when `import.meta.main`

Tests drive `serve` with an in-memory pipe: initialize handshake, tools/list count and shape, a successful tools/call, an unknown tool name, malformed JSON line, unknown method.

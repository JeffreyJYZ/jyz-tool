## Task 25 — MCP resources over stdio

Owns: `packages/mcp/src/stdio.ts`, `packages/mcp/src/server.ts`, `packages/mcp/test/resources-stdio.test.ts`.

`packages/mcp/src/resources.ts` already exposes `listResources()` and `readResource(uri)`; the stdio loop does not serve them yet.

- `resources/list` returns `{ resources: [{ uri, name, description, mimeType }] }`
- `resources/read` takes `{ uri }` and returns `{ contents: [{ uri, mimeType, text }] }`, mapping an unknown URI to a JSON-RPC error with code `-32602` and the message from the typed error
- `initialize` advertises `capabilities.resources = { listChanged: false }`
- malformed params (missing `uri`, wrong type) return `-32602`, never throw out of the loop

Tests: an in-memory pipe drives list then read for both URIs, an unknown URI, and a malformed request; the loop stays alive after each error.

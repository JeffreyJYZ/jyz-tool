## Task 21 — MCP streaming tools and resources

Owns: `packages/mcp/src/{tools,handler}.ts`, `packages/mcp/src/resources.ts`, `packages/mcp/test/{tools,streaming,resources}.test.ts`.

Extend the existing layer:

- streaming tools: `jyz_watch` (runs a script and streams output) and `jyz_cancel`, declared with `streaming: true` and a `handle` in the schema; the handler layer returns a handle immediately and emits frames through an injected `onProgress` callback supplied in the call options
- `src/resources.ts`: `listResources()` and `readResource(uri)` exposing `jyz://config` (the merged config with source layers, as JSON text) and `jyz://capabilities` (the capability manifest)
- handler options grow to `{ cwd, onProgress?, signal? }` without breaking the existing two-argument call shape

Tests: streaming start emits at least one progress frame and cancel stops the child; resources list contains both URIs; reading `jyz://config` returns parseable JSON with a `project` key; unknown URI throws a typed error.

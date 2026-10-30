## Task 18 — CLI JSON-RPC serve mode and capability manifest

Owns: `packages/cli/src/rpc.ts`, `packages/cli/src/commands/serve.ts`, `packages/core/src/funcs/capabilities.ts`, `packages/core/test/capabilities.test.ts`, `packages/cli/test/rpc.test.ts`.

Give the desktop parity rule a real seam:

- `packages/core/src/funcs/capabilities.ts` — `listCapabilities(): Capability[]` where `Capability` is `{ name: string; kind: "dispatch" | "config" | "create" | "toolchain"; params: string[] }`, covering every verb the CLI registers, in a deterministic order
- `packages/cli/src/rpc.ts` — `createRpcServer({ cwd })` exposing `call(method, params)` where `method` is a capability name, returning `{ exitCode, argv?, stdout?, stderr? }`; unknown method throws with code `-32601`
- `packages/cli/src/commands/serve.ts` — registers a hidden `serve` command that reads newline-delimited JSON-RPC on stdin and writes responses on stdout, reusing `packages/desktop/src/rpc.ts` framing if importing it is cheap, otherwise its own framing
- the same capability list must be reachable from the CLI: a test asserting `listCapabilities()` covers every command name registered in `bin.ts`

Tests: capability list is non-empty, ordered, and covers the dispatch verbs; `createRpcServer().call("install", {})` on a fixture returns a spec with the detected package manager; unknown method rejects with `-32601`.

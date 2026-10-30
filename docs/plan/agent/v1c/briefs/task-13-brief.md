## Task 13 — desktop JSON-RPC client

Owns: `packages/desktop/src/**`, `packages/desktop/test/**`.

Replace the framing stub with a working transport-agnostic client:

- `src/rpc.ts` exports `encodeRequest(req)`, `decodeMessage(line)`, `createClient({ read, write })` where `read`/`write` are injected stream functions, returning `{ call(method, params, { timeoutMs }): Promise<unknown>; close(): void }`
- newline-delimited JSON-RPC 2.0; ids correlate request to response; a response carrying `error` rejects with a typed `RpcError` holding `code` and `message`; a timeout rejects and marks the pending id dead
- a late response for an unknown id is dropped, not thrown
- no Tauri dependency, no process spawning, no side effects

Tests: round-trip through an in-memory fake pipe; two concurrent calls resolve to their own results out of order; error response rejects with code preserved; timeout rejects; unknown-id response is ignored.

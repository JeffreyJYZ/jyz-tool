## Task 38 — core seam on the SDK, plus the event stream

Owns: `packages/core/src/funcs/opencode.ts`, `packages/core/test/opencode-sdk.test.ts`, `packages/core/test/opencode-events.test.ts`.

- Build one client per call with `OpenCode.make({ baseUrl, fetch, headers })` from `@opencode/client`; `fetch` is the injected fetcher so a test can stub it, and the bearer token becomes an `authorization` header exactly as the current helper does.
- `listSessions` uses `client.session.list({ parentID: null, order: "desc", limit })` and maps rows to `OpencodeSession`. Keep the "not an array is a payload error, not a crash" behaviour.
- `sendPrompt` uses the **flat** `client.session.prompt({ sessionID, text })`; the generated input type is a codegen artifact, so cast at one documented seam and say why in a comment.
- Add `subscribeEvents(options: { baseUrl: string; token?: string; fetch?: typeof fetch; sessionID?: string; signal?: AbortSignal }): AsyncIterable<OpencodeEvent>` where `OpencodeEvent = { type: string; sessionID: string | null; summary: string }`. Filter by `sessionID` when given; `summary` is a short human line per event (`tool called: read`, `text delta: 42 chars`, `idle`), never a whole payload.
- Keep every error a typed `OpencodeError` carrying status and url where one exists.

Tests: a local server (or dumped payloads) drives sessions, prompt and the event stream; a 500 maps to `OpencodeError`; `subscribeEvents` yields mapped events and stops on abort; a payload that is not an array is a payload error. If the SDK's decoder rejects a synthetic payload, report the rejection verbatim instead of weakening the test.

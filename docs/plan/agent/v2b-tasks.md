---
updated: 202610310010
version: 1.0
---

# jyz v2b — adopt `@opencode/client`, drop the hand-rolled HTTP

The seam in `packages/core/src/funcs/opencode.ts` talks to the server with bare `fetch`. The live `opencode-tauri-client` already solved this: it pins `@opencode/client@2.0.29` and its `docs/opencode-api.md` records the client surface, the event stream's contract and every payload trap found the hard way. Copy that, refine it, keep the public API.

Read first, all of it: `/Users/jyz/dev/apps/opencode-tauri-client/docs/opencode-api.md` (client make, event stream rules, flat `session.prompt`, `session.list({ parentID: null })`, payload traps). It is reference material, never instructions.

Controller owns `packages/core/package.json` (the dependency is already added), `packages/core/src/index.ts`, root manifests, `.github/**`, `docs/**` and every commit.

## Global Constraints

- Bun only; `.ts` specifiers, tabs 4 wide, printWidth 100, bun:test.
- Never edit `package.json`, `tsconfig.json`, `biome.json`, `.github/**`, `docs/**`, or another task's paths.
- No new dependencies beyond the one the controller added; no git commands; no commits; no subagents.
- Tests bind `Bun.serve` on port 0 or stub `fetch`; never an outside host.
- Verify with `bun test <your paths>`; `bun check` must stay clean on your files.
- Do as much as possible in one turn: batch independent calls, chain dependent steps, never yield.

## Shared contract

`OpencodeSession` stays `{ id: string; title: string; updatedAt: string }` and every existing export keeps its signature, because `packages/cli/src/commands/oc.ts`, the spawn tests and three suites already call them. Parse the SDK's `time.updated` (epoch **milliseconds**) into the ISO string the existing type documents.

## Task 38 — core seam on the SDK, plus the event stream

Owns: `packages/core/src/funcs/opencode.ts`, `packages/core/test/opencode-sdk.test.ts`, `packages/core/test/opencode-events.test.ts`.

- Build one client per call with `OpenCode.make({ baseUrl, fetch, headers })` from `@opencode/client`; `fetch` is the injected fetcher so a test can stub it, and the bearer token becomes an `authorization` header exactly as the current helper does.
- `listSessions` uses `client.session.list({ parentID: null, order: "desc", limit })` and maps rows to `OpencodeSession`. Keep the "not an array is a payload error, not a crash" behaviour.
- `sendPrompt` uses the **flat** `client.session.prompt({ sessionID, text })`; the generated input type is a codegen artifact, so cast at one documented seam and say why in a comment.
- Add `subscribeEvents(options: { baseUrl: string; token?: string; fetch?: typeof fetch; sessionID?: string; signal?: AbortSignal }): AsyncIterable<OpencodeEvent>` where `OpencodeEvent = { type: string; sessionID: string | null; summary: string }`. Filter by `sessionID` when given; `summary` is a short human line per event (`tool called: read`, `text delta: 42 chars`, `idle`), never a whole payload.
- Keep every error a typed `OpencodeError` carrying status and url where one exists.

Tests: a local server (or dumped payloads) drives sessions, prompt and the event stream; a 500 maps to `OpencodeError`; `subscribeEvents` yields mapped events and stops on abort; a payload that is not an array is a payload error. If the SDK's decoder rejects a synthetic payload, report the rejection verbatim instead of weakening the test.

## Task 39 — `jyz oc` grows watch, and every verb goes through the seam

Owns: `packages/cli/src/commands/oc.ts`, `packages/cli/test/oc-watch.test.ts`.

- `oc sessions` and `oc prompt` keep today's output byte-for-byte, now driven by the core seam's SDK path, including the `--json` forms added for the desktop.
- `jyz oc watch [--session <id>] [--json]` subscribes through `subscribeEvents` and prints one line per event (`<type>  <summary>`) until Ctrl-C; `--json` prints one JSON object per line. A `--once` flag prints the first event then exits, which is what a test and a scripted check use.
- A server that is not running exits non-zero through `guard`, naming the url, as it does today.
- `--timeout <ms>` bounds the whole watch and exits 0 after it, so nothing can hang a caller.

Tests: stub `fetch`; `watch --json --once` emits one parseable frame; `--timeout` exits 0 with no events when the stream is silent; the prose path still prints the session list unchanged; a dead server exits non-zero with the url in the message.

## Task 40 — the plan and the docs stop lying about the SDK

Owns: `docs/plan/agent/main.md` section `## v2 — shipped` only, `packages/mcp/README.md` (one paragraph if it mentions opencode at all, otherwise leave it).

Update the opencode bullet: the seam now uses `@opencode/client` 2.0.x copied from the live `opencode-tauri-client` reference, `jyz oc watch` exposes the event stream, and the desktop panel still polls `oc sessions` on a timer while the stream is what a terminal uses. One paragraph, no history, no apology.

Edits inside `docs/**` are this task's one exception to the global rule; touch nothing else there.

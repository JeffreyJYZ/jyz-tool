## Task 22 — opencode client seam

Owns: `packages/core/src/funcs/opencode.ts`, `packages/core/test/opencode.test.ts`, `packages/cli/src/commands/oc.ts`, `packages/cli/test/oc.test.ts`.

The plan's opencode integration needs a seam before it needs a UI. Build the seam only — no SDK dependency, no spawning.

- `funcs/opencode.ts` exports:
    - `resolveServer(opts?: { url?: string; env?: Record<string, string | undefined> }): { baseUrl: string; token?: string; source: "flag" | "env" | "default" }` reading `JYZ_OPENCODE_URL` / `JYZ_OPENCODE_TOKEN`, defaulting to `http://127.0.0.1:4096`
    - `listSessions(baseUrl: string, fetcher?: typeof fetch): Promise<OpencodeSession[]>` hitting `/session` and mapping to `{ id: string; title: string; updatedAt: string }`, throwing `OpencodeError` with the status on a non-2xx
    - `sendPrompt(baseUrl: string, sessionId: string, text: string, fetcher?: typeof fetch): Promise<{ ok: true }>` posting to `/session/{id}/message`, throwing `OpencodeError` on failure
    - `class OpencodeError extends Error` with `status?: number` and `url: string`
- `commands/oc.ts` exports `registerOc(cli: CAC): void` with `oc sessions` and `oc prompt <text> --session <id>`, both printing concise human output and exiting non-zero with the error message on failure; the command is hidden from the main list like `serve`

Tests: `resolveServer` precedence per layer; `listSessions` against a `Bun.serve` fake returning fixtures; a 500 response throws `OpencodeError` carrying the status; `sendPrompt` posts the expected JSON body; CLI registration test asserts both subcommands exist.

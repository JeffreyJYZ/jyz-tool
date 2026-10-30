## Task 35 — desktop screens: runner, config viewer, opencode panel

Owns: `packages/desktop/ui/index.html`, `packages/desktop/src/screens.ts`, `packages/desktop/test/screens.test.ts`.

The window is one form and a result pane. Give it three screens behind a tab strip, all of them sending their work through the existing bridge (`jyz_call` for capabilities, `jyz_oc` for opencode) and all of their shaping in `screens.ts` so bun:test reaches it:

1. **Call** — today's runner, unchanged in behaviour: method picker from `jyz_capabilities`, params box, result pane.
2. **Config** — runs `config` with `{"action":"show"}` on load and on a Refresh button, then renders the returned `stdout` as a table of key, value and source. No params box on this screen.
3. **opencode** — lists sessions via `jyz_oc(["sessions","--json"])`, lets a person pick one, type a prompt and send it via `jyz_oc(promptArgv(session, text))`, and keeps a watch ticker: poll the session list every 5 s while the screen is visible, diff against the previous list and mark changed or new session ids. A stopped server must read as a one-line message, not a stack.

`screens.ts` exports, all pure and tested:

- `configRows(stdout: string): { key: string; value: string; source: string }[]` — parses `key = value (source)` lines and skips `config:`, `layer:`, `warning:`, `aliases:`, `scripts:`.
- `sessionRows(json: string): { id: string; title: string; updatedAt: string }[]` — tolerant: bad JSON or a non-array is `[]`.
- `diffSessions(previous: SessionRow[], next: SessionRow[]): string[]` — ids that are new or whose title or updatedAt changed, in `next` order.
- `promptArgv(session: string, text: string): string[]` → `["prompt", text, "--session", session, "--json"]`.
- `screenFromHash(hash: string): Screen` and `screenHref(screen: Screen): string` so the tab strip is addressable and the mapping is testable.

Keep the dark theme and the existing CSS vocabulary; the page stays framework-free, one `<script>`, no bundler. `bridge.ts` and `rpc.ts` are not yours.

Tests: each helper on its happy path and its malformed input; `diffSessions` for new, changed, unchanged and reordered lists; `screenFromHash` for every screen and for junk.

## Task 48 — the window runs, and the panel streams

Owns: `packages/desktop/ui/index.html`, `packages/desktop/src/run.ts` (new), `packages/desktop/test/run.test.ts` (new).

- `src/run.ts` exports `runSummary(result: { exitCode: number; stdout?: string; stderr?: string; argv?: string[] }): { state: "ok" | "error"; text: string }` — `ok` only for exit code 0, `text` carrying the argv line, stdout and any stderr; and `eventLines(text: string): { type: string; summary: string }[]` parsing the JSON-lines output of `oc watch`, tolerating blank lines and junk.
- The Call screen grows one visible **Run it** checkbox (off by default). With it on, the result pane renders through `runSummary` instead of printing the resolver envelope, and the button reads `Run` either way — the toggle decides whether the command happens.
- The opencode screen replaces its 5 s full poll with a bounded read: every 5 s call `jyz_oc(["watch", "--timeout", "4000", "--json"])`, append what came back through `eventLines` into a scrolling list, and keep listing sessions through the same screen's existing path. A dead server reads as one line, not a stack.
- Keep the page framework-free, one `<script>`, the dark theme and existing CSS.

Tests: `runSummary` for success, non-zero, missing stdout, and a stderr-only failure; `eventLines` for two good lines, one junk line, and empty input.

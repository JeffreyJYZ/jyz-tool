## Task 39 — `jyz oc` grows watch, and every verb goes through the seam

Owns: `packages/cli/src/commands/oc.ts`, `packages/cli/test/oc-watch.test.ts`.

- `oc sessions` and `oc prompt` keep today's output byte-for-byte, now driven by the core seam's SDK path, including the `--json` forms added for the desktop.
- `jyz oc watch [--session <id>] [--json]` subscribes through `subscribeEvents` and prints one line per event (`<type>  <summary>`) until Ctrl-C; `--json` prints one JSON object per line. A `--once` flag prints the first event then exits, which is what a test and a scripted check use.
- A server that is not running exits non-zero through `guard`, naming the url, as it does today.
- `--timeout <ms>` bounds the whole watch and exits 0 after it, so nothing can hang a caller.

Tests: stub `fetch`; `watch --json --once` emits one parseable frame; `--timeout` exits 0 with no events when the stream is silent; the prose path still prints the session list unchanged; a dead server exits non-zero with the url in the message.

## Task 37 — `oc` speaks JSON

Owns: `packages/cli/src/commands/oc.ts`, `packages/cli/test/oc-json.test.ts`.

`oc` prints for humans only, so the desktop cannot read it. Add an opt-in `--json` that never changes the prose path:

- `jyz oc sessions --json` prints the array in the shared contract shape, one compact document, and nothing else on stdout.
- `jyz oc prompt <text> --session <id> --json` prints `{"session": "<id>", "sent": true}`.
- without `--json`, output is byte-for-byte what it is today.
- errors keep going through `guard`, with a non-zero exit and the message on stderr, in both modes.

Tests stub `fetch` (no real server): the JSON array shape and field names, the prompt envelope, the prose path unchanged, and a failing request producing a non-zero exit with no partial JSON on stdout.

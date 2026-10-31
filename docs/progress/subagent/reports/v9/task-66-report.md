# Task 66 report

Split `scripts/mcp-smoke.ts` into modules under `scripts/smoke/`:

- `types.ts` — `SmokeStep`, `TIMEOUT_MS`
- `read-line.ts` — `readLine`
- `steps.ts` — per-step functions
- `runner.ts` — `runSmoke`

`scripts/mcp-smoke.ts` is now a thin entrypoint re-exporting `runSmoke`/`SmokeStep` and running `main`. Behaviour unchanged; still drives initialize, tools/list, tools/call, resources/list, resources/read, watch and cancel and prints the same verdict.

Removed `scripts/mcp-smoke.ts` from `docs/refactor/oversized.txt`.

Verification:

- `bun scripts/mcp-smoke.ts`: 7 steps, all ok, exit 0.
- `bun test scripts/test`: 77 pass, 0 fail.
- `bun run size`: 0 new oversized; 3 pre-existing remain.
- `bun check`: no type errors.
- `bun run lint`: scripts clean; pre-existing release-script lint errors remain.
- `bun fmt --check`: scripts clean; 2 pre-existing broken test files remain.

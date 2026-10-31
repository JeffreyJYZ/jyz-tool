# Task 58 report

Split `packages/core/src/funcs/opencode.ts` (435 lines) into modules under `packages/core/src/funcs/opencode/`.

New file line counts:

- `index.ts`: 3
- `shared.ts`: 145
- `sessions.ts`: 169
- `spawn.ts`: 111

All exports preserved via barrel. `opencode.ts` removed; imports updated in `index.ts`, `oc.ts`, tests. Removed from `docs/refactor/oversized.txt`.

Gates: `bun test packages/core/test packages/cli/test` (238 pass), `bun check` (no errors), `bun fmt --check` (only pre-existing rpc/* files), `bun run lint` (no errors on changed files). `bun run size` still reports pre-existing untracked `packages/cli/src/rpc/server.ts`.

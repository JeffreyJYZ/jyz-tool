# Task 56 report

Split `packages/core/src/funcs/config.ts` (799 lines) into modules under `packages/core/src/funcs/config/`.

## New files

- `packages/core/src/funcs/config.ts` (11 lines) — barrel re-export
- `packages/core/src/funcs/config/constants.ts` (60 lines)
- `packages/core/src/funcs/config/errors.ts` (17 lines)
- `packages/core/src/funcs/config/find.ts` (27 lines)
- `packages/core/src/funcs/config/helpers.ts` (151 lines)
- `packages/core/src/funcs/config/index.ts` (6 lines)
- `packages/core/src/funcs/config/load.ts` (155 lines)
- `packages/core/src/funcs/config/read.ts` (138 lines)
- `packages/core/src/funcs/config/write.ts` (102 lines)
- `packages/core/src/funcs/config/write-utils.ts` (199 lines)
- `packages/core/src/funcs/config/write-verify.ts` (70 lines)

## Verification

- `bun test packages/core/test`: 160 pass
- `bun check`: clean
- `bun run size`: 16 oversized remain, no new/stale
- `bun run lint`: clean
- `bun fmt --check`: clean

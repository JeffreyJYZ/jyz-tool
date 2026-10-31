# Task 59 report

Split `packages/cli/src/rpc.ts` into modules under `packages/cli/src/rpc/`.

New file line counts:

- `packages/cli/src/rpc.ts` (barrel): 6
- `packages/cli/src/rpc/errors.ts`: 18
- `packages/cli/src/rpc/framing.ts`: 70
- `packages/cli/src/rpc/server.ts`: 145
- `packages/cli/src/rpc/config.ts`: 62
- `packages/cli/src/rpc/params.ts`: 46
- `packages/cli/src/rpc/serve.ts`: 62

All exports preserved. Gates green.

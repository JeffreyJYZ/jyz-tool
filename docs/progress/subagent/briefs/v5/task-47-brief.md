## Task 47 — `serve --execute`

Owns: `packages/cli/src/commands/serve.ts`, `packages/cli/src/rpc.ts`, `packages/cli/test/serve-execute.test.ts` (new), `scripts/test/capability-parity.test.ts` is not yours.

- `createRpcServer({ cwd, execute })`: when `execute` is false, behaviour is byte-identical to today.
- When true, `dispatch` and `toolchain` capabilities run their resolved argv with `Bun.spawn`, capped at 60 s, stdin closed, and answer `{ exitCode, stdout, stderr, argv }`. `config` and `create` keep their resolver answers — a config read never needs a child, and `create` must stay a shown command.
- A child that fails to start answers `exitCode: 127` with the reason in `stderr`, never a thrown error.
- `serve.ts` grows `--execute`; a malformed flag value is ignored, not a crash.
- A capability the server does not know still answers `-32601`, with or without `--execute`.

Tests: with `execute: false` a dispatch answer carries `argv` and no `stdout`; with `execute: true` a harmless command (e.g. a node/bun script printing one line) answers its exit code and output; a non-zero child reports that code; the timeout path is exercised with a stub that sleeps (keep it under a second by making the timeout injectable, e.g. `createRpcServer({ timeoutMs })`).

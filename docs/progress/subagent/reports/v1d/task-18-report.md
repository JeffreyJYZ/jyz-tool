# Task 18 — CLI JSON-RPC serve mode and capability manifest

## Status

Complete. All five owned files are on disk; the suite, `bun check` and `biome check` are green.

## Files

- `packages/core/src/funcs/capabilities.ts` — `Capability`, `CapabilityKind`, `listCapabilities()` and `findCapability()`. Thirteen entries in registration order: `config`, `create`, the seven dispatch verbs, then `lint`, `typecheck`, `check`, `fmt`. Each call returns fresh copies, so a caller cannot rewrite the manifest.
- `packages/cli/src/rpc.ts` — `createRpcServer({ cwd })` with `call(method, params)` and `capabilities()`, plus `RpcError`, the JSON-RPC codes, NDJSON `encodeFrame` / `decodeFrame` / `splitFrames`, and `serveStdio(server, options)`.
- `packages/cli/src/commands/serve.ts` — `registerServe(cli)`: the `serve` command with `--cwd <dir>`, kept out of the help body.
- `packages/core/test/capabilities.test.ts` — non-empty, fixed order, dispatch coverage, well formed entries, defensive copies.
- `packages/cli/test/rpc.test.ts` — manifest covers every command the four registrars add; `serve` registered but hidden; `install` on a bun fixture and `add --dev` on a pnpm fixture resolve through the detected manager; unknown method rejects with `-32601`; config read and user error; frame round trip; `serveStdio` across split chunks, notification skipped, `-32601` and `-32700` frames.

## Tests

`bun test packages/core/test packages/cli/test` — 164 pass, 0 fail across 20 files; `bun check` reports no type errors in 72 files; `biome check` on the owned files exits 0.

## Concerns

- `packages/core/src/index.ts` was out of scope, so `listCapabilities` and `Capability` are not re-exported from `@jyz/core`. The CLI and the CLI test import the deep path `../../core/src/funcs/capabilities.ts`. The controller should add the export beside `buildArgv`; the deep import can then become `@jyz/core`.
- `packages/cli/src/bin.ts` does not register `serve` yet. It needs `import { registerServe } from "./commands/serve.ts"` and a `registerServe(cli)` call beside the other registrars. Verified separately that cac matches `serve` once the registrar runs (`cli.parse([...], { run: false })` gives `matchedCommand.name === "serve"`).
- The frame helpers are duplicated from `packages/desktop/src/rpc.ts` rather than imported: the CLI has no dependency on the desktop package, and adding one would invert the layering (desktop consumes the CLI). The wire shape is identical, one JSON-RPC 2.0 object per line.
- `serve` is deliberately not a capability. The kind union is the four user-facing groups, and the coverage test asserts the commands the four user-facing registrars add, then asserts separately that `serve` is registered and hidden. If the controller wants `serve` in the manifest, the kind union needs a fifth member and the coverage test loses its carve-out.
- `call` resolves and never spawns. Dispatch and toolchain capabilities answer the exact child `argv`; config capabilities answer the text the CLI prints; `create` answers the equivalent `jyz create …` invocation instead of scaffolding. This is deliberate, so a stray or replayed frame cannot install dependencies or write a project. A client that wants the effect spawns the returned command.
- `check` resolves to two commands and a frame carries one `argv`, so a two-half `check` reports `typecheck: …` and `lint: …` lines on `stdout` and sets `argv` only when one half applies. `RpcResult` has no field for a command list.
- The config capability repeats the action dispatch that `commands/config.ts` keeps private and prints directly; those files were out of scope. `config set` is included and writes the file through `writeConfigValue` and `writeFileSync`.
- `cac` 7 has no hidden-command flag, so `registerServe` patches `cli.outputHelp` and narrows `cli.commands` for the duration of that render. The patch is installed once per CLI and filters by command identity, so a later hidden command stays additive.
- User errors arrive as `{ exitCode: 1, stderr }`, matching what the CLI prints; only protocol faults throw `RpcError` (`-32601` unknown method, `-32602` bad params). A malformed line is answered with `-32700` on the wire instead of ending the loop.
- Repo-wide `bun fmt --check` fails on `docs/progress/log/2026-10-30-v1-ledger.md`, which is not an owned file and was already unformatted. `bun run lint` exits 0 with pre-existing warnings elsewhere in the tree.

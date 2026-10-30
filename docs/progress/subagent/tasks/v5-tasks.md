---
updated: 202610311100
version: 1.0
---

# jyz v5 — the window can act

The desktop is a viewer today: `jyz serve` resolves a capability to argv and the page prints it. Phase 4 makes it execute, and makes the opencode panel read the stream instead of guessing on a timer.

Two tasks, disjoint paths. Controller owns root manifests, `docs/**`, `packages/cli/src/bin.ts`, `packages/desktop/src-tauri/**` and every commit.

## Global Constraints

- Bun only; `.ts` specifiers, tabs 4 wide, printWidth 100, bun:test.
- Never edit `package.json`, `tsconfig.json`, `biome.json`, `.github/**`, `docs/**`, or another task's paths.
- No new dependencies. No git commands, no commits, no subagents, no network in tests.
- Verify with `bun test <your paths>`; `bun check` must stay clean on your files.
- Do as much as possible in one turn: batch independent calls, chain dependent steps, never yield.

## Shared contract

- `jyz serve --execute` is opt-in and off by default. With it, one `call` **runs** the resolved argv and answers `{ exitCode, stdout, stderr, argv }`; without it, the answer is exactly today's resolver result.
- Execution is bounded: a 60 s timeout kills the child, and the child gets no stdin.
- The page calls `invoke("jyz_call", { method, params, execute })`; `execute` defaults to false, and the Rust command appends `--execute` to the `jyz serve` argv only when it is true.
- opencode events reach the page through `invoke("jyz_oc", { args })`; a bounded read is `["watch", "--timeout", "3000", "--json"]`, which prints one JSON object per line.

## Task 47 — `serve --execute`

Owns: `packages/cli/src/commands/serve.ts`, `packages/cli/src/rpc.ts`, `packages/cli/test/serve-execute.test.ts` (new), `scripts/test/capability-parity.test.ts` is not yours.

- `createRpcServer({ cwd, execute })`: when `execute` is false, behaviour is byte-identical to today.
- When true, `dispatch` and `toolchain` capabilities run their resolved argv with `Bun.spawn`, capped at 60 s, stdin closed, and answer `{ exitCode, stdout, stderr, argv }`. `config` and `create` keep their resolver answers — a config read never needs a child, and `create` must stay a shown command.
- A child that fails to start answers `exitCode: 127` with the reason in `stderr`, never a thrown error.
- `serve.ts` grows `--execute`; a malformed flag value is ignored, not a crash.
- A capability the server does not know still answers `-32601`, with or without `--execute`.

Tests: with `execute: false` a dispatch answer carries `argv` and no `stdout`; with `execute: true` a harmless command (e.g. a node/bun script printing one line) answers its exit code and output; a non-zero child reports that code; the timeout path is exercised with a stub that sleeps (keep it under a second by making the timeout injectable, e.g. `createRpcServer({ timeoutMs })`).

## Task 48 — the window runs, and the panel streams

Owns: `packages/desktop/ui/index.html`, `packages/desktop/src/run.ts` (new), `packages/desktop/test/run.test.ts` (new).

- `src/run.ts` exports `runSummary(result: { exitCode: number; stdout?: string; stderr?: string; argv?: string[] }): { state: "ok" | "error"; text: string }` — `ok` only for exit code 0, `text` carrying the argv line, stdout and any stderr; and `eventLines(text: string): { type: string; summary: string }[]` parsing the JSON-lines output of `oc watch`, tolerating blank lines and junk.
- The Call screen grows one visible **Run it** checkbox (off by default). With it on, the result pane renders through `runSummary` instead of printing the resolver envelope, and the button reads `Run` either way — the toggle decides whether the command happens.
- The opencode screen replaces its 5 s full poll with a bounded read: every 5 s call `jyz_oc(["watch", "--timeout", "4000", "--json"])`, append what came back through `eventLines` into a scrolling list, and keep listing sessions through the same screen's existing path. A dead server reads as one line, not a stack.
- Keep the page framework-free, one `<script>`, the dark theme and existing CSS.

Tests: `runSummary` for success, non-zero, missing stdout, and a stderr-only failure; `eventLines` for two good lines, one junk line, and empty input.

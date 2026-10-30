---
updated: 202610302100
version: 1.0
---

# jyz v1g — machine-readable output

One task. Controller owns `package.json`, `packages/cli/src/bin.ts`, `packages/cli/src/lib/verbs.ts`, `docs/**` and every commit.

## Global Constraints

- Bun only; `.ts` specifiers, tabs 4 wide, printWidth 100, bun:test.
- Never edit `package.json`, `tsconfig.json`, `biome.json`, `.github/**`, `docs/**`, or `packages/cli/src/commands/{serve,oc}.ts`.
- No git commands, no commits, no subagents, no new dependencies.
- Verify with `bun test packages/cli/test`; `bun check` must stay clean.
- Do as much as possible in one turn: batch independent calls, chain dependent steps, never yield.

## Task 24 — `--json` output mode

Owns: `packages/cli/src/lib/output.ts`, `packages/cli/src/commands/{config,dispatch,create,toolchain}.ts`, `packages/cli/src/lib/{run,dispatch,config-view}.ts`, `packages/cli/test/json.test.ts`.

Every command currently prints prose. Add one opt-in machine mode that agents and the desktop can consume without scraping:

- `packages/cli/src/lib/output.ts` exports `isJson(argv: string[]): boolean`, `emit(value: unknown): void` (single `JSON.stringify(value, null, 2)` line to stdout) and `emitList(rows: Record<string, unknown>[]): void`
- `--json` is accepted by `config show|get|path|check`, all dispatch verbs, `create`, and `lint|typecheck|check|fmt`
- with `--json`, stdout carries exactly one JSON document and nothing else; human text moves to stderr or is dropped; exit codes are unchanged
- `config show` emits `{ project: { key: { value, source } }, aliases, scripts, path, layers, warnings }`
- dispatch verbs emit `{ verb, argv, cwd, packageDir, exitCode, stdout?, stderr? }` (captured when `--json`, since prose would corrupt the document)
- `create` emits `{ dir, files, warnings }`; toolchain verbs emit `{ commands: [{file, argv, cwd}], exitCode }`
- a failure still emits one JSON document with `error` and `exitCode`, then exits non-zero

Tests: `--json` accepted per command family; the emitted text parses as JSON and has the documented keys; failure path emits a parseable error document; without `--json` output is unchanged.

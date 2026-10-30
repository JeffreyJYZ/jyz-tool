---
updated: 202610301720
version: 1.0
---

# jyz v2 seams — wave 3

Four independent tasks, disjoint paths, all parallel with wave 2. Controller owns `package.json`, `packages/core/src/index.ts`, `docs/**`, `.github/**` and every commit.

## Global Constraints

- Bun only. TypeScript with `.ts` specifiers, tabs 4 wide, printWidth 100.
- Tests use `bun:test`; verify with `bun test <your paths>`.
- Never edit `package.json`, `tsconfig.json`, `biome.json`, `bunfig.toml`, `.github/**`, `docs/**`, or another task's paths.
- No git commands, no commits, no subagents, no new dependencies, no network.
- `jyz` is linked globally and runs the working tree.
- Do as much as possible in one turn: batch independent calls, chain dependent steps, never yield between them.

## Task 12 — MCP server over the core API

Owns: `packages/mcp/src/**`, `packages/mcp/test/**`.

`packages/mcp/package.json` already exists and depends on `@jyz/core`. Build a transport-free MCP handler layer:

- `src/tools.ts` exports `listTools(): ToolDefinition[]` — one tool per core capability (`jyz_install`, `jyz_add`, `jyz_remove`, `jyz_run`, `jyz_exec`, `jyz_update`, `jyz_outdated`, `jyz_create`, `jyz_config`, `jyz_typecheck`, `jyz_lint`, `jyz_check`, `jyz_fmt`), each with `name`, `description`, `inputSchema` (plain JSON Schema object) and `destructive: boolean`
- `src/handler.ts` exports `callTool(name: string, input: unknown, cwd: string): Promise<ToolResult>` returning structured data — `exitCode`, `argv`, `packageDir`, `stdout`, `stderr` — never scraped human text; `jyz_config` supports `show|get|set|check` via an `action` field; unknown tool names throw a typed error listing valid names
- resolution goes through core: `resolveProject`, `buildArgv`, `runCommand`, `buildCheckCommand`, `createProject`
- `src/index.ts` re-exports both

Tests: tool list covers every core dispatch verb exactly once; `callTool` on a fixture with a stub package manager records the same argv the CLI builds; unknown tool throws naming valid tools; `jyz_config` action routing.

## Task 13 — desktop JSON-RPC client

Owns: `packages/desktop/src/**`, `packages/desktop/test/**`.

Replace the framing stub with a working transport-agnostic client:

- `src/rpc.ts` exports `encodeRequest(req)`, `decodeMessage(line)`, `createClient({ read, write })` where `read`/`write` are injected stream functions, returning `{ call(method, params, { timeoutMs }): Promise<unknown>; close(): void }`
- newline-delimited JSON-RPC 2.0; ids correlate request to response; a response carrying `error` rejects with a typed `RpcError` holding `code` and `message`; a timeout rejects and marks the pending id dead
- a late response for an unknown id is dropped, not thrown
- no Tauri dependency, no process spawning, no side effects

Tests: round-trip through an in-memory fake pipe; two concurrent calls resolve to their own results out of order; error response rejects with code preserved; timeout rejects; unknown-id response is ignored.

## Task 14 — monorepo and path edge-case tests

Owns: `packages/core/test/monorepo.test.ts`, `packages/core/test/paths.test.ts`.

Write tests only; if a test exposes a real bug, report it in the report file instead of editing sources.

- nested monorepos: root config applies, member config overrides `[project]`, member inherits root `[aliases]`
- `-F` matching by directory name and by `package.json` name, plus zero-match and multi-match errors listing candidates
- a package nested three levels deep resolves to itself, not to the repo root
- paths with spaces and unicode resolve correctly through `resolveProject`, `findConfigPath` and `buildArgv`
- `node_modules/.bin` lookup walks up across workspace boundaries

## Task 15 — release notes generator

Owns: `scripts/release-notes.ts`, `scripts/test/release-notes.test.ts`.

Generate the release body from git history without network:

- `bun scripts/release-notes.ts <fromRef> <toRef>` prints markdown: a `## Highlights` section filled from `git log --no-merges --pretty=%s`, grouped by Conventional Commit type (`feat`, `fix`, `chore`, `docs`, `perf`, `refactor`, `test`), with unknown types under `Other`; each line keeps the scope when present
- `--json` prints the same data as JSON
- a range with no commits prints a single "No changes" line and exits 0
- export the pure function `buildNotes(commits: { subject: string }[])` so it can be tested without git

Tests: grouping per type, scope rendering, empty range, unknown type fallback, deterministic ordering.

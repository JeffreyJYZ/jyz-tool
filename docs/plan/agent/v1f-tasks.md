---
updated: 202610302000
version: 1.0
---

# jyz v1f tasks — opencode seam, toolchain coverage

Two parallel tasks, disjoint paths. Controller owns `package.json`, `packages/core/src/index.ts`, `packages/cli/src/bin.ts`, `packages/cli/src/lib/verbs.ts`, `docs/**`, `.github/**` and every commit.

## Global Constraints

- Bun only; `.ts` specifiers, tabs 4 wide, printWidth 100, bun:test.
- Never edit `package.json`, `tsconfig.json`, `biome.json`, `bunfig.toml`, `.github/**`, `docs/**`, or another task's paths.
- No git commands, no commits, no subagents, no network in tests.
- New runtime dependencies are not allowed; use `fetch` and `node:` modules only.
- Verify with `bun test <your paths>`; `bun check` must stay clean.
- Do as much as possible in one turn: batch independent calls, chain dependent steps, never yield.

## Task 22 — opencode client seam

Owns: `packages/core/src/funcs/opencode.ts`, `packages/core/test/opencode.test.ts`, `packages/cli/src/commands/oc.ts`, `packages/cli/test/oc.test.ts`.

The plan's opencode integration needs a seam before it needs a UI. Build the seam only — no SDK dependency, no spawning.

- `funcs/opencode.ts` exports:
    - `resolveServer(opts?: { url?: string; env?: Record<string, string | undefined> }): { baseUrl: string; token?: string; source: "flag" | "env" | "default" }` reading `JYZ_OPENCODE_URL` / `JYZ_OPENCODE_TOKEN`, defaulting to `http://127.0.0.1:4096`
    - `listSessions(baseUrl: string, fetcher?: typeof fetch): Promise<OpencodeSession[]>` hitting `/session` and mapping to `{ id: string; title: string; updatedAt: string }`, throwing `OpencodeError` with the status on a non-2xx
    - `sendPrompt(baseUrl: string, sessionId: string, text: string, fetcher?: typeof fetch): Promise<{ ok: true }>` posting to `/session/{id}/message`, throwing `OpencodeError` on failure
    - `class OpencodeError extends Error` with `status?: number` and `url: string`
- `commands/oc.ts` exports `registerOc(cli: CAC): void` with `oc sessions` and `oc prompt <text> --session <id>`, both printing concise human output and exiting non-zero with the error message on failure; the command is hidden from the main list like `serve`

Tests: `resolveServer` precedence per layer; `listSessions` against a `Bun.serve` fake returning fixtures; a 500 response throws `OpencodeError` carrying the status; `sendPrompt` posts the expected JSON body; CLI registration test asserts both subcommands exist.

## Task 23 — toolchain coverage past the JS tools

Owns: `packages/core/src/funcs/toolchain.ts`, `packages/core/test/toolchain-coverage.test.ts`.

`toolchain.ts` currently maps a subset of the tools the plan lists. Extend the resolvers, keeping every existing signature:

- linters: `eslint` → `eslint <paths>`, `clang-tidy` → `clang-tidy <paths>`, `cargo-clippy` → `cargo clippy -- -D warnings` (already there — verify), `bun-lint` → `bun lint`
- typecheckers: `clang` → `clang -fsyntax-only <sources>`, `cargo` → `cargo check`
- formatters: `clang-format` → `clang-format -i <paths>` with `--dry-run --Werror` under `{ check: true }`, `rustfmt` → `cargo fmt --all` with `-- --check` under `{ check: true }`, `prettier` → `prettier --write <paths>` / `prettier --check <paths>`
- a configured tool whose binary does not resolve must throw `ToolchainError` naming tool and config key, exactly as today
- globs/paths come from a new optional `paths?: string[]` argument defaulting to `["."]`, never a shell-expanded string

Tests: one case per tool asserting `file` and exact `argv`, plus the check-mode variants for the three formatters and the missing-binary error for each new tool.

---
updated: 202610302230
version: 1.0
---

# jyz v1i — alpha release automation, benchmark

Two parallel tasks, disjoint paths. Controller owns `packages/cli/**`, `docs/**`, `.github/**` and every commit.

## Global Constraints

- Bun only; `.ts` specifiers, tabs 4 wide, printWidth 100, bun:test.
- Never edit `package.json`, `tsconfig.json`, `biome.json`, `.github/**`, `docs/**`, or another task's paths.
- No new dependencies, no subagents, no network in tests.
- Verify with `bun test scripts/test` and `bun check`.
- Do as much as possible in one turn: batch independent calls, chain dependent steps, never yield.

## Task 28 — alpha release automation

Owns: `scripts/alpha-release.ts`, `scripts/test/alpha-release.test.ts`.

One command that turns a green tree into a published alpha, without hand-editing six manifests:

- `bun scripts/alpha-release.ts [--push]` runs, in order: the four gates (`bun run typecheck`, `bun run lint`, `bun run format:check`, `bun run test`), stops on the first failure, then calls the existing bump logic for `0.1.0-alpha.N` → `alpha.N+1` across every manifest
- after a successful bump it commits `chore(release): <version>`, tags `v<version>`, and only pushes when `--push` is passed; without it, it prints the exact next commands and exits 0
- `--dry-run` prints the version it would produce and the gates it would run, changing nothing
- export pure helpers `nextAlpha(current: string): string` and `manifestFiles(): string[]` (the six manifest paths) so they are testable without git
- a dirty tree aborts before the first gate, naming the paths

Tests: `nextAlpha` for `0.1.0-alpha.1` → `0.1.0-alpha.2`, for a non-alpha version (throws with a clear message), for `alpha.9` → `alpha.10`; `manifestFiles` returns six paths that all exist; `--dry-run` prints without touching a file.

## Task 29 — startup and dispatch benchmark

Owns: `scripts/bench.ts`, `scripts/test/bench.test.ts`.

A repeatable number for "is jyz fast enough", because every dispatch shells out:

- `bun scripts/bench.ts [--runs N]` measures, in milliseconds: `jyz --version` startup, `jyz config path`, and `jyz run` on a fixture with a no-op script; prints p50/p95/min per case as one table
- export `percentile(samples: number[], p: number): number` and `summarize(samples: number[]): { min: number; p50: number; p95: number; max: number }`
- `--json` prints the same data as one JSON document
- never spawn more than one child at a time, and cap each spawn with a timeout

Tests: `percentile` on a known array, `summarize` on empty and single-sample input, and a JSON-shape test of the emitted object from a stubbed run list.

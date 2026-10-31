# Task 67 Report

Split five oversized test files by describe/test groups into sibling files under 200 lines. No tests deleted or weakened.

## Files split

- packages/core/test/config.test.ts -> config-find.test.ts, config-read.test.ts, config-load.test.ts, config-write.test.ts
- packages/core/test/create-git.test.ts -> create-git-a.test.ts, create-git-b.test.ts
- packages/core/test/create.test.ts -> create-a.test.ts, create-b.test.ts
- packages/core/test/opencode.test.ts -> opencode-resolve.test.ts, opencode-sessions.test.ts, opencode-prompt.test.ts
- packages/cli/test/e2e/e2e.test.ts -> e2e-a.test.ts, e2e-b.test.ts

## Test counts

- Before: 88 tests across the five files (35 + 11 + 14 + 19 + 9)
- After: 88 tests across the sibling files (0 added, 0 removed)

## Gates

- bun test: 394 pass, 0 fail
- bun run size: 0 oversized
- bun check: no type errors
- bun run lint: 0 errors (23 warnings)
- bun fmt --check: all formatted
# Task 27 — monorepo create coverage

Status: done.

Files: `packages/core/test/create-monorepo.test.ts` (new, 5 tests).

Tests: 141 pass, 0 fail across `packages/core/test` (15 files, 346 expect calls).

Concerns: none. Member-level non-empty-directory guard is not implemented in `createProject` (only the root target is checked via `assertUsableTarget`); if a `packages/core` or `packages/cli` subdir already exists with content, creation proceeds and merges files rather than throwing. Not fixed per tests-only constraint.

## Task 15 — release notes generator

Owns: `scripts/release-notes.ts`, `scripts/test/release-notes.test.ts`.

Generate the release body from git history without network:

- `bun scripts/release-notes.ts <fromRef> <toRef>` prints markdown: a `## Highlights` section filled from `git log --no-merges --pretty=%s`, grouped by Conventional Commit type (`feat`, `fix`, `chore`, `docs`, `perf`, `refactor`, `test`), with unknown types under `Other`; each line keeps the scope when present
- `--json` prints the same data as JSON
- a range with no commits prints a single "No changes" line and exits 0
- export the pure function `buildNotes(commits: { subject: string }[])` so it can be tested without git

Tests: grouping per type, scope rendering, empty range, unknown type fallback, deterministic ordering.

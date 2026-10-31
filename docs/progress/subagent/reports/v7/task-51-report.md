# Task 51 report

Status: done.

Files:
- `scripts/check-file-size.ts` (new) — 200-line gate, LIMIT=200, walks packages+scripts, extensions .ts/.tsx/.css/.rs, skips node_modules/target/dist/gen/.git.
- `scripts/test/check-file-size.test.ts` (new) — 7 tests pass.
- `docs/refactor/oversized.txt` (new) — 17 entries seeded from current tree.
- `package.json` — added `"size"` script.
- `.github/workflows/ci.yml` — size step after lint.
- `AGENTS.md` — House rules line.

Counts: 17 oversized files remain on exception list. Tests 7 pass, 0 fail.

Gates: `bun run size` green, tests green. `bun check scripts` green; full `bun check` has pre-existing desktop DOM errors unrelated to this task.
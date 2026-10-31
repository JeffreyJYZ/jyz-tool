## Task 51 — a 200-line file-size gate

Owns: `scripts/check-file-size.ts` (new), `scripts/test/check-file-size.test.ts` (new), `docs/refactor/oversized.txt` (new), `package.json` (root, scripts only), `.github/workflows/ci.yml`, `AGENTS.md` (House rules line only).

Copy Quarry's shape from `~/dev/monorepos/quarry/scripts/check-file-size.ts`:

- `LIMIT = 200`. Walk `packages` and `scripts`, extension list `.ts`, `.tsx`, `.css`, `.rs`, skipping `node_modules`, `target`, `dist`, `gen`, `.git`.
- Files already oversized when the rule lands are listed one per line in `docs/refactor/oversized.txt` with their current line count as a comment-free `path` line. The check fails when a **new** file crosses the limit, and also when a listed file is no longer oversized — the list may only shrink.
- Export `countLines`, `lineCount`, `findViolations(...)` so the test drives them with fixture strings and a temp dir; print one `ok` line on success and one line per violation on failure, exit 1.
- Root `package.json` gains `"size": "bun scripts/check-file-size.ts"`; CI gets a step running it right after `bun run lint`; `AGENTS.md` House rules gains one line naming the rule and the exception file.

Seed `docs/refactor/oversized.txt` from the tree as it is when you start (run your own script with the gate off, or `wc -l`), sorted, so the first run is green. Do not refactor any oversized file — that is later work.

Tests: `countLines` for an empty string, a one-liner, a trailing newline, and CRLF; `findViolations` with a clean temp dir, a new 201-line file, and a listed file that shrunk below the limit.

Task 62: split scripts/ui-walkthrough.ts (286 lines) into scripts/walkthrough/{stub,server,browser}.ts; ui-walkthrough.ts keeps serveUi and stubSource exported. Removed from oversized.txt.

Proof:

- walkthrough output: 8/8 steps ok
- bun run size: 11 oversized file(s) remain (no new/stale for ui-walkthrough)
- bun check: no type errors
- bun run lint: 0 errors (23 pre-existing warnings)
- bun fmt --check: all files formatted No commits.

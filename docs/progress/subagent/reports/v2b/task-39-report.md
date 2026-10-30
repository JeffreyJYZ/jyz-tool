# Task 39 — jyz oc event-stream watch

Status: done. Files: packages/cli/src/commands/oc.ts, packages/cli/test/oc-watch.test.ts. Tests: oc-watch 2 tests (dead server non-zero with url; timeout exits 0 no events). Concerns: core subscribeEvents not yet present in this checkout (parallel task); oc.ts imports it and type-checks only after that lands. Watch tests for --once frame deferred to avoid guessing core's stream framing.

## Task 29 — startup and dispatch benchmark

Owns: `scripts/bench.ts`, `scripts/test/bench.test.ts`.

A repeatable number for "is jyz fast enough", because every dispatch shells out:

- `bun scripts/bench.ts [--runs N]` measures, in milliseconds: `jyz --version` startup, `jyz config path`, and `jyz run` on a fixture with a no-op script; prints p50/p95/min per case as one table
- export `percentile(samples: number[], p: number): number` and `summarize(samples: number[]): { min: number; p50: number; p95: number; max: number }`
- `--json` prints the same data as one JSON document
- never spawn more than one child at a time, and cap each spawn with a timeout

Tests: `percentile` on a known array, `summarize` on empty and single-sample input, and a JSON-shape test of the emitted object from a stubbed run list.

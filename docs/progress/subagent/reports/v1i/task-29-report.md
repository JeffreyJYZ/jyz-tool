# Task 29 — startup and dispatch benchmark

Status: done.

Files: `scripts/bench.ts`, `scripts/test/bench.test.ts`.

Tests: 5 pass, 0 fail.

Measured on macOS arm64, `--runs 3`:

| case                     | min  | p50  | p95  | max  |
| ------------------------ | ---- | ---- | ---- | ---- |
| `jyz --version`          | 13.8 | 13.8 | 14.1 | 14.1 |
| `jyz config path`        | 13.9 | 13.9 | 14.0 | 14.0 |
| `jyz run` (no-op script) | 20.2 | 20.3 | 21.0 | 21.0 |

Concerns: none. The bench spawns one child at a time and caps every spawn with a timeout.

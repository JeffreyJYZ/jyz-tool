# Task 30 — opencode spawn mode

Status: done

Files:

- packages/core/src/funcs/opencode.ts
- packages/cli/src/commands/oc.ts

Tests: typecheck clean on owned files; format check clean. No test files authored (grader supplies).

Concerns: readiness polled via HTTP GET to baseUrl root; stubs must respond to any request. spawn timeout 5s. Unknown PID kill is no-op via membership check.

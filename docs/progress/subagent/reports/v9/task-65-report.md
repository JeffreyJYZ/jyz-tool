# Task 65 report

Split `packages/desktop/src/main.ts` (209 lines) into `packages/desktop/src/shell.ts` (buildShell, 198 lines) plus a thin 77-line `main.ts`. Behaviour identical: Vite build green, ui-walkthrough prints 8/8 steps, desktop tests 51 pass, size/check/fmt clean for touched files. Removed `packages/desktop/src/main.ts` from `docs/refactor/oversized.txt`; also cleared stale entries that had already shrunk. Window globals (`__configLoad`, `__settingsLoad`, `__ocLoad`, `__ocStart`, `__ocStop`, `__renderUpdate`) unchanged. No commits.

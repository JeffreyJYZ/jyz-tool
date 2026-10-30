---
updated: 202610311230
version: 1.0
---

# jyz v6 — a settings screen with a manual update check

The window checks for updates once, on load, and shows a banner if one exists. There is no way to ask
"am I current?" on demand, and no place that shows what build is running. Quarry's settings does both.

Controller owns root manifests, `docs/**`, Rust, scripts and every commit.

## Global Constraints

- Bun only; `.ts` specifiers, tabs 4 wide, printWidth 100, bun:test.
- Never edit `package.json`, `tsconfig.json`, `biome.json`, `.github/**`, `docs/**`, `packages/desktop/src-tauri/**`.
- No new dependencies, no framework, no bundler, one `<script>`, no git commands, no commits, no subagents.
- Verify with `bun test packages/desktop/test` and `bun check`.

## Shared contract

- Rust already answers `invoke("jyz_update_check")` with `{ current, version, notes } | null`, `Err` on a
  network failure, and `invoke("jyz_update_install")` downloads, installs and restarts.
- `invoke("jyz_version")` returns the version footer line.

## Task 49 — Settings: what am I running, and check now

Owns: `packages/desktop/ui/index.html`, `packages/desktop/src/screens.ts`,
`packages/desktop/src/updates.ts`, `packages/desktop/test/screens.test.ts`,
`packages/desktop/test/updates.test.ts`.

- `screens.ts`: the `Screen` union gains `"settings"`, the tab strip gains a Settings button, and
  `screenFromHash("#settings")` / `screenHref("settings")` work like the others.
- `updates.ts` gains
  `checkStatus(result: { current: string; version: string; notes: string | null } | null): { state: "current" | "available"; text: string }`
  — `current` says `you are on the newest build (<version>)`, `available` names the offered version.
  And `checkFailure(error: unknown): string`, one line, never a stack.
- The Settings screen shows: the running version (`jyz_version`), a **Check for updates** button, a
  status line, and — when a check finds one — `update available: <version>`, its notes, and the same
  **Install** button the banner uses (call `jyz_update_install`, disable while running, then
  `installing… the app will restart`).
- States worth getting right: checking, current, available, failed (one line, button usable again),
  and bridge absent (screen says it needs the window, no scary red).
- The load-time auto-check and the banner stay exactly as they are; this is a second way in, not a
  replacement. A successful settings check should hide the banner, since the person has seen it.

Tests: `checkStatus` for an offer and for null; `checkFailure` for `Error` and string; screens test
covers `settings` in the hash map and the tab order.

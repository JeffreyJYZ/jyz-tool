---
updated: 202610301411
version: 1.1
---

# Tauri Desktop (v2)

## Purpose

A lightweight, minimal desktop window over the same core the CLI uses. Not a second implementation, not a dashboard that grows its own opinions.

Target: the user runs `jyz` in a terminal and the window shows the same truth. No feature exists in one surface and not the other.

## Packaging

- The desktop installer ships the CLI as well. Installing the desktop yields both; installing only the CLI yields only the CLI.
- The desktop app is a wrapper: it owns no resolution logic and no scaffold logic of its own.
- The CLI is compiled to a standalone binary so a desktop install does not depend on a separate Bun install on the machine. Whether that binary itself embeds a runtime is an implementation detail measured at build time, not a user-visible dependency.

## Shape

- Tauri 2 shell, React 19 and Vite under `packages/desktop/src/`.
- Dark mode first, both themes shipped, `prefers-color-scheme` honoured.
- The window talks to the installed CLI through its JSON-RPC surface over stdio, using the same protocol the CLI uses internally.
- No filesystem or process logic in the frontend beyond presentation and calls into the CLI.

## Parity rule

Core emits a capability manifest: every registered operation with its parameters. The desktop gate reads that manifest and asserts each capability is reachable from the UI, and each UI action names a manifest entry. Adding a capability to core without wiring it into the desktop turns the gate red, which is the whole point.

## First screens

- project list: projects jyz knows about, their detected package manager and typechecker
- command runner: pick a verb, see the exact argv before running, then live output
- config editor: shows the merged config with its source layers, read-only first
- opencode panel: see `opencode.md`; arrives with that feature, not before

## Acceptance gate

- capability manifest test green: every core operation reachable from the UI
- the window runs a real verb end to end in CI on macOS, and a packaged installer is smoke-tested on all three platforms where a GUI runner exists
- bundle size recorded per release so "lightweight" stays measurable rather than felt
- installing the desktop app yields a working `jyz` **inside the bundle** (`Contents/MacOS/jyz`, `jyz.exe` beside the app on Windows); nothing is added to `PATH`, so a CLI on PATH still comes from the CLI package, and a CLI-only install leaves no desktop artefacts. Proven by `bun scripts/install-smoke.ts`, which copies the bundle to a temp dir and runs the bundled CLI there.

## Resolved

- Transport: JSON-RPC over the installed CLI, one protocol with no duplicate implementation.
- Runtime: the installer carries the CLI, so the desktop never requires a separate Bun install.
- Packaging: desktop and CLI install together; CLI alone stays CLI alone.

## Resolved after shipping

- The CLI does **not** go on `PATH` on any platform. It ships beside the app binary inside the bundle, the app resolves it as a sibling, and `install-smoke` runs it from a temp copy. Adding it to `PATH` would collide with a separately installed CLI, so the plan no longer asks for it.

# Alpha.22 and the accessibility crash

## What shipped

- alpha.22: native menu with `Check for Updates…` (`Cmd+U`), `Install Update` (`Cmd+Shift+U`), and an Edit submenu (undo/redo/cut/copy/paste/select all) so clipboard shortcuts survive jyz owning the menu bar.
- Main area gets 1.5rem padding; tab strip no longer sits flush under the title bar.
- `build:app` script: `bun scripts/stage-sidecar.ts && tauri build --bundles app`, for local checks without mounting a dmg.
- cac-cli scaffold now prints `name/version os-arch bun-version` on `--version`, matching `jyz`.

## The crash and its cause

Crash report `jyz-desktop-2026-10-31-162458.ips`: `EXC_BAD_ACCESS (SIGSEGV)`, `KERN_INVALID_ADDRESS at 0x0000000000000001`, main thread (`com.apple.main-thread`), version `0.1.0-alpha.21`, frames `objc_opt_respondsToSelector` -> `NSAccessibilitySetOverriddenAttributesForUIElement` -> `enable_webview_accessibility`. Launched from an agent shell, so the process was attributed to the OpenCode coalition.

An accessibility override pushed onto a freshly created WKWebView asks macOS to set overridden attributes on an element that is not yet populated, so `NSAccessibilitySetOverriddenAttributesForUIElement` dereferences a nil element at address `0x1` and segfaults before the window paints. That is why every later launch looked like a broken build rather than a crash.

## What replaced it

The native menu is the accessible surface (`packages/desktop/src-tauri/src/menu.rs`). Honest limit: `agent-desktop snapshot --app jyz` still returns `WINDOW_NOT_FOUND`, and by window id `ACTION_NOT_SUPPORTED: window_without_accessibility_element`, because a Tauri window on macOS exposes no accessibility element. Menu accessibility is therefore not proven by tree.

## Traps worth keeping

- Never re-add `enable_webview_accessibility`; `rg -n 'enable_webview_accessibility|NSAccessibility' packages/desktop/src-tauri` returns no matches, and it must stay that way.
- `bun run --cwd packages/desktop build` bundles a dmg; Tauri's `bundle_dmg.sh` mounts a `jyz` volume and pops a Finder drag window. Use `build:web` or `build:app` locally.
- A stale test asserted `packages/mcp/package.json` was `private` after the package became publishable; the manifest test now asserts `private` is absent.
- `agent-desktop screenshot --window-id <id>` writes a 2x PNG; a window behind another window captures blank, which reads like a rendering failure but is occlusion. Verify against a full-screen capture first.

## Current state

Release line `0.1.0-alpha.22`; `/Applications/jyz.app` at `0.1.0-alpha.22`. Release run reported all four gates green. This turn: `bun run typecheck` green (209 files), `bun run test` 415 pass; `bun run lint` and `bun run format:check` red on uncommitted WIP (`packages/desktop/src/shell.ts`, `scripts/a11y-check.ts`, `scripts/a11y/audit.ts`).

# Windows leg green, C and rust-lib proven, window state

## What changed

- **Windows CI green**: four real portability bugs, not flakes — a colon-joined `PATH`, no PATHEXT lookup, `Bun.spawn` refusing a batch file, and a `.cmd` shim that swallowed the exit code.
- `which()` walks `PATH` with PATHEXT and `spawnArgv()` wraps `.cmd`/`.bat` in `cmd.exe /c`; every spawn site (dispatch, `run`, JSON-RPC `exec`, opencode spawn, `runCommand`) resolves first.
- Test stubs are one Bun script behind a platform launcher, so no test needs bash; `PATH` is joined with `delimiter`, never `":"`.
- **C template proven**: `bun scripts/scaffold-smoke.ts --scenario=c` scaffolds it, runs `make check`, `make build` and the binary (prints `capp is running`); CI runs it on macOS and Ubuntu.
- **`rust-lib` implemented**: the type and the plan promised it, no directory existed, so `jyz create --template rust-lib` answered "not available in this build". New `packages/core/templates/cargo-lib` (lib layout, `[lib] point`, re-exports) plus `--scenario=rust-lib` (cargo check, cargo test) and a guard test that every declared template is offered.
- **Window state**: `tauri-plugin-window-state` reopens the window where it was left.
- **Desktop polish**: padding moved to `#app` (tabs were flush against the window edges), neutral monochrome palette, byte progress while the 47 MB update downloads, and the menu's Check for Updates now renders a visible result.

## Traps

- A `PATH` built with `":"` on Windows is one bogus entry; the CLI then reports `Executable not found in $PATH` and it reads as a resolver bug.
- `Bun.spawn` cannot start a `.cmd`; go through `cmd.exe /c`, and end the shim `exit /b %ERRORLEVEL%` or failures look like successes.
- Smoke scenarios call `packages/cli/src/bin.ts` through the current Bun, never a linked `jyz`, because CI has no `bun link`.
- `/releases/latest/download/latest.json` is CDN-cached: right after a publish it can still serve the previous version. Verify with the tag URL or `gh release download`.
- The window-state file records **physical** pixels, so on a Retina display the logical size is half of what the file says.

## State

- Release line `0.1.0-alpha.27`; `/Applications/jyz.app` at `0.1.0-alpha.27`.
- CI: `macos-latest`, `ubuntu-latest`, `windows-latest` and `rust` all green on the release commit.
- Local gates: 426 tests, typecheck, lint, size 0, format, walkthrough 8/8, a11y 4/4 screens with 0 findings.

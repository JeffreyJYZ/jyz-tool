# Task 36 report

Status: complete.

Files changed:

- `packages/desktop/src-tauri/src/lib.rs` (sibling sidecar lookup, `jyz_oc` command + allowlist, unit tests)
- `packages/desktop/src-tauri/tauri.conf.json` (added `bundle.externalBin: ["binaries/jyz"]`)
- `packages/desktop/scripts/stage-sidecar.ts` (new)
- `scripts/test/desktop-bundle.test.ts` (new)

Cargo results:

- `cargo check`: Finished dev profile, 0 errors.
- `cargo fmt --check`: no output (clean).

Test summary:

- `bun test scripts/test/desktop-bundle.test.ts`: 3 pass, 0 fail.

Concerns:

- `.gitignore` already contains `packages/desktop/src-tauri/binaries/` (test passes); no edit needed.
- Staged binary `packages/desktop/src-tauri/binaries/jyz-aarch64-apple-darwin` created locally by stage script; `binaries/` ignored.

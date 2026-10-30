## Task 36 — the installer carries the CLI, and the shell can drive opencode

Owns: `packages/desktop/src-tauri/src/lib.rs`, `packages/desktop/src-tauri/src/linux_process.rs`, `packages/desktop/src-tauri/tauri.conf.json`, `packages/desktop/scripts/stage-sidecar.ts`, `scripts/test/desktop-bundle.test.ts`.

Two jobs, both about what a person gets after installing:

- **Sidecar.** `tauri.conf.json` declares `bundle.externalBin: ["binaries/jyz"]`. `packages/desktop/scripts/stage-sidecar.ts` computes the Rust host triple (`rustc -vV`, the `host:` line), compiles the CLI with `bun build --compile packages/cli/src/bin.ts --outfile packages/desktop/src-tauri/binaries/jyz-<triple>` (add `.exe` on Windows), and is idempotent. It prints one line naming the staged path. `binaries/` stays out of git.
- **Lookup.** The shell prefers `jyz` sitting beside its own executable (`current_exe()`'s directory, with `.exe` on Windows) before anything on `PATH`, because that is where the installer puts the sidecar. Keep the existing `PATH` and Linux-location fallbacks, and keep `linux_process::resolve` as the last resort.
- **`jyz_oc(args: string[]) -> Result<String, String>`** per the shared contract: runs the resolved CLI as `jyz oc <args...>`, allowlists the first element (`sessions`, `prompt`), returns stdout trimmed, and maps a non-zero exit to the child's stderr. Register it in the invoke handler.

Rust unit tests for the allowlist and for the sibling-path lookup (build a temp dir with a fake `jyz` file and assert it wins over `PATH`). Validate with `cargo check` and `cargo fmt --check` inside `packages/desktop/src-tauri` and report both verbatim.

`scripts/test/desktop-bundle.test.ts` (bun:test) asserts from the repo root: `tauri.conf.json` declares exactly that `externalBin` entry, the bundle is active with `targets: "all"`, the stage script exists and names the same output directory, and `.gitignore` ignores `packages/desktop/src-tauri/binaries/`. Do not edit `.gitignore` yourself; if it lacks the line, report it instead.

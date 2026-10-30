## Task 23 — toolchain coverage past the JS tools

Owns: `packages/core/src/funcs/toolchain.ts`, `packages/core/test/toolchain-coverage.test.ts`.

`toolchain.ts` currently maps a subset of the tools the plan lists. Extend the resolvers, keeping every existing signature:

- linters: `eslint` → `eslint <paths>`, `clang-tidy` → `clang-tidy <paths>`, `cargo-clippy` → `cargo clippy -- -D warnings` (already there — verify), `bun-lint` → `bun lint`
- typecheckers: `clang` → `clang -fsyntax-only <sources>`, `cargo` → `cargo check`
- formatters: `clang-format` → `clang-format -i <paths>` with `--dry-run --Werror` under `{ check: true }`, `rustfmt` → `cargo fmt --all` with `-- --check` under `{ check: true }`, `prettier` → `prettier --write <paths>` / `prettier --check <paths>`
- a configured tool whose binary does not resolve must throw `ToolchainError` naming tool and config key, exactly as today
- globs/paths come from a new optional `paths?: string[]` argument defaulting to `["."]`, never a shell-expanded string

Tests: one case per tool asserting `file` and exact `argv`, plus the check-mode variants for the three formatters and the missing-binary error for each new tool.

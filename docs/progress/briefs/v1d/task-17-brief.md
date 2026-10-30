## Task 17 — create CLI fixes

Owns: `packages/cli/src/commands/create.ts`, `packages/cli/test/create-cli.test.ts`.

Two known defects in the CLI create path:

- `--install` currently installs twice when the core create already installed; make the CLI pass the flag through exactly once and never run its own install when `createProject` did
- `--git github` prints nothing about the created repository; print the URL the core layer reports (add a `repoUrl?: string` read from `CreateResult.warnings` if that is where it lands — do not change core)

Also make `--yes` non-interactive: with `--yes` and no `--template`, use `create.default_template` from config; without either, exit non-zero naming `--template`.

Tests: stub `bun`/`git`/`gh` on `PATH`, assert a single install invocation, that the github URL is printed, and that `--yes` picks the config default.

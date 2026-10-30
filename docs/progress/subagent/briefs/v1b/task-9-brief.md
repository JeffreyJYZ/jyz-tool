## Task 9 — CLI end-to-end tests

Owns: `packages/cli/test/e2e/**`.

Spawn the real binary (`Bun.spawn(["bun", "packages/cli/src/bin.ts", ...], { cwd: fixtureDir })`) against throwaway fixture projects under `mkdtempSync`, and assert observable behaviour, not internals:

- `config show|get|set|path|check` — `set` on a commented `jyz.config.toml` keeps the comment; `check --strict` exits 1 on an unknown key
- dispatch verbs — put a stub `bun`/`pnpm` script on `PATH` that writes its argv to a file; assert `jyz add -D x` records `add -d x` for bun and `add -D x` for pnpm, `jyz update --latest` records `--latest`, exit code passes through (stub exits 3)
- `-F <name>` in a monorepo fixture acts on the named member's directory
- aliases: `[aliases] a = "add"` makes `jyz a x` behave as `add x`; an alias shadowing a core verb exits non-zero naming the alias
- bare script: `jyz dev` with `scripts.dev` in `package.json` runs it

Keep each spawn's stdio piped and assert on exit code plus recorded argv. Timeout each spawn.

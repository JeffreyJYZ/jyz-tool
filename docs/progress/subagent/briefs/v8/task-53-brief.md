## Task 53 — the flags on `jyz create`

Owns: `packages/cli/src/commands/create.ts`, `packages/cli/test/create-features.test.ts`.

- `--feature <name>` (repeatable) and `--features <a,b>`, merged and de-duplicated.
- `--list-features` prints `id  template(s)  summary` and exits 0 without creating anything.
- Unknown or incompatible feature: non-zero exit, message naming the feature and the template, nothing
  written on disk.
- `--json` output carries the `features` array from the shared contract.
- A `create` with no features behaves byte-for-byte as it does today.

Tests drive the real command against a temp cwd: one feature applied, both, an unknown id, a template
mismatch, and `--list-features`.

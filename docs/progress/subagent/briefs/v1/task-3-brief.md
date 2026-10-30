## Task 3 — core command building and execution

Wave A. Model tier: easy.

Owns: `packages/core/src/types/command.ts`, `packages/core/src/funcs/argv.ts`, `packages/core/src/funcs/exec.ts`, `packages/core/test/argv.test.ts`, `packages/core/test/exec.test.ts`.

`types/command.ts` exports `Verb` (`install`, `add`, `remove`, `run`, `exec`, `update`, `outdated`), `ArgvRequest` (`verb`, `args`, `dev?`, `latest?`) and `CommandSpec` (`file`, `argv`, `cwd`).

`funcs/argv.ts` exports `buildArgv(pm: PackageManager, req: ArgvRequest): string[]` producing exactly the argv in [dispatch.md](dispatch.md):

- `install` → `["install", ...args]`
- `add` → `["add", ...(dev ? [pm === "bun" ? "-d" : "-D"] : []), ...args]`
- `remove` → `["remove", ...args]`
- `run` → `["run", ...args]`
- `exec` → bun `["bunx", ...args]`, pnpm `["exec", ...args]`
- `update` → `["update", ...(latest ? ["--latest"] : []), ...args]`
- `outdated` → `["outdated", ...args]`

`funcs/exec.ts` exports `resolveExecutable(pm: PackageManager, dir: string, bin: string): string` (walk up for `node_modules/.bin/<bin>`, else the package manager's runner) and `runCommand(spec: CommandSpec, opts?: { stdio?: "inherit" | "pipe"; signal?: AbortSignal }): Promise<{ exitCode: number; stdout: string; stderr: string }>` which spawns without a shell, inherits stdio by default, mirrors the child's exit code, forwards `SIGINT`/`SIGTERM`, and returns empty strings for captured streams when stdio is inherit.

Tests: exact argv per verb per package manager; dev flag per manager; `--latest` forwarding; `.bin` hit preferred over runner; runner used when absent; a child that exits 3 returns `exitCode` 3; a pipe-mode child captures stdout.

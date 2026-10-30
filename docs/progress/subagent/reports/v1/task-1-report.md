# Task 1 report — core config: types, defaults, load, write

Status: done.

Files written:

- `packages/core/src/types/config.ts`
- `packages/core/src/const/defaults.ts`
- `packages/core/src/funcs/config.ts`
- `packages/core/test/config.test.ts`

## What shipped

`types/config.ts` exports `PackageManager`, `Typechecker`, `Linter`, `Formatter`, `Source`, `JyzConfig`, `Resolved<T>`, `ResolvedConfig` as briefed. The four tool types and their members are derived from exported runtime tuples (`PACKAGE_MANAGER_VALUES`, `TYPECHECKER_VALUES`, `LINTER_VALUES`, `FORMATTER_VALUES`), so the type and the value validator in `funcs/config.ts` cannot drift. One extra export, `ConfigFile`, is explained under Deviations.

`const/defaults.ts` exports `CONFIG_FILENAME = "jyz.config.toml"` and `DEFAULT_CONFIG` exactly as specified: `package_manager` and `typechecker` `"auto"`, `linter` and `formatter` `"biome"`, empty `aliases`/`scripts`, `create` = `cli` / `bun` / `init`, `monorepo.default_filter` false.

`funcs/config.ts` exports `ConfigError`, `ConfigWriteError` (both carry `path`), `findConfigPath`, `readConfigFile`, `loadConfig`, `writeConfigValue`, plus the `LoadConfigOptions` interface.

- `findConfigPath` resolves `startDir` and walks parents via `dirname` until the root repeats, returning the first `jyz.config.toml` that is a file.
- `readConfigFile` parses with `smol-toml`. Unknown sections warn as `unknown config section "toolchain"`, unknown keys as `unknown config key "project.lint"`. A value outside its enum, a non-string in `[aliases]`/`[scripts]`, or a wrong scalar type warns and is ignored rather than failing the run, which matches the plan's lenient default (`--strict` turns warnings into an error later). Unreadable and malformed files throw `ConfigError` naming the path.
- `loadConfig` resolves each of the four project values through flag, then `JYZ_*` env, then the nearest config file, then `opts.detected`, then the built-in fallback, recording `source` per value. An invalid env value or flag value warns and falls through to the next layer. `aliases`, `scripts`, `create` and `monorepo` merge over `DEFAULT_CONFIG`; `path` is the config file found and `layers` lists the config files that contributed, nearest first (currently zero or one entry, ready for monorepo root plus member).
- `writeConfigValue` is line based and returns `{ text }` without touching the file. An existing key keeps its indentation, its `=` spacing and its trailing comment, and every other line stays byte-identical; a missing key is appended after the last key of its section, and a missing section is appended at the end of the file with one blank line of separation. Line endings (LF or CRLF) and a missing final newline are preserved. It refuses with `ConfigWriteError` when the dotted key has no section, when the key is defined more than once, when the file does not parse, and whenever re-parsing the result would not equal the original tree plus exactly the one changed key (the round-trip guard that also catches multi-line values it cannot safely rewrite).

## Tests

`bun test packages/core/test/config.test.ts`: 35 pass, 0 fail.

- `findConfigPath`: nearest ancestor wins; null when nothing above matches.
- `readConfigFile`: reads every section; absent keys stay absent; unknown key names the dotted path; unknown section names the section; an out-of-enum value warns and is dropped; malformed TOML raises `ConfigError` with `path`.
- `loadConfig`: defaults with no file, env or detection; config beats detected; env beats config; flag beats env; detected fills a silent config; `"auto"` resolves through detection; `"auto"` resolves to the built-in default with no detection; a flag of `"auto"` defers to the config; an invalid env value warns and falls through; file warnings pass through; `create` and `monorepo` merge over the defaults.
- `writeConfigValue`: unchanged value returns the file byte-for-byte (both `"biome"` and bare `biome`); in-place replacement keeps the trailing comment; the file on disk is untouched; append to an existing section; create a missing section; create a missing file; a bare value is written as a quoted string; a `#` inside a quoted value is not read as a comment; CRLF is preserved; a no-trailing-newline file stays that way; an empty section is filled under its header; a quoted key is rewritten without being unquoted; a root dotted key is rewritten in place; duplicate definition is refused with the count; a rewrite that would not round-trip is refused; a key with no section is refused.

## Verification

- `bun test packages/core/test/config.test.ts` — 35 pass, 0 fail.
- `bunx biome check` on the four files — clean.
- `bun fmt --check` on the four files — `All 4 files are formatted`.
- `bun check` — 15 errors, none in this task's files: `packages/cli/src/commands/config.ts` (5), `packages/cli/src/commands/toolchain.ts` (6), `packages/cli/src/lib/dispatch.ts` (2), `packages/core/src/funcs/project.ts` (1), `packages/core/test/project.test.ts` (1). Those are sibling tasks' modules.

## Deviations

1. `readConfigFile` returns `{ config: ConfigFile; ... }` where `ConfigFile` is a deep partial, not `Partial<JyzConfig>`. `Partial<JyzConfig>` still requires a complete `project`, `create` and `monorepo` object when they are present, so a file with only `[project] linter` would type as if `package_manager`, `typechecker` and `formatter` existed — a runtime `undefined` behind a non-optional type. `ConfigFile` keeps exactly the briefed field names and makes every level optional. Nothing else imports `readConfigFile` yet (grepped: only `loadConfig` inside this task and task 2's `funcs/project.ts` importing `loadConfig`), so no sibling breaks. The controller should re-export `ConfigFile` from `packages/core/src/index.ts`.
2. The brief's type declarations were written as literal unions; they are now derived from exported const tuples. The exported type names, members and semantics are unchanged, and the runtime validators reuse the same tuples instead of restating them.

## Decisions worth knowing

- `"auto"` means "no opinion at this layer", so resolution continues to the next layer rather than jumping straight to detection. A config of `package_manager = "auto"` therefore still lets detection answer, and a flag of `--package-manager auto` deliberately does not blank out a config file's concrete value.
- Where `"auto"` lands with no detection: `bun` for the package manager, `bun-check` for the typechecker (a Bun workspace is the house default), `biome`/`biome` from `DEFAULT_CONFIG` for linter and formatter. Both live in one `DETECTION_FALLBACK` constant if the plan wants different answers.
- `writeConfigValue` treats `rawValue` as a TOML value when it parses as one (`true`, `42`, `"biome"`), and otherwise quotes it as a string. So `writeConfigValue(path, "linter", "biome")` and `writeConfigValue(path, "linter", '"biome"')` write the same line, and a CLI passing the user's raw argument works either way. A caller that wants the literal string `42` must pass `'"42"'`.

## Concerns

- Discovery walks to the filesystem root as the brief says, not to the git root as `docs/plan/agent/config.md` also mentions. A nested repository without its own config currently inherits an outer `jyz.config.toml`. If the plan wants the git-root stop, `findConfigPath` needs one extra check.
- Monorepo root-plus-member layering (member overriding `[project]`, `[aliases]`/`[scripts]` staying visible) is not implemented; only the nearest file is read. `layers` is a list specifically so that the merge can be added without changing the shape.
- Detection itself belongs to task 2, so nothing here inspects lockfiles or `bunfig.toml`; the values arrive through `opts.detected`.
- The writer's refusal path is the round-trip guard, so a file it cannot rewrite fails with a parse or "would change other keys" message rather than a line number. `config set` can add the line number by catching `ConfigWriteError`.

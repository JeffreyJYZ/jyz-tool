## Task 1 — core config: types, defaults, load, write

Wave A. Model tier: hard.

Owns: `packages/core/src/types/config.ts`, `packages/core/src/const/defaults.ts`, `packages/core/src/funcs/config.ts`, `packages/core/test/config.test.ts`.

Dependency available: `smol-toml` (already installed in `packages/core`).

Exports from `types/config.ts`:

```ts
export type PackageManager = "bun" | "pnpm";
export type Typechecker = "bun-check" | "tsc" | "tsgo" | "tsrs" | "cargo" | "clang" | "none";
export type Linter = "biome" | "eslint" | "bun-lint" | "cargo-clippy" | "clang-tidy" | "none";
export type Formatter = "biome" | "bun-fmt" | "prettier" | "clang-format" | "rustfmt" | "none";
export type Source = "flag" | "env" | "config" | "detected" | "default";

export interface JyzConfig {
	project: {
		package_manager: "auto" | PackageManager;
		typechecker: "auto" | Typechecker;
		linter: Linter;
		formatter: Formatter;
	};
	aliases: Record<string, string>;
	scripts: Record<string, string>;
	create: {
		default_template: string;
		default_package_manager: PackageManager;
		git: "skip" | "init" | "commit" | "github";
	};
	monorepo: { default_filter: boolean };
}

export interface Resolved<T> {
	value: T;
	source: Source;
}

export interface ResolvedConfig {
	project: {
		package_manager: Resolved<PackageManager>;
		typechecker: Resolved<Typechecker>;
		linter: Resolved<Linter>;
		formatter: Resolved<Formatter>;
	};
	aliases: Record<string, string>;
	scripts: Record<string, string>;
	create: JyzConfig["create"];
	monorepo: JyzConfig["monorepo"];
	path: string | null;
	layers: string[];
	warnings: string[];
}
```

Exports from `const/defaults.ts`: `CONFIG_FILENAME = "jyz.config.toml"` and `DEFAULT_CONFIG: JyzConfig` (package_manager `"auto"`, typechecker `"auto"`, linter `"biome"`, formatter `"biome"`, empty aliases and scripts, create defaults from the plan's `config.md`, `monorepo.default_filter` false).

Exports from `funcs/config.ts`:

- `findConfigPath(startDir: string): string | null` walks up to the filesystem root and returns the first `jyz.config.toml`.
- `readConfigFile(path: string): { config: Partial<JyzConfig>; warnings: string[] }` parses with `smol-toml`; unknown keys produce a warning naming the dotted key; a malformed file throws `ConfigError`.
- `loadConfig(startDir: string, opts?: { flags?: Partial<Pick<JyzConfig["project"], "package_manager" | "typechecker" | "linter" | "formatter">>; detected?: { package_manager?: PackageManager; typechecker?: Typechecker; linter?: Linter; formatter?: Formatter } }): ResolvedConfig` applies precedence flag > env (`JYZ_PACKAGE_MANAGER`, `JYZ_TYPECHECKER`, `JYZ_LINTER`, `JYZ_FORMATTER`) > nearest config > `opts.detected` > defaults, recording the source of each of the four values, and resolving `"auto"` through detected or default so the returned values are never `"auto"`.
- `writeConfigValue(path: string, dottedKey: string, rawValue: string): { text: string }` returns the rewritten file text without writing it. It is line-based: it replaces the value of an existing key in place, preserving every comment, blank line and ordering; when the key is absent it appends it under its section header, creating the section at the end of the file if needed. It throws `ConfigWriteError` when the key cannot be located unambiguously (for example the key appears more than once) or when the file cannot round-trip.
- `class ConfigError extends Error` and `class ConfigWriteError extends Error` with a `path` field.

Tests: precedence per layer; `"auto"` resolution; unknown-key warning; malformed TOML error; comment-preserving write byte-for-byte on a fixture; append to an existing section; create a missing section; duplicate-key refusal.

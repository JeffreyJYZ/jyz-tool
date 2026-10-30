import type {
	CommandSpec,
	PackageManager,
	ProjectContext,
	Resolved,
	ResolvedConfig,
} from "@jyz/core";

/** One resolved value, always "detected" so a source assertion has something to read. */
export function resolved<T>(value: T): Resolved<T> {
	return { value, source: "detected" };
}

/** A resolved config with no file behind it, for tests that never touch the disk. */
export function resolvedConfig(pm: PackageManager, path: string | null = null): ResolvedConfig {
	return {
		project: {
			package_manager: resolved(pm),
			typechecker: resolved("bun-check"),
			linter: resolved("biome"),
			formatter: resolved("biome"),
		},
		aliases: { a: "add", dev: "run dev" },
		scripts: { e2e: "bun test --timeout 60000" },
		create: { default_template: "cli", default_package_manager: "bun", git: "init" },
		monorepo: { default_filter: false },
		path,
		layers: path === null ? [] : [path],
		warnings: [],
	};
}

/** A project context pointing at a directory that need not exist. */
export function fakeContext(pm: PackageManager, packageDir = "/tmp/jyz-fixture"): ProjectContext {
	return {
		root: packageDir,
		packageDir,
		packageName: "fixture",
		config: resolvedConfig(pm),
		warnings: [],
	};
}

export function spec(file: string, argv: string[], cwd: string): CommandSpec {
	return { file, argv, cwd };
}

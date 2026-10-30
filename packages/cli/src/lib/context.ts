import type { ProjectContext, ResolvedConfig } from "@jyz/core";
import {
	CONFIG_FILENAME,
	detectFormatter,
	detectLinter,
	detectPackageManager,
	detectTypechecker,
	findConfigPath,
	loadConfig,
	readConfigFile,
	resolveProject,
} from "@jyz/core";

export interface ConfigTables {
	path: string | null;
	aliases: Record<string, string>;
	scripts: Record<string, string>;
	warnings: string[];
}

/**
 * Reads only the tables jyz needs before parsing argv: aliases and `[scripts]`.
 *
 * No detection runs here, so `jyz --version` and `jyz config path` answer even when the project
 * has signals that conflict, which is exactly when a diagnostic command is worth most.
 */
export function readConfigTables(dir: string): ConfigTables {
	const path = findConfigPath(dir);
	if (path === null) return { path: null, aliases: {}, scripts: {}, warnings: [] };
	const { config, warnings } = readConfigFile(path);
	return { path, aliases: config.aliases ?? {}, scripts: config.scripts ?? {}, warnings };
}

/**
 * Resolves the config for a directory without requiring a package: `jyz config` must work at a
 * monorepo root, in an empty directory, and before the first `jyz create`.
 *
 * A conflicting linter or formatter signal is reported as a warning and that value falls through to
 * the config file or the built-in default. A conflicting lockfile is not tolerated: it decides which
 * installed binary jyz would run, and guessing there is how a pnpm project gets a bun lockfile.
 */
export function loadConfigAt(dir: string): ResolvedConfig {
	const warnings: string[] = [];
	const typechecker = tolerate(dir, "typechecker", detectTypechecker, warnings);
	const linter = tolerate(dir, "linter", detectLinter, warnings);
	const formatter = tolerate(dir, "formatter", detectFormatter, warnings);

	const config = loadConfig(dir, {
		detected: {
			package_manager: detectPackageManager(dir) ?? undefined,
			typechecker,
			linter,
			formatter,
		},
	});
	config.warnings.push(...warnings);
	return config;
}

function tolerate<T>(
	dir: string,
	label: string,
	detect: (dir: string) => T | null,
	warnings: string[],
): T | undefined {
	try {
		return detect(dir) ?? undefined;
	} catch (error) {
		const reason = error instanceof Error ? error.message : String(error);
		warnings.push(`${label} detection skipped: ${reason}`);
		return undefined;
	}
}

/** The name of the config file a command would create in `dir`. */
export function configPathIn(dir: string): string {
	return findConfigPath(dir) ?? `${dir}/${CONFIG_FILENAME}`;
}

/** The acting package, or null when the directory is not inside one. */
export function packageDirOf(dir: string): string | null {
	try {
		return resolveProject(dir).packageDir;
	} catch {
		return null;
	}
}

export function resolveContext(dir: string, filter?: string): ProjectContext {
	return filter === undefined ? resolveProject(dir) : resolveProject(dir, { filter });
}

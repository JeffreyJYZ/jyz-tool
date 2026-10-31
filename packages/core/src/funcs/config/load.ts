import { CONFIG_FILENAME, DEFAULT_CONFIG } from "../../const/defaults.ts";
import type {
	ConfigFile,
	Formatter,
	Linter,
	PackageManager,
	ResolvedConfig,
	Typechecker,
} from "../../types/config.ts";
import {
	DETECTION_FALLBACK,
	ENV_NAMES,
	FORMATTER_CHOICES,
	LINTER_CHOICES,
	PACKAGE_MANAGER_CHOICES,
	TYPECHECKER_CHOICES,
} from "./constants.ts";
import { findConfigPaths } from "./find.ts";
import type { LoadConfigOptions } from "./helpers.ts";
import { includesString } from "./helpers.ts";
import { mergeConfigFile, readConfigFile } from "./read.ts";

export function loadConfig(startDir: string, opts: LoadConfigOptions = {}): ResolvedConfig {
	const warnings: string[] = [];
	const layers: string[] = [];

	const path = findConfigPaths(startDir);
	let fileConfig: ConfigFile | undefined;
	for (const layerPath of [...path].reverse()) {
		const read = readConfigFile(layerPath);
		warnings.push(...read.warnings);
		layers.push(layerPath);
		fileConfig =
			fileConfig === undefined ? read.config : mergeConfigFile(fileConfig, read.config);
	}
	const nearest = path[0] ?? null;
	const fileProject = fileConfig?.project;

	const resolved: ResolvedConfig = {
		project: {
			package_manager: choose<PackageManager>(
				PACKAGE_MANAGER_CHOICES,
				[
					{
						source: "flag",
						label: "--package-manager",
						raw: opts.flags?.package_manager,
					},
					{
						source: "env",
						label: ENV_NAMES.package_manager,
						raw: process.env[ENV_NAMES.package_manager],
					},
					{
						source: "config",
						label: `${CONFIG_FILENAME} project.package_manager`,
						raw: fileProject?.package_manager,
					},
				],
				opts.detected?.package_manager,
				DETECTION_FALLBACK.package_manager,
				warnings,
			),
			typechecker: choose<Typechecker>(
				TYPECHECKER_CHOICES,
				[
					{ source: "flag", label: "--typechecker", raw: opts.flags?.typechecker },
					{
						source: "env",
						label: ENV_NAMES.typechecker,
						raw: process.env[ENV_NAMES.typechecker],
					},
					{
						source: "config",
						label: `${CONFIG_FILENAME} project.typechecker`,
						raw: fileProject?.typechecker,
					},
				],
				opts.detected?.typechecker,
				DETECTION_FALLBACK.typechecker,
				warnings,
			),
			linter: choose<Linter>(
				LINTER_CHOICES,
				[
					{ source: "flag", label: "--linter", raw: opts.flags?.linter },
					{ source: "env", label: ENV_NAMES.linter, raw: process.env[ENV_NAMES.linter] },
					{
						source: "config",
						label: `${CONFIG_FILENAME} project.linter`,
						raw: fileProject?.linter,
					},
				],
				opts.detected?.linter,
				DETECTION_FALLBACK.linter,
				warnings,
			),
			formatter: choose<Formatter>(
				FORMATTER_CHOICES,
				[
					{ source: "flag", label: "--formatter", raw: opts.flags?.formatter },
					{
						source: "env",
						label: ENV_NAMES.formatter,
						raw: process.env[ENV_NAMES.formatter],
					},
					{
						source: "config",
						label: `${CONFIG_FILENAME} project.formatter`,
						raw: fileProject?.formatter,
					},
				],
				opts.detected?.formatter,
				DETECTION_FALLBACK.formatter,
				warnings,
			),
		},
		aliases: { ...DEFAULT_CONFIG.aliases, ...fileConfig?.aliases },
		scripts: { ...DEFAULT_CONFIG.scripts, ...fileConfig?.scripts },
		create: { ...DEFAULT_CONFIG.create, ...fileConfig?.create },
		monorepo: { ...DEFAULT_CONFIG.monorepo, ...fileConfig?.monorepo },
		path: nearest,
		layers,
		warnings,
	};

	return resolved;
}

interface Candidate {
	source: import("../../types/config.ts").Source;
	label: string;
	raw: string | undefined;
}

function choose<T extends string>(
	allowed: readonly string[],
	candidates: Candidate[],
	detected: T | undefined,
	fallback: T,
	warnings: string[],
): import("../../types/config.ts").Resolved<T> {
	for (const candidate of candidates) {
		if (candidate.raw === undefined) continue;
		const value = candidate.raw.trim();
		if (value === "" || value === "auto") continue;
		if (includesString(allowed, value)) return { value: value as T, source: candidate.source };
		warnings.push(
			`${candidate.label} must be one of ${allowed.join(", ")}, got ${JSON.stringify(candidate.raw)}; ignoring`,
		);
	}
	if (detected !== undefined) return { value: detected, source: "detected" };
	return { value: fallback, source: "default" };
}

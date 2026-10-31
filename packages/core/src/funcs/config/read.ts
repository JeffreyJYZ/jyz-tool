import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { parse } from "smol-toml";

import { CONFIG_FILENAME } from "../../const/defaults.ts";
import type { ConfigFile, JyzConfig } from "../../types/config.ts";
import { PACKAGE_MANAGER_VALUES } from "../../types/config.ts";
import {
	CREATE_KEYS,
	FORMATTER_CHOICES,
	GIT_VALUES,
	LINTER_CHOICES,
	MONOREPO_KEYS,
	PACKAGE_MANAGER_CHOICES,
	type PartialProject,
	PROJECT_KEYS,
	SECTIONS,
	TYPECHECKER_CHOICES,
} from "./constants.ts";
import { ConfigError } from "./errors.ts";
import {
	existsAsFile,
	includesString,
	isRecord,
	messageOf,
	pickBoolean,
	pickEnum,
	pickString,
	readStringMap,
	tableAt,
	warnUnknownKeys,
} from "./helpers.ts";

export function mergeConfigFile(base: ConfigFile, over: ConfigFile): ConfigFile {
	return {
		project: { ...base.project, ...over.project },
		aliases: { ...base.aliases, ...over.aliases },
		scripts: { ...base.scripts, ...over.scripts },
		create: { ...base.create, ...over.create },
		monorepo: { ...base.monorepo, ...over.monorepo },
	};
}

export function readConfigFile(path: string): { config: ConfigFile; warnings: string[] } {
	const warnings: string[] = [];
	let text: string;
	try {
		text = readFileSync(path, "utf8");
	} catch (err) {
		throw new ConfigError(path, `cannot read ${path}: ${messageOf(err)}`);
	}

	let root: Record<string, unknown>;
	try {
		root = parse(text) as Record<string, unknown>;
	} catch (err) {
		throw new ConfigError(path, `invalid TOML in ${path}: ${messageOf(err)}`);
	}

	for (const key of Object.keys(root)) {
		if (!includesString(SECTIONS, key)) warnings.push(`unknown config section "${key}"`);
	}

	const partial: ConfigFile = {};

	const projectTable = tableAt(root, "project", warnings);
	if (projectTable !== undefined) {
		warnUnknownKeys("project", projectTable, PROJECT_KEYS, warnings);
		const project: PartialProject = {};
		const packageManager = pickEnum(
			"project.package_manager",
			projectTable.package_manager,
			PACKAGE_MANAGER_CHOICES,
			warnings,
		);
		if (packageManager !== undefined) project.package_manager = packageManager;
		const typechecker = pickEnum(
			"project.typechecker",
			projectTable.typechecker,
			TYPECHECKER_CHOICES,
			warnings,
		);
		if (typechecker !== undefined) project.typechecker = typechecker;
		const linter = pickEnum("project.linter", projectTable.linter, LINTER_CHOICES, warnings);
		if (linter !== undefined) project.linter = linter;
		const formatter = pickEnum(
			"project.formatter",
			projectTable.formatter,
			FORMATTER_CHOICES,
			warnings,
		);
		if (formatter !== undefined) project.formatter = formatter;
		if (Object.keys(project).length > 0) partial.project = project;
	}

	const aliases = readStringMap(root, "aliases", warnings);
	if (aliases !== undefined) partial.aliases = aliases;
	const scripts = readStringMap(root, "scripts", warnings);
	if (scripts !== undefined) partial.scripts = scripts;

	const createTable = tableAt(root, "create", warnings);
	if (createTable !== undefined) {
		warnUnknownKeys("create", createTable, CREATE_KEYS, warnings);
		const create: Partial<JyzConfig["create"]> = {};
		const template = pickString(
			"create.default_template",
			createTable.default_template,
			warnings,
		);
		if (template !== undefined) create.default_template = template;
		const packageManager = pickEnum(
			"create.default_package_manager",
			createTable.default_package_manager,
			PACKAGE_MANAGER_VALUES,
			warnings,
		);
		if (packageManager !== undefined) create.default_package_manager = packageManager;
		const git = pickEnum("create.git", createTable.git, GIT_VALUES, warnings);
		if (git !== undefined) create.git = git;
		if (Object.keys(create).length > 0) partial.create = create;
	}

	const monorepoTable = tableAt(root, "monorepo", warnings);
	if (monorepoTable !== undefined) {
		warnUnknownKeys("monorepo", monorepoTable, MONOREPO_KEYS, warnings);
		const monorepo: Partial<JyzConfig["monorepo"]> = {};
		const defaultFilter = pickBoolean(
			"monorepo.default_filter",
			monorepoTable.default_filter,
			warnings,
		);
		if (defaultFilter !== undefined) monorepo.default_filter = defaultFilter;
		if (Object.keys(monorepo).length > 0) partial.monorepo = monorepo;
	}

	return { config: partial, warnings };
}

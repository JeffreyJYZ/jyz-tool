import { readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";

import { parse } from "smol-toml";

import { CONFIG_FILENAME, DEFAULT_CONFIG } from "../const/defaults.ts";
import {
	type ConfigFile,
	FORMATTER_VALUES,
	type Formatter,
	type JyzConfig,
	LINTER_VALUES,
	type Linter,
	PACKAGE_MANAGER_VALUES,
	type PackageManager,
	type Resolved,
	type ResolvedConfig,
	type Source,
	TYPECHECKER_VALUES,
	type Typechecker,
} from "../types/config.ts";

/** A file that cannot be read as a config, or whose TOML does not parse. */
export class ConfigError extends Error {
	readonly path: string;

	constructor(path: string, message: string) {
		super(message);
		this.name = "ConfigError";
		this.path = path;
	}
}

/** A rewrite that cannot be performed without changing something else in the file. */
export class ConfigWriteError extends Error {
	readonly path: string;

	constructor(path: string, message: string) {
		super(message);
		this.name = "ConfigWriteError";
		this.path = path;
	}
}

const ENV_NAMES = {
	package_manager: "JYZ_PACKAGE_MANAGER",
	typechecker: "JYZ_TYPECHECKER",
	linter: "JYZ_LINTER",
	formatter: "JYZ_FORMATTER",
} as const;

const PROJECT_KEYS = ["package_manager", "typechecker", "linter", "formatter"] as const;
const CREATE_KEYS = ["default_template", "default_package_manager", "git"] as const;
const MONOREPO_KEYS = ["default_filter"] as const;
const SECTIONS = ["project", "aliases", "scripts", "create", "monorepo"] as const;

const GIT_VALUES: readonly JyzConfig["create"]["git"][] = ["skip", "init", "commit", "github"];

const PACKAGE_MANAGER_CHOICES: readonly ("auto" | PackageManager)[] = [
	"auto",
	...PACKAGE_MANAGER_VALUES,
];
const TYPECHECKER_CHOICES: readonly ("auto" | Typechecker)[] = ["auto", ...TYPECHECKER_VALUES];
const LINTER_CHOICES: readonly Linter[] = LINTER_VALUES;
const FORMATTER_CHOICES: readonly Formatter[] = FORMATTER_VALUES;

/**
 * Where `"auto"` lands when nothing is detected: `bun` because jyz itself runs on Bun,
 * `bun-check` because a Bun workspace is the house default typechecker.
 */
const DETECTION_FALLBACK: {
	package_manager: PackageManager;
	typechecker: Typechecker;
	linter: Linter;
	formatter: Formatter;
} = {
	package_manager: "bun",
	typechecker: "bun-check",
	linter: DEFAULT_CONFIG.project.linter,
	formatter: DEFAULT_CONFIG.project.formatter,
};

type PartialProject = Partial<JyzConfig["project"]>;

export interface LoadConfigOptions {
	flags?: Partial<
		Pick<JyzConfig["project"], "package_manager" | "typechecker" | "linter" | "formatter">
	>;
	detected?: {
		package_manager?: PackageManager;
		typechecker?: Typechecker;
		linter?: Linter;
		formatter?: Formatter;
	};
}

export function findConfigPath(startDir: string): string | null {
	let dir = resolve(startDir);
	for (;;) {
		const candidate = join(dir, CONFIG_FILENAME);
		if (existsAsFile(candidate)) return candidate;
		const parent = dirname(dir);
		if (parent === dir) return null;
		dir = parent;
	}
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

export function loadConfig(startDir: string, opts: LoadConfigOptions = {}): ResolvedConfig {
	const warnings: string[] = [];
	const layers: string[] = [];

	const path = findConfigPath(startDir);
	let fileConfig: ConfigFile | undefined;
	if (path !== null) {
		const read = readConfigFile(path);
		fileConfig = read.config;
		warnings.push(...read.warnings);
		layers.push(path);
	}
	const fileProject = fileConfig?.project;

	const resolved: ResolvedConfig = {
		project: {
			package_manager: choose(
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
			typechecker: choose(
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
			linter: choose(
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
			formatter: choose(
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
		path,
		layers,
		warnings,
	};

	return resolved;
}

/**
 * Rewrites one key of a config file and returns the new text without writing it.
 *
 * `rawValue` is a TOML value when it parses as one (`true`, `42`, `"biome"`); anything else is
 * written as a quoted string, so `writeConfigValue(path, "linter", "biome")` and
 * `writeConfigValue(path, "linter", '"biome"')` produce the same line.
 *
 * The rewrite is line-based: an existing key keeps its indentation, its `=` spacing and its trailing
 * comment, and every other line is left byte-identical. A missing key is appended after the last key
 * of its section, and a missing section is appended at the end of the file. Anything the rewrite
 * cannot prove round-trips is refused with `ConfigWriteError` rather than silently mangled.
 */
export function writeConfigValue(
	path: string,
	dottedKey: string,
	rawValue: string,
): { text: string } {
	const target = splitDottedKey(dottedKey);
	if (target === null) {
		throw new ConfigWriteError(
			path,
			`config key "${dottedKey}" has no section: write it as "<section>.<key>"`,
		);
	}

	let text: string;
	try {
		text = readFileSync(path, "utf8");
	} catch (err) {
		if (!isNotFound(err)) {
			throw new ConfigWriteError(path, `cannot read ${path}: ${messageOf(err)}`);
		}
		text = "";
	}

	const eol = text.includes("\r\n") ? "\r\n" : "\n";
	const endsWithEol = text === "" || text.endsWith("\n");
	const lines = splitLines(text);
	const { keys, sections } = scanKeyLines(lines);
	const newValue = tomlValue(rawValue);

	const matches = keys.filter((key) => isTargetLine(key, target, dottedKey));
	if (matches.length > 1) {
		throw new ConfigWriteError(
			path,
			`cannot set "${dottedKey}": ${matches.length} definitions found in ${path}`,
		);
	}

	const hit = matches[0];
	if (hit !== undefined) {
		const line = lines[hit.index];
		if (line === undefined) {
			throw new ConfigWriteError(
				path,
				`cannot set "${dottedKey}": line ${hit.index + 1} vanished`,
			);
		}
		const { value, gap, comment } = splitValue(hit.rest);
		if (value === "") {
			throw new ConfigWriteError(
				path,
				`cannot set "${dottedKey}": line ${hit.index + 1} has no value`,
			);
		}
		lines[hit.index] = {
			body: `${hit.indent}${hit.keyText}${hit.sep}${newValue}${gap}${comment}`,
			eol: line.eol,
		};
	} else {
		const body = `${formatKey(target.key)} = ${newValue}`;
		const headerIndex = sections.get(target.section);
		if (headerIndex !== undefined) {
			insertAfter(lines, lastKeyIndexIn(keys, target.section, headerIndex), body, eol);
		} else {
			appendSection(lines, target.section, body, eol, endsWithEol);
		}
	}

	const next = joinLines(lines);
	verifyRoundTrip(path, text, next, target, newValue);
	return { text: next };
}

interface TextLine {
	body: string;
	eol: string;
}

interface KeyLine {
	index: number;
	section: string;
	indent: string;
	keyText: string;
	keyName: string;
	sep: string;
	rest: string;
}

interface DottedKey {
	section: string;
	key: string;
}

interface Candidate {
	source: Source;
	label: string;
	raw: string | undefined;
}

function choose<T extends string>(
	allowed: readonly string[],
	candidates: Candidate[],
	detected: T | undefined,
	fallback: T,
	warnings: string[],
): Resolved<T> {
	for (const candidate of candidates) {
		if (candidate.raw === undefined) continue;
		const value = candidate.raw.trim();
		// "auto" is not a value, it is "no opinion at this layer", so resolution moves on.
		if (value === "" || value === "auto") continue;
		if (includesString(allowed, value)) return { value: value as T, source: candidate.source };
		warnings.push(
			`${candidate.label} must be one of ${allowed.join(", ")}, got ${JSON.stringify(candidate.raw)}; ignoring`,
		);
	}
	if (detected !== undefined) return { value: detected, source: "detected" };
	return { value: fallback, source: "default" };
}

function tableAt(
	root: Record<string, unknown>,
	section: string,
	warnings: string[],
): Record<string, unknown> | undefined {
	const value = root[section];
	if (value === undefined) return undefined;
	if (!isRecord(value)) {
		warnings.push(`config section "${section}" must be a table; ignoring`);
		return undefined;
	}
	return value;
}

function warnUnknownKeys(
	prefix: string,
	table: Record<string, unknown>,
	known: readonly string[],
	warnings: string[],
): void {
	for (const key of Object.keys(table)) {
		if (includesString(known, key)) continue;
		warnings.push(`unknown config key "${prefix}.${key}"`);
	}
}

function pickEnum<T extends string>(
	dotted: string,
	value: unknown,
	allowed: readonly T[],
	warnings: string[],
): T | undefined {
	if (value === undefined) return undefined;
	if (typeof value === "string" && includesString(allowed, value)) return value as T;
	warnings.push(
		`config key "${dotted}" must be one of ${allowed.join(", ")}, got ${describe(value)}; ignoring`,
	);
	return undefined;
}

function pickString(dotted: string, value: unknown, warnings: string[]): string | undefined {
	if (value === undefined) return undefined;
	if (typeof value === "string") return value;
	warnings.push(`config key "${dotted}" must be a string, got ${describe(value)}; ignoring`);
	return undefined;
}

function pickBoolean(dotted: string, value: unknown, warnings: string[]): boolean | undefined {
	if (value === undefined) return undefined;
	if (typeof value === "boolean") return value;
	warnings.push(`config key "${dotted}" must be a boolean, got ${describe(value)}; ignoring`);
	return undefined;
}

function readStringMap(
	root: Record<string, unknown>,
	section: string,
	warnings: string[],
): Record<string, string> | undefined {
	const table = tableAt(root, section, warnings);
	if (table === undefined) return undefined;
	const out: Record<string, string> = {};
	for (const [key, value] of Object.entries(table)) {
		if (typeof value === "string") out[key] = value;
		else
			warnings.push(
				`config key "${section}.${key}" must be a string, got ${describe(value)}`,
			);
	}
	return out;
}

function describe(value: unknown): string {
	return typeof value === "string" ? JSON.stringify(value) : String(value);
}

function existsAsFile(path: string): boolean {
	try {
		return statSync(path).isFile();
	} catch {
		return false;
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function includesString(values: readonly string[], value: string): boolean {
	return values.includes(value);
}

function messageOf(err: unknown): string {
	return err instanceof Error ? err.message : String(err);
}

function isNotFound(err: unknown): boolean {
	return typeof err === "object" && err !== null && "code" in err && err.code === "ENOENT";
}

const SECTION_RE = /^\s*\[\s*([^[\]]+?)\s*\]\s*(?:#.*)?$/;
const KEY_RE = /^(\s*)((?:[A-Za-z0-9_.-]+)|"(?:[^"\\]|\\.)*"|'[^']*')(\s*=\s*)(.*)$/;
const BARE_KEY_RE = /^[A-Za-z0-9_-]+$/;

function splitLines(text: string): TextLine[] {
	const lines: TextLine[] = [];
	let start = 0;
	for (let index = 0; index < text.length; index++) {
		if (text[index] !== "\n") continue;
		let end = index;
		let eol = "\n";
		if (end > start && text[end - 1] === "\r") {
			end -= 1;
			eol = "\r\n";
		}
		lines.push({ body: text.slice(start, end), eol });
		start = index + 1;
	}
	if (start < text.length) lines.push({ body: text.slice(start), eol: "" });
	return lines;
}

function joinLines(lines: TextLine[]): string {
	let text = "";
	for (const line of lines) text += line.body + line.eol;
	return text;
}

function scanKeyLines(lines: TextLine[]): { keys: KeyLine[]; sections: Map<string, number> } {
	const keys: KeyLine[] = [];
	const sections = new Map<string, number>();
	let section = "";
	for (let index = 0; index < lines.length; index++) {
		const line = lines[index];
		if (line === undefined) continue;

		const header = SECTION_RE.exec(line.body);
		if (header !== null) {
			const [, name = ""] = header;
			section = unquoteKey(name.trim());
			if (!sections.has(section)) sections.set(section, index);
			continue;
		}

		const match = KEY_RE.exec(line.body);
		if (match === null) continue;
		const [, indent = "", keyText = "", sep = " = ", rest = ""] = match;
		keys.push({
			index,
			section,
			indent,
			keyText,
			keyName: unquoteKey(keyText),
			sep,
			rest,
		});
	}
	return { keys, sections };
}

function splitValue(rest: string): { value: string; gap: string; comment: string } {
	let commentIndex = -1;
	let basic = false;
	let literal = false;
	for (let index = 0; index < rest.length; index++) {
		const char = rest[index];
		if (basic) {
			if (char === "\\") index += 1;
			else if (char === '"') basic = false;
		} else if (literal) {
			if (char === "'") literal = false;
		} else if (char === '"') {
			basic = true;
		} else if (char === "'") {
			literal = true;
		} else if (char === "#") {
			commentIndex = index;
			break;
		}
	}
	const withoutComment = commentIndex === -1 ? rest : rest.slice(0, commentIndex);
	const comment = commentIndex === -1 ? "" : rest.slice(commentIndex);
	const lead = withoutComment.length - withoutComment.trimStart().length;
	const value = withoutComment.trim();
	return { value, gap: withoutComment.slice(lead + value.length), comment };
}

function splitDottedKey(dottedKey: string): DottedKey | null {
	const index = dottedKey.indexOf(".");
	if (index <= 0 || index === dottedKey.length - 1) return null;
	return {
		section: unquoteKey(dottedKey.slice(0, index).trim()),
		key: unquoteKey(dottedKey.slice(index + 1).trim()),
	};
}

function unquoteKey(text: string): string {
	if (text.length >= 2 && text.startsWith('"') && text.endsWith('"')) {
		return text.slice(1, -1).replace(/\\(["\\])/g, "$1");
	}
	if (text.length >= 2 && text.startsWith("'") && text.endsWith("'")) {
		return text.slice(1, -1);
	}
	return text;
}

function formatKey(key: string): string {
	return BARE_KEY_RE.test(key) ? key : quoteTomlString(key);
}

function isTargetLine(line: KeyLine, target: DottedKey, dottedKey: string): boolean {
	if (line.section === target.section && line.keyName === target.key) return true;
	return line.section === "" && line.keyName === dottedKey;
}

function lastKeyIndexIn(keys: KeyLine[], section: string, headerIndex: number): number {
	let last = headerIndex;
	for (const key of keys) {
		if (key.index > headerIndex && key.section === section) last = key.index;
	}
	return last;
}

function insertAfter(lines: TextLine[], anchor: number, body: string, eol: string): void {
	const line = lines[anchor];
	const trailingEol = line !== undefined && line.eol === "" ? "" : eol;
	if (line !== undefined && line.eol === "") line.eol = eol;
	lines.splice(anchor + 1, 0, { body, eol: trailingEol });
}

function appendSection(
	lines: TextLine[],
	section: string,
	body: string,
	eol: string,
	endsWithEol: boolean,
): void {
	const last = lines.at(-1);
	if (last !== undefined) {
		if (last.eol === "") last.eol = eol;
		if (last.body.trim() !== "") lines.push({ body: "", eol });
	}
	lines.push({ body: `[${formatKey(section)}]`, eol });
	lines.push({ body, eol: endsWithEol ? eol : "" });
}

function tomlValue(rawValue: string): string {
	const trimmed = rawValue.trim();
	if (trimmed === "") return quoteTomlString(rawValue);
	try {
		const parsed = parse(`value = ${trimmed}`);
		if (isRecord(parsed) && parsed.value !== undefined) return trimmed;
	} catch {
		// Not TOML on its own: the caller meant a string, so quote it below.
	}
	return quoteTomlString(rawValue);
}

function quoteTomlString(value: string): string {
	let out = '"';
	for (const char of value) {
		const code = char.codePointAt(0) ?? 0;
		if (char === "\\") out += "\\\\";
		else if (char === '"') out += '\\"';
		else if (char === "\n") out += "\\n";
		else if (char === "\r") out += "\\r";
		else if (char === "\t") out += "\\t";
		else if (code < 0x20 || code === 0x7f) out += `\\u${code.toString(16).padStart(4, "0")}`;
		else out += char;
	}
	return `${out}"`;
}

function verifyRoundTrip(
	path: string,
	before: string,
	after: string,
	target: DottedKey,
	newValue: string,
): void {
	let beforeTree: Record<string, unknown>;
	try {
		beforeTree = plain(parse(before)) as Record<string, unknown>;
	} catch (err) {
		throw new ConfigWriteError(path, `${path} is not valid TOML: ${messageOf(err)}`);
	}

	let afterTree: Record<string, unknown>;
	try {
		afterTree = plain(parse(after)) as Record<string, unknown>;
	} catch (err) {
		throw new ConfigWriteError(
			path,
			`rewriting ${path} would not round-trip: ${messageOf(err)}`,
		);
	}

	let expectedValue: unknown;
	try {
		const snippet = plain(parse(`value = ${newValue}`)) as Record<string, unknown>;
		expectedValue = snippet.value;
	} catch (err) {
		throw new ConfigWriteError(path, `${newValue} is not a TOML value: ${messageOf(err)}`);
	}

	const expected = plain(beforeTree) as Record<string, unknown>;
	const table = expected[target.section];
	if (isRecord(table)) {
		table[target.key] = expectedValue;
	} else {
		expected[target.section] = { [target.key]: expectedValue };
	}

	if (!isDeepStrictEqual(afterTree, expected)) {
		throw new ConfigWriteError(
			path,
			`rewriting "${target.section}.${target.key}" in ${path} would change other keys; refusing`,
		);
	}
}

/**
 * smol-toml builds every table with a null prototype, so a structural comparison against a plain
 * object would differ on the prototype alone. Converting both sides to plain objects keeps dates and
 * big integers intact while making the comparison about content only.
 */
function plain(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(plain);
	if (value instanceof Date) return value;
	if (isRecord(value)) {
		const out: Record<string, unknown> = {};
		for (const [key, entry] of Object.entries(value)) out[key] = plain(entry);
		return out;
	}
	return value;
}

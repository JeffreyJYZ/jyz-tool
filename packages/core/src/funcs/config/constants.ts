import { CONFIG_FILENAME, DEFAULT_CONFIG } from "../../const/defaults.ts";
import {
	FORMATTER_VALUES,
	type Formatter,
	type JyzConfig,
	LINTER_VALUES,
	type Linter,
	PACKAGE_MANAGER_VALUES,
	type PackageManager,
	TYPECHECKER_VALUES,
	type Typechecker,
} from "../../types/config.ts";

export const ENV_NAMES = {
	package_manager: "JYZ_PACKAGE_MANAGER",
	typechecker: "JYZ_TYPECHECKER",
	linter: "JYZ_LINTER",
	formatter: "JYZ_FORMATTER",
} as const;

export const PROJECT_KEYS = ["package_manager", "typechecker", "linter", "formatter"] as const;
export const CREATE_KEYS = ["default_template", "default_package_manager", "git"] as const;
export const MONOREPO_KEYS = ["default_filter"] as const;
export const SECTIONS = ["project", "aliases", "scripts", "create", "monorepo"] as const;

export const GIT_VALUES: readonly JyzConfig["create"]["git"][] = [
	"skip",
	"init",
	"commit",
	"github",
];

export const PACKAGE_MANAGER_CHOICES: readonly ("auto" | PackageManager)[] = [
	"auto",
	...PACKAGE_MANAGER_VALUES,
];
export const TYPECHECKER_CHOICES: readonly ("auto" | Typechecker)[] = [
	"auto",
	...TYPECHECKER_VALUES,
];
export const LINTER_CHOICES: readonly Linter[] = LINTER_VALUES;
export const FORMATTER_CHOICES: readonly Formatter[] = FORMATTER_VALUES;

/**
 * Where `"auto"` lands when nothing is detected: `bun` because jyz itself runs on Bun,
 * `bun-check` because a Bun workspace is the house default typechecker.
 */
export const DETECTION_FALLBACK: {
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

export type PartialProject = Partial<JyzConfig["project"]>;

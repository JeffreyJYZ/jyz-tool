import { TOOL_VERSIONS } from "./defaults.ts";

export interface ToolingPlan {
	/** Files written on top of the rendered template, keyed by path relative to the project root. */
	files: Record<string, string>;
	/** Script commands replacing the template's, keyed by script name. */
	scripts: Record<string, string>;
	/** Dependencies the chosen toolchain needs, added to `devDependencies`. */
	devDependencies: Record<string, string>;
}

const FORMAT_COMMANDS: Record<string, string> = {
	biome: "biome format --write .",
	"bun-fmt": "bun fmt",
	prettier: "prettier --write .",
};

const LINT_COMMANDS: Record<string, string> = {
	biome: "biome check .",
	eslint: "eslint .",
	"bun-lint": "bun lint",
};

const TYPECHECK_COMMANDS: Record<string, string> = {
	"bun-check": "bun check",
	tsc: "tsc --noEmit",
	tsgo: "tsgo --noEmit",
	tsrs: "tsrs --noEmit",
};

export const CONFIG_FILENAME = "jyz.config.toml";

/**
 * Resolves the files a JavaScript project needs for the chosen formatter, linter and typechecker,
 * so a template never carries a config for a tool the project did not pick.
 */
export function planTooling(
	packageManager: string,
	typechecker: string,
	linter: string,
	formatter: string,
): ToolingPlan {
	const files: Record<string, string> = {};
	const devDependencies: Record<string, string> = {};
	const scripts: Record<string, string> = {};

	if (formatter === "biome" || linter === "biome") {
		files["biome.json"] = biomeConfig(formatter, linter);
		devDependencies["@biomejs/biome"] = TOOL_VERSIONS["@biomejs/biome"] ?? "latest";
	}
	if (formatter === "bun-fmt" || linter === "bun-lint") {
		files["bunfig.toml"] = bunfig(formatter, linter);
	}
	if (formatter === "prettier") {
		files[".prettierrc"] = prettierConfig();
		files[".prettierignore"] = PRETTIER_IGNORE;
		devDependencies.prettier = TOOL_VERSIONS.prettier ?? "latest";
	}
	if (linter === "eslint") {
		files["eslint.config.js"] = ESLINT_CONFIG;
		devDependencies.eslint = TOOL_VERSIONS.eslint ?? "latest";
		devDependencies["typescript-eslint"] = TOOL_VERSIONS["typescript-eslint"] ?? "latest";
	}

	const format = FORMAT_COMMANDS[formatter];
	if (format) scripts.format = format;
	const lint = LINT_COMMANDS[linter];
	if (lint) scripts.lint = lint;
	const typecheck = TYPECHECK_COMMANDS[typechecker];
	if (typecheck) scripts.typecheck = typecheck;

	files[CONFIG_FILENAME] = configFile(packageManager, typechecker, linter, formatter);

	return { files, scripts, devDependencies };
}

function biomeConfig(formatter: string, linter: string): string {
	const config = {
		$schema: "https://biomejs.dev/schemas/2.6.4/schema.json",
		files: {
			includes: [
				"**",
				"!**/node_modules",
				"!**/dist",
				"!**/.next",
				"!**/target",
				"!**/local",
			],
		},
		formatter: {
			enabled: formatter === "biome",
			indentStyle: "tab",
			indentWidth: 4,
			lineWidth: 100,
		},
		linter: { enabled: linter === "biome", rules: { preset: "recommended" } },
	};
	return `${JSON.stringify(config, null, "\t")}\n`;
}

function bunfig(formatter: string, linter: string): string {
	const sections: string[] = [];
	if (formatter === "bun-fmt") {
		sections.push("[fmt]\nuseTabs = true\ntabWidth = 4\nprintWidth = 100");
	}
	if (linter === "bun-lint") {
		sections.push("[lint]\nenabled = true");
	}
	return `${sections.join("\n\n")}\n`;
}

function prettierConfig(): string {
	const config = { useTabs: true, tabWidth: 4, printWidth: 100 };
	return `${JSON.stringify(config, null, "\t")}\n`;
}

const PRETTIER_IGNORE = [
	"bun.lock",
	"dist/",
	".next/",
	"node_modules/",
	"target/",
	"pnpm-lock.yaml",
	"",
].join("\n");

const ESLINT_CONFIG = `import tseslint from "typescript-eslint";

export default tseslint.config(...tseslint.configs.recommended, {
	ignores: ["dist/**", ".next/**", "node_modules/**"],
});
`;

function configFile(
	packageManager: string,
	typechecker: string,
	linter: string,
	formatter: string,
): string {
	return [
		"[project]",
		`package_manager = "${packageManager}"`,
		`typechecker = "${typechecker}"`,
		`linter = "${linter}"`,
		`formatter = "${formatter}"`,
		"",
	].join("\n");
}

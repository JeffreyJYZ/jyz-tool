import type { JyzConfig } from "../types/config.ts";

export const CONFIG_FILENAME = "jyz.config.toml";

export const DEFAULT_CONFIG: JyzConfig = {
	project: {
		package_manager: "auto",
		typechecker: "auto",
		linter: "biome",
		formatter: "biome",
	},
	aliases: {},
	scripts: {},
	create: {
		default_template: "cli",
		default_package_manager: "bun",
		git: "init",
	},
	monorepo: { default_filter: false },
};

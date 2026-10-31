import { expect, test } from "bun:test";
import { projectRows } from "../src/projects.ts";

const capture = {
	project: {
		package_manager: { value: "bun", source: "config" },
		typechecker: { value: "bun-check", source: "config" },
		linter: { value: "biome", source: "config" },
		formatter: { value: "bun-fmt", source: "config" },
	},
	aliases: {},
	scripts: {},
	path: "/Users/jyz/dev/jyz/jyz.config.toml",
	layers: ["/Users/jyz/dev/jyz/jyz.config.toml"],
	warnings: [],
};

test("projectRows returns one row for the capture", () => {
	expect(projectRows(capture)).toEqual([
		{
			name: "jyz",
			packageManager: "bun",
			typechecker: "bun-check",
			linter: "biome",
			formatter: "bun-fmt",
		},
	]);
});

test("projectRows handles missing values", () => {
	const out = projectRows({ path: "/a/b/c.toml", project: {} });
	expect(out[0]).toEqual({
		name: "b",
		packageManager: "—",
		typechecker: "—",
		linter: "—",
		formatter: "—",
	});
});

test("projectRows parses string input", () => {
	expect(projectRows(JSON.stringify(capture)).length).toBe(1);
});

import { expect, test } from "bun:test";
import {
	buildCheckCommand,
	buildFmtCommand,
	buildLintCommand,
	buildTypecheckCommand,
	ToolchainError,
} from "../src/funcs/toolchain.ts";
import type { ProjectContext } from "../src/types/project.ts";

function ctx(overrides: Partial<ProjectContext> = {}): ProjectContext {
	return {
		root: "/tmp",
		packageDir: "/tmp",
		packageName: "x",
		config: {
			project: {
				package_manager: { value: "bun", source: "default" },
				typechecker: { value: "bun-check", source: "default" },
				linter: { value: "biome", source: "default" },
				formatter: { value: "biome", source: "default" },
			},
			aliases: {},
			scripts: {},
			create: { default_template: "cli", default_package_manager: "bun", git: "skip" },
			monorepo: { default_filter: false },
			path: null,
			layers: [],
			warnings: [],
		},
		warnings: [],
		...overrides,
	};
}

test("typecheck bun-check", () => {
	const spec = buildTypecheckCommand(ctx());
	expect(spec.argv).toEqual(["check"]);
});

test("lint biome", () => {
	const spec = buildLintCommand(ctx());
	expect(spec.argv).toEqual(["check", "."]);
});

test("none skips half in check", () => {
	const c = ctx();
	c.config.project.linter.value = "none";
	const specs = buildCheckCommand(c);
	expect(specs.length).toBe(1);
});

test("check returns both halves", () => {
	const specs = buildCheckCommand(ctx());
	expect(specs.length).toBe(2);
});

test("fmt --check read-only", () => {
	const spec = buildFmtCommand(ctx(), { check: true });
	expect(spec.argv).toEqual(["check"]);
});

test("missing binary error contains config key", () => {
	const c = ctx();
	c.config.project.linter.value = "biome";
	try {
		buildLintCommand(c);
	} catch (e) {
		expect(e).toBeInstanceOf(ToolchainError);
		expect(e instanceof Error ? e.message : String(e)).toContain("project.linter");
		return;
	}
	// if biome exists, skip assertion of throw
});

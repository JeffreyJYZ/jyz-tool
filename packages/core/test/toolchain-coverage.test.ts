import { expect, test } from "bun:test";
import {
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

test("eslint lint", () => {
	const c = ctx();
	c.config.project.linter.value = "eslint";
	const spec = buildLintCommand(c);
	expect(spec.argv).toEqual(["."]);
});

test("clang-tidy lint", () => {
	const c = ctx();
	c.config.project.linter.value = "clang-tidy";
	const spec = buildLintCommand(c);
	expect(spec.argv).toEqual(["."]);
});

test("bun-lint lint", () => {
	const c = ctx();
	c.config.project.linter.value = "bun-lint";
	const spec = buildLintCommand(c);
	expect(spec.argv).toEqual(["lint"]);
});

test("cargo-clippy lint", () => {
	const c = ctx();
	c.config.project.linter.value = "cargo-clippy";
	const spec = buildLintCommand(c);
	expect(spec.argv).toEqual(["clippy", "--", "-D", "warnings"]);
});

test("clang typecheck", () => {
	const c = ctx();
	c.config.project.typechecker.value = "clang";
	const spec = buildTypecheckCommand(c);
	expect(spec.argv).toEqual(["-fsyntax-only", "."]);
});

test("cargo typecheck", () => {
	const c = ctx();
	c.config.project.typechecker.value = "cargo";
	const spec = buildTypecheckCommand(c);
	expect(spec.argv).toEqual(["check"]);
});

test("clang-format write", () => {
	const c = ctx();
	c.config.project.formatter.value = "clang-format";
	const spec = buildFmtCommand(c);
	expect(spec.argv).toEqual(["-i", "."]);
});

test("clang-format check", () => {
	const c = ctx();
	c.config.project.formatter.value = "clang-format";
	const spec = buildFmtCommand(c, { check: true });
	expect(spec.argv).toEqual(["--dry-run", "--Werror", "."]);
});

test("rustfmt write", () => {
	const c = ctx();
	c.config.project.formatter.value = "rustfmt";
	const spec = buildFmtCommand(c);
	expect(spec.argv).toEqual(["fmt", "--all"]);
});

test("rustfmt check", () => {
	const c = ctx();
	c.config.project.formatter.value = "rustfmt";
	const spec = buildFmtCommand(c, { check: true });
	expect(spec.argv).toEqual(["fmt", "--all", "--", "--check"]);
});

test("prettier write", () => {
	const c = ctx();
	c.config.project.formatter.value = "prettier";
	const spec = buildFmtCommand(c);
	expect(spec.argv).toEqual(["--write", "."]);
});

test("prettier check", () => {
	const c = ctx();
	c.config.project.formatter.value = "prettier";
	const spec = buildFmtCommand(c, { check: true });
	expect(spec.argv).toEqual(["--check", "."]);
});

test("missing binary throws", () => {
	const c = ctx();
	c.config.project.linter.value = "clang-tidy";
	c.packageDir = "/nonexistent";
	try {
		buildLintCommand(c);
	} catch (e) {
		expect(e).toBeInstanceOf(ToolchainError);
		return;
	}
});
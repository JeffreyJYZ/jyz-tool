import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildCheckSteps, runCheckPlan } from "../../cli/src/commands/toolchain.ts";
import { formatSpec } from "../../cli/src/lib/dispatch.ts";
import { buildCheckCommand, ToolchainError } from "../src/funcs/toolchain.ts";
import type { ProjectContext } from "../src/types/project.ts";
import { writeStub } from "./helpers/stub.ts";

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

function makeFixture(linterExit: number, typecheckExit: number) {
	const dir = mkdtempSync(join(tmpdir(), "jyz-agg-"));
	const marker = join(dir, "ran.txt");
	const binDir = join(dir, "node_modules", ".bin");
	mkdirSync(binDir, { recursive: true });
	const makeStub = (bin: string, code: number) => {
		writeStub(binDir, bin, { marker, exitCode: code });
	};
	makeStub("bun", typecheckExit);
	makeStub("biome", linterExit);
	const c = ctx();
	c.packageDir = dir;
	c.root = dir;
	return { dir, marker, ctx: c };
}

test("both halves run, headings shown, non-zero exit", async () => {
	const { ctx: c, marker } = makeFixture(1, 0);
	const steps = buildCheckSteps(c);
	const lines: string[] = [];
	const code = await runCheckPlan(steps, { log: (line) => lines.push(line) });
	expect(code).not.toBe(0);
	expect(lines).toEqual(["jyz check: typecheck", "jyz check: lint"]);
	const ran = await Bun.file(marker).text();
	expect(ran.trim().split("\n")).toEqual(["bun", "biome"]);
});

test("none linter runs only typecheck", async () => {
	const { ctx: c, marker } = makeFixture(1, 0);
	c.config.project.linter.value = "none";
	const steps = buildCheckSteps(c);
	const lines: string[] = [];
	const code = await runCheckPlan(steps, { log: (line) => lines.push(line) });
	expect(code).toBe(0);
	expect(lines).toEqual(["jyz check: typecheck"]);
	const ran = await Bun.file(marker).text();
	expect(ran.trim().split("\n")).toEqual(["bun"]);
});

test("nothing configured throws ToolchainError", () => {
	const c = ctx();
	c.config.project.typechecker.value = "none";
	c.config.project.linter.value = "none";
	expect(() => buildCheckCommand(c)).toThrow(ToolchainError);
});

test("verbose output matches dispatch shape", async () => {
	const { ctx: c } = makeFixture(1, 0);
	c.config.project.linter.value = "none";
	const steps = buildCheckSteps(c);
	const lines: string[] = [];
	await runCheckPlan(steps, {
		verbose: true,
		log: (line) => lines.push(line),
		run: async () => 0,
	});
	const step = steps[0];
	if (step === undefined) throw new Error("missing step");
	const spec = step.spec;
	const block = [`file: ${spec.file}`, `argv: ${spec.argv.join(" ")}`, `cwd:  ${spec.cwd}`].join(
		"\n",
	);
	expect(lines).toEqual(["jyz check: typecheck", formatSpec(spec)]);
	expect(lines[1]).toBe(block);
});

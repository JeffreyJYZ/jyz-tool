import { expect, test } from "bun:test";
import { formatConfigShow, lookupConfigValue } from "../src/lib/config-view.ts";
import { resolvedConfig } from "./fixtures.ts";

test("show prints every resolved value with its source", () => {
	const text = formatConfigShow(resolvedConfig("bun", "/tmp/jyz.config.toml"));
	const lines = text.split("\n");
	expect(lines[0]).toBe("config: /tmp/jyz.config.toml");
	expect(lines).toContain("project.package_manager = bun (detected)");
	expect(lines).toContain("project.typechecker = bun-check (detected)");
	expect(lines).toContain("project.linter = biome (detected)");
	expect(lines).toContain("project.formatter = biome (detected)");
	expect(lines).toContain("aliases: a=add, dev=run dev");
	expect(lines).toContain("create.git = init");
	expect(lines).toContain("monorepo.default_filter = false");
});

test("show reports a missing config file", () => {
	expect(formatConfigShow(resolvedConfig("pnpm"))).toContain("config: (none)");
});

test("get accepts a key with or without its section", () => {
	const config = resolvedConfig("bun");
	expect(lookupConfigValue(config, "project.linter")).toEqual({
		key: "project.linter",
		value: "biome",
	});
	expect(lookupConfigValue(config, "linter")).toEqual({ key: "project.linter", value: "biome" });
	expect(lookupConfigValue(config, "package_manager")).toEqual({
		key: "project.package_manager",
		value: "bun",
	});
});

test("get reads maps and nested keys", () => {
	const config = resolvedConfig("bun");
	expect(lookupConfigValue(config, "aliases.a")).toEqual({ key: "aliases.a", value: "add" });
	expect(lookupConfigValue(config, "scripts.e2e")?.value).toBe("bun test --timeout 60000");
	expect(lookupConfigValue(config, "create.default_template")?.value).toBe("cli");
	expect(lookupConfigValue(config, "monorepo.default_filter")?.value).toBe("false");
});

test("get returns null for an unknown key", () => {
	const config = resolvedConfig("bun");
	expect(lookupConfigValue(config, "nope")).toBeNull();
	expect(lookupConfigValue(config, "project.nope")).toBeNull();
	expect(lookupConfigValue(config, "aliases.missing")).toBeNull();
	expect(lookupConfigValue(config, "")).toBeNull();
});

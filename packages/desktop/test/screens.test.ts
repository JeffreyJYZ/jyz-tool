import { describe, expect, test } from "bun:test";
import {
	configRows,
	diffSessions,
	promptArgv,
	screenFromHash,
	screenHref,
	sessionRows,
} from "../src/screens.ts";

describe("configRows", () => {
	test("parses key = value (source) lines", () => {
		const stdout = [
			"config: /tmp/jyz.config.toml",
			"project.package_manager = bun (default)",
			"aliases: (none)",
			"layer: defaults",
			"warning: something",
			"scripts: (none)",
		].join("\n");
		expect(configRows(stdout)).toEqual([
			{ key: "project.package_manager", value: "bun", source: "default" },
		]);
	});
	test("malformed input yields []", () => {
		expect(configRows("garbage\nno equals")).toEqual([]);
	});
});

describe("sessionRows", () => {
	test("parses a JSON array", () => {
		const json = JSON.stringify([
			{ id: "s1", title: "one", updatedAt: "2026-01-01T00:00:00Z" },
			{ id: "s2", title: "", updatedAt: "" },
		]);
		expect(sessionRows(json)).toEqual([
			{ id: "s1", title: "one", updatedAt: "2026-01-01T00:00:00Z" },
			{ id: "s2", title: "", updatedAt: "" },
		]);
	});
	test("bad JSON or non-array is []", () => {
		expect(sessionRows("{bad")).toEqual([]);
		expect(sessionRows(JSON.stringify({ a: 1 }))).toEqual([]);
		expect(sessionRows("null")).toEqual([]);
	});
});

describe("diffSessions", () => {
	test("new, changed, unchanged, reordered", () => {
		const prev = [
			{ id: "a", title: "A", updatedAt: "1" },
			{ id: "b", title: "B", updatedAt: "2" },
		];
		const next = [
			{ id: "b", title: "B", updatedAt: "3" },
			{ id: "c", title: "C", updatedAt: "4" },
			{ id: "a", title: "A", updatedAt: "1" },
		];
		expect(diffSessions(prev, next)).toEqual(["b", "c"]);
	});
	test("unchanged list is []", () => {
		const rows = [{ id: "a", title: "A", updatedAt: "1" }];
		expect(diffSessions(rows, rows)).toEqual([]);
	});
});

describe("promptArgv", () => {
	test("builds argv", () => {
		expect(promptArgv("s1", "hi")).toEqual(["prompt", "hi", "--session", "s1", "--json"]);
	});
});

describe("screenFromHash", () => {
	test("every screen", () => {
		expect(screenFromHash("#call")).toBe("call");
		expect(screenFromHash("#config")).toBe("config");
		expect(screenFromHash("#opencode")).toBe("opencode");
		expect(screenFromHash("#settings")).toBe("settings");
		expect(screenFromHash("")).toBe("call");
	});
	test("junk maps to call", () => {
		expect(screenFromHash("#nope")).toBe("call");
		expect(screenFromHash("#/garbage")).toBe("call");
	});
});

describe("screenHref", () => {
	test("round trips", () => {
		expect(screenHref("config")).toBe("#config");
	});
});

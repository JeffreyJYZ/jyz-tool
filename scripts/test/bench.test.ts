import { expect, test } from "bun:test";
import { percentile, summarize, buildReport } from "../bench";

test("percentile known array", () => {
	const samples = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
	expect(percentile(samples, 50)).toBe(5);
	expect(percentile(samples, 95)).toBe(10);
	expect(percentile([], 50)).toBe(0);
});

test("summarize empty", () => {
	expect(summarize([])).toEqual({ min: 0, p50: 0, p95: 0, max: 0 });
});

test("summarize single", () => {
	expect(summarize([42])).toEqual({ min: 42, p50: 42, p95: 42, max: 42 });
});

test("json shape from stubbed run list", () => {
	const report = buildReport([
		{ name: "a", samples: [1, 2, 3] },
		{ name: "b", samples: [] },
	]);
	expect(Object.keys(report)).toEqual(["cases"]);
	expect(report.cases.length).toBe(2);
	expect(Object.keys(report.cases[0]!)).toEqual(["name", "min", "p50", "p95", "max"]);
	expect(report.cases[1]!.p50).toBe(0);
});

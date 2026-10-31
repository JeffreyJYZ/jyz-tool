import { describe, expect, test } from "bun:test";
import { eventLines, runSummary } from "../src/run.ts";

describe("runSummary", () => {
	test("success", () => {
		const r = runSummary({ exitCode: 0, stdout: "ok", argv: ["bun", "test"] });
		expect(r.state).toBe("ok");
		expect(r.text).toContain("bun test");
		expect(r.text).toContain("ok");
	});
	test("non-zero", () => {
		const r = runSummary({ exitCode: 1, stdout: "out", stderr: "boom", argv: ["x"] });
		expect(r.state).toBe("error");
		expect(r.text).toContain("boom");
	});
	test("missing stdout", () => {
		const r = runSummary({ exitCode: 0, argv: ["y"] });
		expect(r.state).toBe("ok");
		expect(r.text).toContain("y");
	});
	test("stderr-only failure", () => {
		const r = runSummary({ exitCode: 2, stderr: "only err" });
		expect(r.state).toBe("error");
		expect(r.text).toContain("only err");
	});
});

describe("eventLines", () => {
	test("two good lines", () => {
		const text = '{"type":"a","summary":"one"}\n{"type":"b","summary":"two"}';
		expect(eventLines(text)).toEqual([
			{ type: "a", summary: "one" },
			{ type: "b", summary: "two" },
		]);
	});
	test("one junk line", () => {
		const text = '{"type":"a","summary":"one"}\nnot json\n';
		expect(eventLines(text)).toEqual([{ type: "a", summary: "one" }]);
	});
	test("empty input", () => {
		expect(eventLines("")).toEqual([]);
	});
});

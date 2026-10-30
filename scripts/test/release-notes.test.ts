import { expect, test } from "bun:test";
import { buildNotes } from "../release-notes";

test("groups by type", () => {
	const r = buildNotes([
		{ subject: "feat: add x" },
		{ subject: "fix: bug" },
		{ subject: "chore: tidy" },
	]);
	expect(Object.keys(r.groups)).toEqual(["feat", "fix", "chore"]);
	expect(r.markdown).toContain("### feat");
});

test("scope rendering", () => {
	const r = buildNotes([{ subject: "feat(cli): add cmd" }]);
	expect(r.groups.feat).toEqual(["cli: add cmd"]);
});

test("empty range", () => {
	const r = buildNotes([]);
	expect(r.markdown).toBe("No changes");
	expect(r.groups).toEqual({});
});

test("unknown type fallback", () => {
	const r = buildNotes([{ subject: "random stuff" }]);
	expect(r.groups.Other).toEqual(["random stuff"]);
});

test("deterministic ordering", () => {
	const r = buildNotes([{ subject: "fix: b" }, { subject: "feat: a" }]);
	expect(Object.keys(r.groups)).toEqual(["feat", "fix"]);
});

import { describe, expect, test } from "bun:test";
import { screenFromHash } from "../src/screens.ts";
import { describeUpdate, updateCheckFailed } from "../src/updates.ts";

describe("describeUpdate", () => {
	test("shapes an offer", () => {
		expect(describeUpdate({ current: "0.1.0", version: "0.2.0", notes: "fixes" })).toEqual({
			headline: "update available: 0.2.0",
			detail: "fixes",
		});
	});
	test("null offer is null", () => {
		expect(describeUpdate(null)).toBeNull();
	});
	test("null notes becomes empty detail", () => {
		expect(describeUpdate({ current: "0.1.0", version: "0.2.0", notes: null })).toEqual({
			headline: "update available: 0.2.0",
			detail: "",
		});
	});
});

describe("updateCheckFailed", () => {
	test("Error uses message", () => {
		expect(updateCheckFailed(new Error("boom"))).toBe("boom");
	});
	test("string is returned", () => {
		expect(updateCheckFailed("nope")).toBe("nope");
	});
});

describe("tabs still map from the hash", () => {
	test("hash routing unaffected", () => {
		expect(screenFromHash("#config")).toBe("config");
		expect(screenFromHash("#nope")).toBe("call");
	});
});

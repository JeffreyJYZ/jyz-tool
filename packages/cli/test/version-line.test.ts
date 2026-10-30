import { describe, expect, test } from "bun:test";

import { versionLine } from "../src/lib/version-line.ts";

describe("versionLine", () => {
	test("names jyz, the platform and the runtime that is actually running", () => {
		const line = versionLine("1.4.4");
		expect(line).toMatch(/^jyz\/\d+\.\d+\.\d+/);
		expect(line).toContain(`${process.platform}-${process.arch}`);
		expect(line.endsWith(" bun-1.4.4")).toBe(true);
	});

	test("never falls back to the node compatibility version", () => {
		// Bun reports `process.version` as the Node version it emulates, which is not what a person
		// checking a bug report should read back to us.
		expect(versionLine()).not.toContain(`bun-${process.version}`);
	});
});

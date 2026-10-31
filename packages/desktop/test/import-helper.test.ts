import { describe, expect, test } from "bun:test";
import { configRows as page } from "../src/main.ts";
import { configRows as helper } from "../src/screens.ts";

describe("desktop imports tested helpers", () => {
	test("the page uses the same configRows function object as screens.ts", () => {
		expect(page).toBe(helper);
	});
});

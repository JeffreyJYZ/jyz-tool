import { expect, test } from "bun:test";
import { availableTemplates } from "../src/create/options.ts";
import type { Template } from "../src/types/create.ts";

/**
 * A template named in the `Template` type but missing on disk is dropped from the list silently, so
 * `jyz create --template rust-lib` answered "not available in this build" while the plan promised
 * it. Every declared template must be offered.
 */
test("every declared template is available", () => {
	const declared: Template[] = [
		"next",
		"vite-tauri",
		"cli",
		"rust-bin",
		"rust-lib",
		"c",
		"monorepo",
	];
	const available = availableTemplates();
	for (const template of declared) expect(available).toContain(template);
	expect(available.sort()).toEqual([...declared].sort());
});

import { describe, expect, test } from "bun:test";
import { listCapabilities } from "../../core/src/funcs/capabilities.ts";
import { selectableMethods } from "../src/bridge.ts";

describe("desktop parity", () => {
	test("every capability the manifest exposes is selectable in the UI path", () => {
		const manifest = listCapabilities();
		const names = manifest.map((capability) => capability.name);
		expect(selectableMethods(manifest)).toEqual(names);
	});
});

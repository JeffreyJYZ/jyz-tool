import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..", "..");

test("mcp manifest is publishable", () => {
	const pkg = JSON.parse(
		readFileSync(join(ROOT, "packages", "mcp", "package.json"), "utf8"),
	) as Record<string, unknown>;
	expect(pkg.private).toBeUndefined();
	expect(pkg.name).toBe("@jyz/mcp");
	expect(typeof pkg.description).toBe("string");
	expect(pkg.license).toBe("MIT");
	expect((pkg.engines as Record<string, string>).bun).toBeTruthy();
	// src/ is not shipped: the bundle carries core, the shim picks it in a packed install.
	expect(pkg.files).toContain("dist");
	expect((pkg.bin as Record<string, string>)["jyz-mcp"]).toBe("./bin/jyz-mcp.mjs");
	expect((pkg.publishConfig as Record<string, string>).access).toBe("public");
	expect((pkg.dependencies as Record<string, string>)["@jyz/core"]).not.toBe("workspace:*");
});

test("initialize frame is valid jsonrpc", () => {
	const frame = {
		jsonrpc: "2.0",
		id: 1,
		method: "initialize",
		params: { protocolVersion: "2024-11-05" },
	};
	const s = JSON.stringify(frame);
	const parsed = JSON.parse(s) as typeof frame;
	expect(parsed.jsonrpc).toBe("2.0");
	expect(parsed.method).toBe("initialize");
});

import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..", "..");
const PKG = join(ROOT, "packages", "mcp", "package.json");

test("mcp manifest ships", () => {
	const pkg = JSON.parse(readFileSync(PKG, "utf8")) as Record<string, unknown>;
	const bin = pkg.bin as Record<string, string>;
	expect(bin["jyz-mcp"]).toBe("./src/bin.ts");
	const binPath = join(ROOT, "packages", "mcp", "src", "bin.ts");
	expect(readFileSync(binPath, "utf8").startsWith("#!/usr/bin/env bun")).toBe(true);
	expect(typeof pkg.description).toBe("string");
	expect(pkg.license).toBe("MIT");
	expect((pkg.engines as Record<string, string>).bun).toBeTruthy();
	expect(pkg.files).toContain("src/**");
	expect((pkg.publishConfig as Record<string, string>).access).toBe("public");
});

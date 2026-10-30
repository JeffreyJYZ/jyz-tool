import { expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { listResources, readResource, UnknownResourceError } from "../src/resources.ts";

test("lists two resources", () => {
	expect(listResources()).toHaveLength(2);
});

test("reads config resource", () => {
	const dir = mkdtempSync(join(tmpdir(), "jyz-mcp-"));
	writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "fixture", version: "1.0.0" }));
	writeFileSync(join(dir, "jyz.config.toml"), "[project]\npackage_manager = \"bun\"\n");
	const r = readResource("jyz://config", dir);
	expect(r.mimeType).toBe("application/json");
	const payload = JSON.parse(r.text);
	expect(payload.project.package_manager.value).toBe("bun");
});

test("reads capabilities resource", () => {
	const r = readResource("jyz://capabilities");
	const payload = JSON.parse(r.text);
	expect(Array.isArray(payload.capabilities)).toBe(true);
});

test("unknown uri throws typed error", () => {
	expect(() => readResource("jyz://nope")).toThrow(UnknownResourceError);
});

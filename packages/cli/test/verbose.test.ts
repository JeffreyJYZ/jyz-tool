import { expect, test } from "bun:test";
import { formatSpec } from "../src/lib/dispatch.ts";
import { spec } from "./fixtures.ts";

test("verbose output names the file, the argv and the cwd", () => {
	const text = formatSpec(spec("bun", ["run", "build", "--watch"], "/tmp/project"));
	expect(text).toBe("file: bun\nargv: run build --watch\ncwd:  /tmp/project");
});

test("verbose output keeps an argv with spaces readable as one line", () => {
	const text = formatSpec(spec("pnpm", ["add", "-D", "typescript"], "/tmp/project"));
	const lines = text.split("\n");
	expect(lines).toHaveLength(3);
	expect(lines[0]).toBe("file: pnpm");
	expect(lines[1]).toBe("argv: add -D typescript");
	expect(lines[2]).toBe("cwd:  /tmp/project");
});

test("verbose output keeps an empty argv as an empty line", () => {
	expect(formatSpec(spec("bun", [], "/tmp/project"))).toContain("argv: \n");
});

import { expect, test } from "bun:test";
import { callTool, UnknownToolError } from "../src/handler.ts";
import { listTools } from "../src/tools.ts";

test("lists 13 tools", () => {
	expect(listTools()).toHaveLength(13);
});

test("unknown tool throws", () => {
	expect(callTool("nope", {}, "/tmp")).rejects.toBeInstanceOf(UnknownToolError);
});

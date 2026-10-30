import { expect, test } from "bun:test";
import { parseVerbArgs } from "../src/lib/args.ts";

test("install forwards its arguments", () => {
	const term = parseVerbArgs(["install", "--frozen-lockfile"], { verb: "install" });
	expect(term.args).toEqual(["--frozen-lockfile"]);
	expect(term.dev).toBe(false);
});

test("install keeps --dev when the verb has no dev flag", () => {
	const term = parseVerbArgs(["install", "--dev"], { verb: "install" });
	expect(term.args).toEqual(["--dev"]);
	expect(term.dev).toBe(false);
});

test("add consumes -D and --dev", () => {
	expect(parseVerbArgs(["add", "-D", "typescript"], { verb: "add", dev: true }).dev).toBe(true);
	expect(parseVerbArgs(["add", "--dev", "typescript"], { verb: "add", dev: true }).dev).toBe(
		true,
	);
	const term = parseVerbArgs(["add", "-D", "typescript", "--exact"], { verb: "add", dev: true });
	expect(term.args).toEqual(["typescript", "--exact"]);
});

test("update consumes --latest and keeps the packages", () => {
	const term = parseVerbArgs(["update", "--latest", "react"], { verb: "update", latest: true });
	expect(term.latest).toBe(true);
	expect(term.args).toEqual(["react"]);
});

test("filter takes the next token or an inline value", () => {
	const spaced = parseVerbArgs(["run", "-F", "web", "build"], { verb: "run", filter: true });
	expect(spaced.filter).toBe("web");
	expect(spaced.args).toEqual(["build"]);

	const inline = parseVerbArgs(["run", "--filter=web", "build"], { verb: "run", filter: true });
	expect(inline.filter).toBe("web");
	expect(inline.args).toEqual(["build"]);
});

test("filter and verbose are forwarded when the verb does not own them", () => {
	const term = parseVerbArgs(["install", "--filter", "web", "--verbose"], { verb: "install" });
	expect(term.filter).toBeUndefined();
	expect(term.args).toEqual(["--filter", "web"]);
	expect(term.verbose).toBe(true);
});

test("the verb is dropped wherever a global flag put it", () => {
	const term = parseVerbArgs(["--verbose", "install"], { verb: "install" });
	expect(term.verbose).toBe(true);
	expect(term.args).toEqual([]);
});

test("the exec alias is dropped by name", () => {
	const term = parseVerbArgs(["x", "tsc", "--noEmit"], { verb: "exec", aliases: ["x"] });
	expect(term.args).toEqual(["tsc", "--noEmit"]);
});

test("-- is forwarded verbatim", () => {
	const term = parseVerbArgs(["run", "build", "--", "--watch"], { verb: "run" });
	expect(term.args).toEqual(["build", "--", "--watch"]);
});

import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { cac } from "cac";
import { writeStub } from "../../core/test/helpers/stub.ts";
import { registerOc } from "../src/commands/oc.ts";

const realPath = process.env.PATH;
const realUrl = process.env.JYZ_OPENCODE_URL;
const _realExitCode = process.exitCode;

afterEach(() => {
	process.env.PATH = realPath ?? "";
	if (realUrl === undefined) delete process.env.JYZ_OPENCODE_URL;
	else process.env.JYZ_OPENCODE_URL = realUrl;
	process.exitCode = 0;
});

function makeFailingStub(): void {
	const dir = mkdtempSync(join(tmpdir(), "jyz-stub-"));
	writeStub(dir, "opencode", { exitCode: 1 });
	process.env.PATH = `${dir}:${process.env.PATH ?? ""}`;
}

function captureLogs(): { lines: string[]; restore: () => void } {
	const lines: string[] = [];
	const info = console.info;
	const log = console.log;
	const error = console.error;
	const push = (...args: unknown[]) => void lines.push(args.join(" "));
	console.info = push;
	console.log = push;
	console.error = push;
	return {
		lines,
		restore: () => {
			console.info = info;
			console.log = log;
			console.error = error;
		},
	};
}

describe("oc --spawn", () => {
	test("a failing stub exits non-zero and reports the reason", async () => {
		process.env.JYZ_OPENCODE_URL = "http://127.0.0.1:18199";
		makeFailingStub();
		const logs = captureLogs();
		const cli = cac("jyz");
		registerOc(cli);
		try {
			cli.parse(["bun", "jyz", "oc", "sessions", "--spawn"], { run: false });
			const returned = cli.runMatchedCommand();
			if (returned instanceof Promise) await returned;
		} finally {
			logs.restore();
		}
		expect(process.exitCode).toBe(1);
		expect(logs.lines.join("\n")).toContain("exit");
	});
});

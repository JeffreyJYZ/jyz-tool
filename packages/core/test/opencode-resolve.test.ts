import { describe, expect, test } from "bun:test";

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { DEFAULT_OPENCODE_URL, resolveServer } from "../src/funcs/opencode/index.ts";

describe("resolveServer", () => {
	test("defaults to the stock local address with no token", () => {
		expect(resolveServer({ env: {} })).toEqual({
			baseUrl: DEFAULT_OPENCODE_URL,
			source: "default",
		});
	});

	test("reads the url and token from the environment", () => {
		expect(
			resolveServer({
				env: { JYZ_OPENCODE_URL: "http://10.0.0.2:5000", JYZ_OPENCODE_TOKEN: "tok" },
			}),
		).toEqual({ baseUrl: "http://10.0.0.2:5000", token: "tok", source: "env" });
	});

	test("a flag beats the environment", () => {
		expect(
			resolveServer({
				url: "http://127.0.0.1:9000",
				env: { JYZ_OPENCODE_URL: "http://10.0.0.2:5000", JYZ_OPENCODE_TOKEN: "tok" },
			}),
		).toEqual({ baseUrl: "http://127.0.0.1:9000", token: "tok", source: "flag" });
	});

	test("a blank flag falls through to the environment", () => {
		expect(
			resolveServer({ url: "   ", env: { JYZ_OPENCODE_URL: "http://10.0.0.2:5000" } }),
		).toEqual({ baseUrl: "http://10.0.0.2:5000", source: "env" });
	});

	test("a blank environment value falls through to the default", () => {
		expect(resolveServer({ env: { JYZ_OPENCODE_URL: "  " } })).toEqual({
			baseUrl: DEFAULT_OPENCODE_URL,
			source: "default",
		});
	});

	test("strips a trailing slash so paths never double up", () => {
		expect(resolveServer({ url: "http://127.0.0.1:4096/" }).baseUrl).toBe(
			"http://127.0.0.1:4096",
		);
	});

	test("reads url and password from the opencode service file", () => {
		const dir = mkdtempSync(join(tmpdir(), "jyz-oc-"));
		mkdirSync(join(dir, "opencode"), { recursive: true });
		writeFileSync(
			join(dir, "opencode", "service.json"),
			JSON.stringify({ url: "http://127.0.0.1:49374", password: "secret" }),
		);
		try {
			expect(resolveServer({ env: { XDG_STATE_HOME: dir } })).toEqual({
				baseUrl: "http://127.0.0.1:49374",
				password: "secret",
				source: "service",
			});
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	test("a missing service file falls through to the default", () => {
		const dir = mkdtempSync(join(tmpdir(), "jyz-oc-"));
		try {
			expect(resolveServer({ env: { XDG_STATE_HOME: dir } })).toEqual({
				baseUrl: DEFAULT_OPENCODE_URL,
				source: "default",
			});
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	test("a malformed service file falls through to the default", () => {
		const dir = mkdtempSync(join(tmpdir(), "jyz-oc-"));
		mkdirSync(join(dir, "opencode"), { recursive: true });
		writeFileSync(join(dir, "opencode", "service.json"), "{not json");
		try {
			expect(resolveServer({ env: { XDG_STATE_HOME: dir } })).toEqual({
				baseUrl: DEFAULT_OPENCODE_URL,
				source: "default",
			});
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	test("an empty url in the service file falls through to the default", () => {
		const dir = mkdtempSync(join(tmpdir(), "jyz-oc-"));
		mkdirSync(join(dir, "opencode"), { recursive: true });
		writeFileSync(
			join(dir, "opencode", "service.json"),
			JSON.stringify({ url: "  ", password: "secret" }),
		);
		try {
			expect(resolveServer({ env: { XDG_STATE_HOME: dir } })).toEqual({
				baseUrl: DEFAULT_OPENCODE_URL,
				source: "default",
			});
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dir, "..", "..");

describe("updater config", () => {
	test("createUpdaterArtifacts is true", () => {
		const conf = JSON.parse(
			readFileSync(
				path.join(root, "packages", "desktop", "src-tauri", "tauri.conf.json"),
				"utf8",
			),
		);
		expect(conf.bundle.createUpdaterArtifacts).toBe(true);
	});

	test("pubkey decodes from base64 and starts with untrusted comment:", () => {
		const conf = JSON.parse(
			readFileSync(
				path.join(root, "packages", "desktop", "src-tauri", "tauri.conf.json"),
				"utf8",
			),
		);
		const pubkey = conf.plugins.updater.pubkey as string;
		const decoded = Buffer.from(pubkey, "base64").toString("utf8");
		expect(decoded.startsWith("untrusted comment:")).toBe(true);
	});

	test("endpoint is the GitHub URL", () => {
		const conf = JSON.parse(
			readFileSync(
				path.join(root, "packages", "desktop", "src-tauri", "tauri.conf.json"),
				"utf8",
			),
		);
		expect(conf.plugins.updater.endpoints).toEqual([
			"https://github.com/JeffreyJYZ/jyz-tool/releases/latest/download/latest.json",
		]);
	});

	test("Cargo manifest carries the plugin", () => {
		const cargo = readFileSync(
			path.join(root, "packages", "desktop", "src-tauri", "Cargo.toml"),
			"utf8",
		);
		expect(cargo).toContain("tauri-plugin-updater");
	});

	test("lib.rs registers the plugin", () => {
		const lib = readFileSync(
			path.join(root, "packages", "desktop", "src-tauri", "src", "lib.rs"),
			"utf8",
		);
		expect(lib).toContain("tauri_plugin_updater");
	});
});

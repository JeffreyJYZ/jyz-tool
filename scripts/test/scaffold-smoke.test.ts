import { describe, expect, test } from "bun:test";
import {
	checkCliBin,
	checkCliManifest,
	checkConfig,
	checkUpdaterRs,
} from "../smoke/scaffold-checks";

describe("scaffold smoke checks", () => {
	test("updater.rs passes when both tokens present", () => {
		const text = "use tauri_plugin_updater::UpdaterExt;\nupdate.download_and_install().await;";
		const r = checkUpdaterRs(text);
		expect(r.ok).toBe(true);
	});

	test("updater.rs fails when UpdaterExt missing", () => {
		const r = checkUpdaterRs("download_and_install()");
		expect(r.ok).toBe(false);
		expect(r.detail).toContain("UpdaterExt");
	});

	test("config passes with all required fields", () => {
		const conf = {
			bundle: { createUpdaterArtifacts: true },
			plugins: { updater: { pubkey: "abc", endpoints: ["https://x"] } },
		};
		expect(checkConfig(conf).ok).toBe(true);
	});

	test("config fails without endpoints", () => {
		const conf = {
			bundle: { createUpdaterArtifacts: true },
			plugins: { updater: { pubkey: "abc", endpoints: [] } },
		};
		expect(checkConfig(conf).ok).toBe(false);
	});

	test("cli manifest passes when bin points at src/bin.ts", () => {
		const m = { bin: { jyz: "./src/bin.ts" } };
		expect(checkCliManifest(m).ok).toBe(true);
	});

	test("cli manifest fails without bin", () => {
		expect(checkCliManifest({}).ok).toBe(false);
	});

	test("cli bin passes with cac import and call", () => {
		const text = 'import { cac } from "cac";\nconst cli = cac("x");\n';
		expect(checkCliBin(text).ok).toBe(true);
	});

	test("cli bin fails without cac", () => {
		expect(checkCliBin("console.log(1)").ok).toBe(false);
	});
});

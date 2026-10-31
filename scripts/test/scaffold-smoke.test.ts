import { describe, expect, test } from "bun:test";
import { checkConfig, checkUpdaterRs } from "../smoke/scaffold-checks";

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
});

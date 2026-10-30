import { describe, expect, test } from "bun:test";
import {
	assetPlan,
	expectedTag,
	refusals,
	requiredAssets,
	signatureVersion,
	uptodateDmgName,
} from "../release-local";

describe("expectedTag", () => {
	test("alpha", () => {
		expect(expectedTag("0.1.0-alpha.10")).toBe("v0.1.0-alpha.10");
	});
	test("stable", () => {
		expect(expectedTag("1.2.3")).toBe("v1.2.3");
	});
});

describe("signatureVersion", () => {
	test("decodes version", () => {
		const body = Buffer.from("version:0.1.0-alpha.10\nother").toString("base64");
		expect(signatureVersion(body)).toBe("0.1.0-alpha.10");
	});
	test("junk", () => {
		expect(signatureVersion("!!!not base64!!!")).toBeNull();
	});
});

describe("assetPlan", () => {
	test("names", () => {
		const names = assetPlan("0.1.0-alpha.10", "jyz_0.1.0-alpha.10.dmg").map((a) => a.name);
		expect(names).toContain("jyz.app.tar.gz");
		expect(names).toContain("jyz.app.tar.gz.sig");
		expect(names).toContain("jyz_0.1.0-alpha.10.dmg");
		expect(names).toContain("latest.json");
	});
});

describe("requiredAssets", () => {
	test("a release that cannot self-update is missing one of these", () => {
		const names = requiredAssets("jyz_0.1.0-alpha.10_aarch64.dmg").map((asset) => asset.name);
		expect(names).toEqual([
			"jyz.app.tar.gz",
			"jyz.app.tar.gz.sig",
			"jyz_0.1.0-alpha.10_aarch64.dmg",
			"latest.json",
		]);
	});
});

describe("uptodateDmgName", () => {
	test("picks the dist name the release actually uploads", () => {
		const names = [
			"desktop-0.1.0-alpha.10-darwin-arm64.dmg",
			"desktop-0.1.0-alpha.11-darwin-arm64.dmg",
			"latest.json",
		];
		expect(uptodateDmgName(names, "0.1.0-alpha.11")).toBe(
			"desktop-0.1.0-alpha.11-darwin-arm64.dmg",
		);
	});

	test("a stale dmg from the previous version is not this release's", () => {
		expect(uptodateDmgName(["desktop-0.1.0-alpha.10-darwin-arm64.dmg"], "0.1.0-alpha.11")).toBe(
			null,
		);
	});
});

describe("refusals", () => {
	const goodSig = Buffer.from("version:0.1.0-alpha.10").toString("base64");
	test("clean", () => {
		expect(
			refusals({
				signature: goodSig,
				version: "0.1.0-alpha.10",
				archiveMtime: 10,
				appMtime: 5,
				dmgName: "x.dmg",
			}),
		).toEqual([]);
	});
	test("broken", () => {
		const r = refusals({
			signature: "",
			version: "0.1.0-alpha.10",
			archiveMtime: 1,
			appMtime: 5,
			dmgName: null,
		});
		expect(r.length).toBe(3);
	});
});

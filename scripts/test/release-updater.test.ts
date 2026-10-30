import { expect, test } from "bun:test";

import {
	checkAssets,
	collectUpdaterExtras,
	hasThreePlatforms,
	manifestPlatformCount,
	PLATFORMS,
	partialManifestName,
} from "../verify-release";

const VERSION = "0.1.0-alpha.2";

function assets(names: string[]) {
	return names.map((name) => ({ name }));
}

test("collectUpdaterExtras keeps .sig and latest.json", () => {
	const names = ["foo.dmg", "foo.app.tar.gz", "foo.app.tar.gz.sig", "latest.json", "foo.msi"];
	expect(collectUpdaterExtras(names)).toEqual(["foo.app.tar.gz.sig", "latest.json"]);
});

test("collectUpdaterExtras returns empty when none", () => {
	expect(collectUpdaterExtras(["foo.dmg", "foo.msi"])).toEqual([]);
});

test("checkAssets reports missing latest.json", () => {
	const names = [
		`core-${VERSION}.tgz`,
		`mcp-${VERSION}.tgz`,
		...PLATFORMS.map((p) => `cli-${VERSION}-${p}`),
		...PLATFORMS.map((p) => `mcp-${VERSION}-${p}`),
		...PLATFORMS.map((p) => `desktop-${VERSION}-${p}.dmg`),
		`foo.sig`,
	];
	const problems = checkAssets(assets(names), VERSION);
	expect(problems).toContain("missing latest.json");
});

test("checkAssets reports missing .sig", () => {
	const names = [
		`core-${VERSION}.tgz`,
		`mcp-${VERSION}.tgz`,
		...PLATFORMS.map((p) => `cli-${VERSION}-${p}`),
		...PLATFORMS.map((p) => `mcp-${VERSION}-${p}`),
		...PLATFORMS.map((p) => `desktop-${VERSION}-${p}.dmg`),
		`latest.json`,
	];
	const problems = checkAssets(assets(names), VERSION);
	expect(problems).toContain("missing .sig");
});

test("checkAssets passes with latest.json and a .sig", () => {
	const names = [
		`core-${VERSION}.tgz`,
		`mcp-${VERSION}.tgz`,
		...PLATFORMS.map((p) => `cli-${VERSION}-${p}`),
		...PLATFORMS.map((p) => `mcp-${VERSION}-${p}`),
		...PLATFORMS.map((p) => `desktop-${VERSION}-${p}.dmg`),
		`latest.json`,
		`foo.app.tar.gz.sig`,
	];
	expect(checkAssets(assets(names), VERSION)).toEqual([]);
});

test("partialManifestName names the platform", () => {
	expect(partialManifestName("darwin-arm64")).toBe("latest-darwin-arm64.json");
	expect(partialManifestName("linux-x64")).toBe("latest-linux-x64.json");
});

test("manifestPlatformCount counts platforms", () => {
	expect(manifestPlatformCount({ platforms: { a: 1, b: 2, c: 3 } })).toBe(3);
	expect(manifestPlatformCount({ platforms: {} })).toBe(0);
	expect(manifestPlatformCount(null)).toBe(0);
});

test("hasThreePlatforms requires three", () => {
	expect(hasThreePlatforms({ platforms: { a: 1, b: 2, c: 3 } })).toBe(true);
	expect(hasThreePlatforms({ platforms: { a: 1, b: 2 } })).toBe(false);
});

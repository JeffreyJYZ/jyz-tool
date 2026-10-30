import { expect, test } from "bun:test";
import { checkAssets, PLATFORMS } from "../verify-release";

const VERSION = "0.1.0-alpha.2";

function assets(names: string[]) {
	return names.map((name) => ({ name }));
}

test("happy path", () => {
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

test("missing mcp package", () => {
	const names = [
		`core-${VERSION}.tgz`,
		...PLATFORMS.map((p) => `cli-${VERSION}-${p}`),
		...PLATFORMS.map((p) => `desktop-${VERSION}-${p}.dmg`),
	];
	const problems = checkAssets(assets(names), VERSION);
	expect(problems).toContain(`missing mcp-${VERSION}.tgz`);
	expect(problems).toContain("missing mcp binary");
});

test("missing cli asset", () => {
	const names = [`core-${VERSION}.tgz`, ...PLATFORMS.map((p) => `desktop-${VERSION}-${p}.dmg`)];
	const problems = checkAssets(assets(names), VERSION);
	expect(problems).toContain("missing cli asset");
});

test("missing desktop asset", () => {
	const names = [`core-${VERSION}.tgz`, ...PLATFORMS.map((p) => `cli-${VERSION}-${p}`)];
	const problems = checkAssets(assets(names), VERSION);
	expect(problems).toContain("missing desktop asset");
});

test("missing platform", () => {
	const names = [
		`core-${VERSION}.tgz`,
		...PLATFORMS.slice(1).map((p) => `cli-${VERSION}-${p}`),
		...PLATFORMS.slice(1).map((p) => `desktop-${VERSION}-${p}.dmg`),
	];
	const problems = checkAssets(assets(names), VERSION, { requireAllPlatforms: true });
	expect(problems.some((p) => p.includes("darwin-arm64"))).toBe(true);
});

test("empty asset list", () => {
	const problems = checkAssets([], VERSION);
	expect(problems.length).toBeGreaterThan(0);
});

test("macOS-only passes by default", () => {
	const names = [
		`core-${VERSION}.tgz`,
		`mcp-${VERSION}.tgz`,
		`cli-${VERSION}-darwin-arm64`,
		`mcp-${VERSION}-darwin-arm64`,
		`desktop-${VERSION}-darwin-arm64.dmg`,
		`latest.json`,
		`foo.app.tar.gz.sig`,
	];
	expect(checkAssets(assets(names), VERSION)).toEqual([]);
});

test("macOS-only fails with requireAllPlatforms", () => {
	const names = [
		`core-${VERSION}.tgz`,
		`mcp-${VERSION}.tgz`,
		`cli-${VERSION}-darwin-arm64`,
		`mcp-${VERSION}-darwin-arm64`,
		`desktop-${VERSION}-darwin-arm64.dmg`,
		`latest.json`,
		`foo.app.tar.gz.sig`,
	];
	const problems = checkAssets(assets(names), VERSION, { requireAllPlatforms: true });
	expect(problems.length).toBeGreaterThan(0);
});

test("missing latest.json", () => {
	const names = [
		`core-${VERSION}.tgz`,
		`mcp-${VERSION}.tgz`,
		`cli-${VERSION}-darwin-arm64`,
		`mcp-${VERSION}-darwin-arm64`,
		`desktop-${VERSION}-darwin-arm64.dmg`,
		`foo.app.tar.gz.sig`,
	];
	const problems = checkAssets(assets(names), VERSION);
	expect(problems).toContain("missing latest.json");
});

test("no platform string", () => {
	const names = [
		`core-${VERSION}.tgz`,
		`mcp-${VERSION}.tgz`,
		`cli-${VERSION}`,
		`desktop-${VERSION}.dmg`,
		`latest.json`,
		`foo.app.tar.gz.sig`,
	];
	const problems = checkAssets(assets(names), VERSION);
	expect(problems.some((p) => p.includes("platform"))).toBe(true);
});

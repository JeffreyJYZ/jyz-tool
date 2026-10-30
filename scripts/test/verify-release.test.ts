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
	const problems = checkAssets(assets(names), VERSION);
	expect(problems.some((p) => p.includes("darwin-arm64"))).toBe(true);
});

test("empty asset list", () => {
	const problems = checkAssets([], VERSION);
	expect(problems.length).toBeGreaterThan(0);
});

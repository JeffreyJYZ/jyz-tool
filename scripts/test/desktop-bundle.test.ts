import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dir, "..", "..");

test("tauri.conf.json declares the sidecar externalBin", () => {
	const conf = JSON.parse(
		readFileSync(
			path.join(root, "packages", "desktop", "src-tauri", "tauri.conf.json"),
			"utf8",
		),
	);
	expect(conf.bundle.active).toBe(true);
	expect(conf.bundle.targets).toBe("all");
	expect(conf.bundle.externalBin).toEqual(["binaries/jyz"]);
});

test("stage-sidecar script exists and names the binaries dir", () => {
	const script = readFileSync(
		path.join(root, "packages", "desktop", "scripts", "stage-sidecar.ts"),
		"utf8",
	);
	expect(script).toContain("binaries");
});

test(".gitignore ignores the sidecar binaries dir", () => {
	const gitignore = readFileSync(path.join(root, ".gitignore"), "utf8");
	expect(gitignore).toContain("packages/desktop/src-tauri/binaries/");
});

import { afterEach, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createProject } from "../src/create/index.ts";

const roots: string[] = [];

async function tempRoot(): Promise<string> {
	const dir = await mkdtemp(join(tmpdir(), "jyz-vt-"));
	roots.push(dir);
	return dir;
}

afterEach(async () => {
	await Promise.all(roots.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

test("vite-tauri + updater renders expected wiring", async () => {
	const cwd = await tempRoot();
	await createProject(
		{ name: "demo", template: "vite-tauri", features: ["updater"], yes: true },
		cwd,
	);
	const dir = join(cwd, "demo");

	const cargo = await readFile(join(dir, "src-tauri/Cargo.toml"), "utf8");
	expect(cargo).toContain("tauri-plugin-updater");

	expect(existsSync(join(dir, "src-tauri/src/updater.rs"))).toBe(true);
	const updater = await readFile(join(dir, "src-tauri/src/updater.rs"), "utf8");
	expect(updater).toContain("check_for_update");
	expect(updater).toContain("install_update");

	const lib = await readFile(join(dir, "src-tauri/src/lib.rs"), "utf8");
	expect(lib).toContain("tauri_plugin_updater");
	expect(lib).toContain("mod updater;");
	expect(lib).toContain("updater::check_for_update");
	expect(lib).toContain("updater::install_update");

	const conf = JSON.parse(await readFile(join(dir, "src-tauri/tauri.conf.json"), "utf8")) as {
		bundle?: { createUpdaterArtifacts?: boolean };
		plugins?: { updater?: unknown };
	};
	expect(conf.bundle?.createUpdaterArtifacts).toBe(true);
	expect(conf.plugins?.updater).toBeDefined();
});

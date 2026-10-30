import { readFileSync, writeFileSync } from "node:fs";

const files = [
	"package.json",
	"packages/core/package.json",
	"packages/cli/package.json",
	"packages/desktop/package.json",
	"packages/mcp/package.json",
	"packages/desktop/src-tauri/tauri.conf.json",
	"packages/desktop/src-tauri/Cargo.toml",
];

let newVersion = "";
for (const f of files) {
	const text = readFileSync(f, "utf8");
	const m = text.match(/0\.1\.0-alpha\.(\d+)/);
	if (!m) continue;
	const n = Number(m[1]) + 1;
	newVersion = `0.1.0-alpha.${n}`;
	break;
}
if (!newVersion) {
	console.error("no alpha version found");
	process.exit(1);
}

for (const f of files) {
	let text = readFileSync(f, "utf8");
	text = text.replace(/0\.1\.0-alpha\.\d+/g, newVersion);
	writeFileSync(f, text);
}

console.log(newVersion);

if (process.argv.includes("--tag")) {
	const proc = Bun.spawnSync(["git", "tag", `v${newVersion}`]);
	if (proc.exitCode !== 0) {
		console.error(proc.stderr.toString());
		process.exit(proc.exitCode ?? 1);
	}
}

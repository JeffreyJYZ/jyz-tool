// Stage the CLI as the Tauri sidecar: `binaries/jyz-<host triple>[.exe]`.
//
// Tauri's `externalBin` looks for exactly that name at build time and strips the triple when it
// bundles, so the installed app gets a `jyz` beside its own executable. The directory is
// gitignored: an 89 MB binary belongs in an installer, not in a commit.
import { mkdirSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dir, "..", "..", "..");
const rustc = Bun.spawnSync(["rustc", "-vV"]);
if (rustc.exitCode !== 0) {
	console.error(`rustc -vV failed: ${rustc.stderr.toString().trim()}`);
	process.exit(1);
}
const hostLine = rustc.stdout
	.toString()
	.split("\n")
	.find((line) => line.startsWith("host:"));
const triple = hostLine?.trim().split(/\s+/)[1];
if (triple === undefined) throw new Error("rustc -vV did not report a host triple");

const isWindows = process.platform === "win32";
const outDir = path.join(root, "packages", "desktop", "src-tauri", "binaries");
const outPath = path.join(outDir, `jyz-${triple}${isWindows ? ".exe" : ""}`);
mkdirSync(outDir, { recursive: true });
const built = Bun.spawnSync([
	"bun",
	"build",
	"--compile",
	path.join(root, "packages", "cli", "src", "bin.ts"),
	"--outfile",
	outPath,
]);
if (built.exitCode !== 0) {
	console.error(built.stderr.toString().trim());
	process.exit(built.exitCode ?? 1);
}
console.log(`staged ${path.relative(root, outPath)}`);

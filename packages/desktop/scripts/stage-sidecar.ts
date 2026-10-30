import path from "node:path";

const root = path.resolve(import.meta.dir, "..", "..", "..");
const rustc = Bun.spawnSync(["rustc", "-vV"]);
const hostLine = rustc.stdout
	.toString()
	.split("\n")
	.find((line) => line.startsWith("host:"));
if (hostLine === undefined) {
	throw new Error("rustc -vV did not report a host triple");
}
const triple = hostLine.trim().split(/\s+/)[1];
const isWindows = process.platform === "win32";
const outName = `jyz-${triple}${isWindows ? ".exe" : ""}`;
const outDir = path.join(root, "packages", "desktop", "src-tauri", "binaries");
const outPath = path.join(outDir, outName);
await Bun.$`mkdir -p ${outDir}`;
await Bun.$`bun build --compile ${path.join(root, "packages", "cli", "src", "bin.ts")} --outfile ${outPath}`;
console.log(`staged ${path.relative(root, outPath)}`);

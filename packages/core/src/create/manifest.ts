import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { PACKAGE_MANAGER_VERSIONS } from "./defaults.ts";
import type { ResolvedOptions } from "./options.ts";

interface Manifest {
	name?: string;
	version?: string;
	private?: boolean;
	scripts?: Record<string, string>;
	devDependencies?: Record<string, string>;
	files?: string[];
	bin?: Record<string, string>;
	engines?: Record<string, string>;
	publishConfig?: { access: string };
	packageManager?: string;
}

export async function finalizeManifest(
	target: string,
	opts: ResolvedOptions,
	scripts: Record<string, string>,
	devDependencies: Record<string, string>,
): Promise<void> {
	const path = join(target, "package.json");
	const manifest = JSON.parse(await readFile(path, "utf8")) as Manifest;

	manifest.scripts = { ...manifest.scripts, ...scripts };
	if (Object.keys(devDependencies).length > 0) {
		manifest.devDependencies = { ...manifest.devDependencies, ...devDependencies };
	}

	if (opts.publishable) {
		delete manifest.private;
		manifest.files = ["dist"];
		manifest.publishConfig = { access: "public" };
		manifest.engines =
			opts.packageManager === "bun" ? { bun: ">=1.4.0" } : { node: ">=22.0.0" };
		const pinned = PACKAGE_MANAGER_VERSIONS[opts.packageManager];
		if (pinned) manifest.packageManager = `${opts.packageManager}@${pinned}`;
		if (opts.template === "cli") {
			manifest.bin = { [opts.name]: "./dist/bin.js" };
			manifest.scripts = {
				...manifest.scripts,
				build: "bun build src/bin.ts --outdir dist --target bun",
			};
		}
	}

	await writeFile(path, `${JSON.stringify(manifest, null, "\t")}\n`, "utf8");
}

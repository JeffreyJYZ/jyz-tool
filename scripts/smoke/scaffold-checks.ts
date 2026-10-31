export interface CheckResult {
	ok: boolean;
	detail: string;
}

export function checkUpdaterRs(text: string): CheckResult {
	const hasExt = text.includes("UpdaterExt");
	const hasDownload = text.includes("download_and_install");
	if (hasExt && hasDownload) {
		return { ok: true, detail: "UpdaterExt + download_and_install present" };
	}
	const missing: string[] = [];
	if (!hasExt) missing.push("UpdaterExt");
	if (!hasDownload) missing.push("download_and_install");
	return { ok: false, detail: `missing: ${missing.join(", ")}` };
}

export function checkConfig(conf: unknown): CheckResult {
	if (typeof conf !== "object" || conf === null) {
		return { ok: false, detail: "config is not an object" };
	}
	const c = conf as Record<string, unknown>;
	const bundle = c.bundle as Record<string, unknown> | undefined;
	if (bundle?.createUpdaterArtifacts !== true) {
		return { ok: false, detail: "bundle.createUpdaterArtifacts !== true" };
	}
	const plugins = c.plugins as Record<string, unknown> | undefined;
	const updater = plugins?.updater as Record<string, unknown> | undefined;
	if (!updater) {
		return { ok: false, detail: "plugins.updater missing" };
	}
	if (typeof updater.pubkey !== "string" || updater.pubkey === "") {
		return { ok: false, detail: "plugins.updater.pubkey missing/empty" };
	}
	if (!Array.isArray(updater.endpoints) || updater.endpoints.length === 0) {
		return { ok: false, detail: "plugins.updater.endpoints empty" };
	}
	return { ok: true, detail: "createUpdaterArtifacts + plugins.updater ok" };
}

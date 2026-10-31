import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..", "..");

export function expectedTag(version: string): string {
	return `v${version}`;
}

export function requiredAssets(dmgName: string): { name: string }[] {
	return [
		{ name: "jyz.app.tar.gz" },
		{ name: "jyz.app.tar.gz.sig" },
		{ name: dmgName },
		{ name: "latest.json" },
	];
}

export function uptodateDmgName(names: string[], version: string): string | null {
	return (
		names.find((name) => name.startsWith(`desktop-${version}-`) && name.endsWith(".dmg")) ??
		null
	);
}

export function releaseAssets(distDir = join(ROOT, "dist", "release")): string[] {
	if (!existsSync(distDir)) return [];
	return readdirSync(distDir)
		.filter((name) => name !== "notes.md")
		.sort()
		.map((name) => `${join(distDir, name)}#${name}`);
}

export function signatureVersion(signature: string): string | null {
	const trimmed = signature.trim();
	if (trimmed === "") {
		return null;
	}
	let decoded = "";
	try {
		decoded = Buffer.from(trimmed, "base64").toString("utf8");
	} catch {
		return null;
	}
	const match = /version:(\S+)/.exec(decoded);
	return match?.[1] ?? null;
}

export function assetPlan(_version: string, dmgName: string): { file: string; name: string }[] {
	const tarball = "jyz.app.tar.gz";
	const sig = `${tarball}.sig`;
	return [
		{ file: tarball, name: tarball },
		{ file: sig, name: sig },
		{ file: dmgName, name: dmgName },
		{ file: "latest.json", name: "latest.json" },
	];
}

export function refusals(input: {
	signature: string;
	version: string;
	archiveMtime: number;
	appMtime: number;
	dmgName: string | null;
}): string[] {
	const out: string[] = [];
	const sig = input.signature.trim();
	const sigFile = "jyz.app.tar.gz.sig";
	const archiveFile = "jyz.app.tar.gz";
	if (sig === "") {
		out.push(`${sigFile}: updater signature is empty`);
	} else {
		const signed = signatureVersion(sig);
		if (signed !== input.version) {
			out.push(
				`${sigFile}: signed for ${signed ?? "an unknown version"}, expected ${input.version}`,
			);
		}
	}
	if (input.archiveMtime < input.appMtime) {
		out.push(`${archiveFile}: archive is older than the app binary`);
	}
	if (input.dmgName === null) {
		out.push("dmg: missing");
	}
	return out;
}

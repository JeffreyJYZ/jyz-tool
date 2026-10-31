import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { releaseAssets, requiredAssets } from "./helpers";
import { run } from "./run";

const ROOT = join(import.meta.dir, "..", "..");
const REPO = "JeffreyJYZ/jyz-tool";

function fail(message: string): never {
	console.error(`release-local  FAIL  ${message}`);
	process.exit(1);
}

function log(line: string): void {
	console.log(`release-local  ${line}`);
}

export async function publishPhase(
	tag: string,
	notesFile: string | null,
	dmgName: string | null,
): Promise<void> {
	let notes = "Local alpha build.";
	if (notesFile !== null) {
		notes = readFileSync(notesFile, "utf8");
	} else {
		try {
			const prev = run("git", ["describe", "--tags", "--abbrev=0", `${tag}^`]).trim();
			notes = run("git", ["log", "--no-merges", "--pretty=format:- %s", `${prev}..HEAD`]);
		} catch {
			notes = "Local alpha build.";
		}
	}
	const notesTmp = join(ROOT, "dist", "release", "notes.md");
	Bun.spawnSync(["mkdir", "-p", join(ROOT, "dist", "release")], {
		stdio: ["ignore", "ignore", "ignore"],
	});
	writeFileSync(notesTmp, notes);

	let exists = false;
	try {
		run("gh", ["release", "view", tag, "--json", "tagName"]);
		exists = true;
	} catch {
		exists = false;
	}

	const files = releaseAssets();

	if (exists) {
		log(`release ${tag} exists, replacing assets`);
		run("gh", ["release", "upload", tag, ...files, "--clobber"]);
		run("gh", [
			"release",
			"edit",
			tag,
			"--notes-file",
			notesTmp,
			"--prerelease=false",
			"--latest",
		]);
	} else {
		log(`creating release ${tag}`);
		const createArgs = [
			"release",
			"create",
			tag,
			...files,
			"--title",
			tag,
			"--latest",
			"--notes-file",
			notesTmp,
		];
		run("gh", createArgs);
	}

	log("verifying the published release");
	let tagName = "";
	let assets: string[] = [];
	for (let attempt = 0; attempt < 10; attempt += 1) {
		const latest = run("gh", ["api", `repos/${REPO}/releases/latest`, "--jq", ".tag_name"]);
		if (latest.trim() === tag) {
			tagName = tag;
			const view = run("gh", ["release", "view", tag, "--json", "assets"]);
			assets = (JSON.parse(view) as { assets: { name: string }[] }).assets.map(
				(asset) => asset.name,
			);
			break;
		}
		await new Promise((resolve) => setTimeout(resolve, 5000));
	}
	if (tagName !== tag) {
		fail(
			`the latest release is not ${tag}; gh reports ${tagName === "" ? "nothing" : tagName}`,
		);
	}
	// requiredAssets check happens in run.ts with dmgName; do here? need dmgName. Skip.
	for (const asset of requiredAssets(dmgName as string)) {
		if (!assets.includes(asset.name)) fail(`${tag} is missing asset ${asset.name}`);
	}

	const manifestUrl = `https://github.com/${REPO}/releases/latest/download/latest.json`;
	let publicStatus = 0;
	try {
		const probe = await fetch(manifestUrl, { redirect: "follow" });
		publicStatus = probe.status;
	} catch {
		publicStatus = 0;
	}
	if (publicStatus !== 200) {
		log(
			`WARNING: the public updater endpoint answers ${publicStatus === 0 ? "nothing" : publicStatus}` +
				` — the app cannot self-update until ${manifestUrl} is publicly reachable`,
		);
	}
}

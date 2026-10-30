import { describe, expect, test } from "bun:test";

import {
	manifestProblems,
	mergeManifests,
	partialNames,
	stampVersion,
	type UpdaterManifest,
} from "../updater-manifest";

function manifest(overrides: Partial<UpdaterManifest> = {}): UpdaterManifest {
	return {
		version: "0.1.0",
		pub_date: "2026-10-31T00:00:00Z",
		platforms: {
			"darwin-aarch64": {
				signature: "sig-1",
				url: "https://example.test/jyz_0.1.0_aarch64.app.tar.gz",
			},
			"linux-x86_64": {
				signature: "sig-2",
				url: "https://example.test/jyz_0.1.0_amd64.AppImage.tar.gz",
			},
		},
		...overrides,
	};
}

describe("mergeManifests", () => {
	test("unions the platforms of every partial", () => {
		const mac = manifest({ platforms: { "darwin-aarch64": { signature: "s1", url: "u1" } } });
		const linux = manifest({ platforms: { "linux-x86_64": { signature: "s2", url: "u2" } } });
		const win = manifest({ platforms: { "windows-x86_64": { signature: "s3", url: "u3" } } });
		const merged = mergeManifests([mac, linux, win], "0.1.0-alpha.10");
		expect(Object.keys(merged.platforms).sort()).toEqual([
			"darwin-aarch64",
			"linux-x86_64",
			"windows-x86_64",
		]);
		expect(merged.version).toBe("0.1.0-alpha.10");
	});

	test("stamps the version from the release, not from the partial", () => {
		const merged = mergeManifests([manifest()], "0.1.0-alpha.11");
		expect(merged.version).toBe("0.1.0-alpha.11");
	});

	test("keeps artefact urls untouched", () => {
		const merged = mergeManifests([manifest()], "0.1.0-alpha.11");
		expect(merged.platforms["linux-x86_64"]?.url).toContain("jyz_0.1.0_amd64");
	});

	test("an empty input is an empty platform map, not a crash", () => {
		expect(mergeManifests([], "0.1.0-alpha.11").platforms).toEqual({});
	});
});

describe("stampVersion", () => {
	test("replaces the version and keeps every platform entry", () => {
		const stamped = stampVersion(manifest(), "0.1.0-alpha.10");
		expect(stamped.version).toBe("0.1.0-alpha.10");
		expect(stamped.platforms["darwin-aarch64"]?.signature).toBe("sig-1");
	});

	test("does not mutate the manifest it was handed", () => {
		const input = manifest();
		stampVersion(input, "0.1.0-alpha.10");
		expect(input.version).toBe("0.1.0");
	});
});

describe("manifestProblems", () => {
	test("a complete manifest has no problems", () => {
		expect(manifestProblems(mergeManifests([manifest()], "0.1.0-alpha.10"))).toEqual([]);
	});

	test("an empty platform map is reported", () => {
		expect(manifestProblems(manifest({ platforms: {} }))).toContain(
			"latest.json lists no platforms",
		);
	});

	test("a blank signature and a blank url are both named", () => {
		const broken = manifest({
			platforms: { "darwin-aarch64": { signature: " ", url: "" } },
		});
		const problems = manifestProblems(broken);
		expect(problems).toContain("darwin-aarch64: empty signature");
		expect(problems).toContain("darwin-aarch64: empty url");
	});

	test("a blank version is reported", () => {
		expect(manifestProblems(manifest({ version: "  " }))).toContain(
			"latest.json has no version",
		);
	});
});

describe("partialNames", () => {
	test("picks the per-platform partials and ignores the final manifest", () => {
		const names = ["latest-darwin-arm64.json", "latest.json", "jyz_0.1.0_aarch64.dmg"];
		expect(partialNames(names)).toEqual(["latest-darwin-arm64.json"]);
	});

	test("sorts so a merged report is stable", () => {
		expect(partialNames(["latest-windows-x64.json", "latest-darwin-arm64.json"])).toEqual([
			"latest-darwin-arm64.json",
			"latest-windows-x64.json",
		]);
	});

	test("no partials means no work", () => {
		expect(partialNames(["latest.json", "cli-0.1.0-darwin-arm64"])).toEqual([]);
	});
});

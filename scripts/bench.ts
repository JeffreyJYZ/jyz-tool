#!/usr/bin/env bun
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface Summary {
	min: number;
	p50: number;
	p95: number;
	max: number;
}

export interface BenchCase {
	name: string;
	samples: number[];
}

export interface BenchReport {
	cases: { name: string; min: number; p50: number; p95: number; max: number }[];
}

export function percentile(samples: number[], p: number): number {
	if (samples.length === 0) return 0;
	const sorted = [...samples].sort((a, b) => a - b);
	const rank = Math.ceil((p / 100) * sorted.length);
	const idx = Math.min(sorted.length - 1, Math.max(0, rank - 1));
	return sorted[idx]!;
}

export function summarize(samples: number[]): Summary {
	if (samples.length === 0) return { min: 0, p50: 0, p95: 0, max: 0 };
	const sorted = [...samples].sort((a, b) => a - b);
	return {
		min: sorted[0]!,
		p50: percentile(samples, 50),
		p95: percentile(samples, 95),
		max: sorted[sorted.length - 1]!,
	};
}

export function buildReport(cases: BenchCase[]): BenchReport {
	return {
		cases: cases.map((c) => {
			const s = summarize(c.samples);
			return { name: c.name, min: s.min, p50: s.p50, p95: s.p95, max: s.max };
		}),
	};
}

const SPAWN_TIMEOUT_MS = 10000;

async function spawnTimed(argv: string[], cwd: string): Promise<number> {
	const start = performance.now();
	const proc = Bun.spawn(argv, { cwd, stdout: "ignore", stderr: "ignore" });
	const timer = setTimeout(() => proc.kill(), SPAWN_TIMEOUT_MS);
	await proc.exited;
	clearTimeout(timer);
	return performance.now() - start;
}

async function main() {
	const args = Bun.argv.slice(2);
	const json = args.includes("--json");
	let runs = 10;
	const idx = args.indexOf("--runs");
	if (idx >= 0 && args[idx + 1]) runs = Number(args[idx + 1]);

	const dir = mkdtempSync(join(tmpdir(), "jyz-bench-"));
	writeFileSync(
		join(dir, "package.json"),
		JSON.stringify({ name: "bench", scripts: { noop: "true" } }),
	);
	try {
		const cases: BenchCase[] = [
			{ name: "jyz --version", samples: [] },
			{ name: "jyz config path", samples: [] },
			{ name: "jyz run noop", samples: [] },
		];
		for (const c of cases) {
			for (let i = 0; i < runs; i++) {
				let ms = 0;
				if (c.name === "jyz --version") ms = await spawnTimed(["jyz", "--version"], dir);
				else if (c.name === "jyz config path")
					ms = await spawnTimed(["jyz", "config", "path"], dir);
				else ms = await spawnTimed(["jyz", "run", "noop"], dir);
				c.samples.push(ms);
			}
		}
		const report = buildReport(cases);
		if (json) {
			console.log(JSON.stringify(report));
		} else {
			console.log("case            min    p50    p95    max");
			for (const c of report.cases) {
				console.log(
					`${c.name.padEnd(16)} ${c.min.toFixed(1).padStart(6)} ${c.p50.toFixed(1).padStart(6)} ${c.p95.toFixed(1).padStart(6)} ${c.max.toFixed(1).padStart(6)}`,
				);
			}
		}
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
}

if (import.meta.main) {
	await main();
}

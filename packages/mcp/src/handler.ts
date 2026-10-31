import { writeFileSync } from "node:fs";
import type { ArgvRequest, CommandSpec, ProjectContext } from "@jyz/core";
import {
	buildArgv,
	buildCheckCommand,
	buildFmtCommand,
	buildLintCommand,
	buildTypecheckCommand,
	createProject,
	findConfigPath,
	readConfigFile,
	resolveExecutable,
	resolveProject,
	runCommand,
	writeConfigValue,
} from "@jyz/core";
import { listTools } from "./tools.ts";

export interface ToolResult {
	exitCode: number;
	argv: string[];
	packageDir: string;
	stdout: string;
	stderr: string;
}

export class UnknownToolError extends Error {
	readonly validNames: string[];
	constructor(name: string, validNames: string[]) {
		super(`unknown tool "${name}"; valid tools: ${validNames.join(", ")}`);
		this.name = "UnknownToolError";
		this.validNames = validNames;
	}
}

export type ProgressKind = "start" | "stdout" | "stderr" | "exit" | "cancelled" | "error";

/** One streaming update, correlated with the handle the start call returned. */
export interface ProgressFrame {
	handle: string;
	type: ProgressKind;
	data: string;
	exitCode?: number;
}

/** What a streaming call returns at once: no exit code yet, just the handle to watch or cancel. */
export interface StreamStart {
	handle: string;
	streaming: true;
	argv: string[];
	packageDir: string;
}

/** What `jyz_cancel` reports: whether the child was stopped before the call returned. */
export interface CancelResult {
	handle: string;
	cancelled: boolean;
	stopped: boolean;
	argv: string[];
}

/** Everything a call may need beyond the tool name and its input. */
export interface CallOptions {
	/** Directory the call resolves against; defaults to the process cwd. */
	cwd?: string;
	/** Receives every streaming frame for this call. */
	onProgress?: (frame: ProgressFrame) => void;
	/** Aborting it cancels the child a streaming call started. */
	signal?: AbortSignal;
}

/** The third argument may stay a plain cwd, so existing callers keep working unchanged. */
export type CallTarget = string | CallOptions;

export type ToolResponse = ToolResult | StreamStart | CancelResult;

/** A call whose input cannot start unknownthing: a missing script name, a handle already in use. */
export class ToolInputError extends Error {
	readonly tool: string;
	constructor(tool: string, message: string) {
		super(`${tool}: ${message}`);
		this.name = "ToolInputError";
		this.tool = tool;
	}
}

/** `jyz_cancel` was given a handle no live stream owns. */
export class UnknownHandleError extends Error {
	readonly handle: string;
	constructor(handle: string) {
		super(`unknown streaming handle "${handle}"`);
		this.name = "UnknownHandleError";
		this.handle = handle;
	}
}

interface ActiveStream {
	handle: string;
	proc: ReturnType<typeof spawnPiped>;
	argv: string[];
	emit: (frame: Omit<ProgressFrame, "handle">) => void;
	detach: () => void;
}

const streams = new Map<string, ActiveStream>();
let handleSeq = 0;

function nextHandle(): string {
	handleSeq += 1;
	return `watch-${handleSeq}-${Math.random().toString(36).slice(2, 8)}`;
}

function messageOf(err: unknown): string {
	return err instanceof Error ? err.message : String(err);
}

function normalizeTarget(target?: CallTarget): CallOptions {
	if (target === undefined) return { cwd: process.cwd() };
	if (typeof target === "string") return { cwd: target };
	if (target.cwd === undefined) return { ...target, cwd: process.cwd() };
	return target;
}

/**
 * The child of a streaming call leads its own process group, so cancelling it stops the package
 * manager and everything that manager spawned rather than leaving an orphaned script behind.
 */
function spawnPiped(spec: CommandSpec) {
	return Bun.spawn({
		cmd: [spec.file, ...spec.argv],
		cwd: spec.cwd,
		env: process.env,
		stdin: "ignore",
		stdout: "pipe",
		stderr: "pipe",
		detached: true,
	});
}

async function pump(
	stream: ReadableStream<Uint8Array>,
	emit: (data: string) => void,
): Promise<void> {
	const reader = stream.getReader();
	const decoder = new TextDecoder();
	try {
		for (;;) {
			const { value, done } = await reader.read();
			if (done) break;
			if (value === undefined) continue;
			const text = decoder.decode(value, { stream: true });
			if (text !== "") emit(text);
		}
		const tail = decoder.decode();
		if (tail !== "") emit(tail);
	} finally {
		reader.releaseLock();
	}
}

function startWatch(input: Record<string, unknown>, options: CallOptions): StreamStart {
	const script = typeof input.script === "string" ? input.script : "";
	if (script === "") throw new ToolInputError("jyz_watch", "a script name is required");
	const cwd = options.cwd ?? process.cwd();
	const ctx = resolveCtx(cwd, typeof input.filter === "string" ? input.filter : undefined);
	const spec = dispatchSpec(ctx, "run", { args: [script, ...strArray(input.args)] });
	const requested = typeof input.handle === "string" ? input.handle : "";
	const handle = requested !== "" ? requested : nextHandle();
	if (streams.has(handle)) {
		throw new ToolInputError("jyz_watch", `handle "${handle}" is already streaming`);
	}

	const proc = spawnPiped(spec);
	const emit = (frame: Omit<ProgressFrame, "handle">): void => {
		try {
			options.onProgress?.({ handle, ...frame });
		} catch {
			// A host callback must never break the pump that feeds it.
		}
	};

	const entry: ActiveStream = { handle, proc, argv: spec.argv, emit, detach: () => {} };
	streams.set(handle, entry);

	const signal = options.signal;
	if (signal !== undefined) {
		const onAbort = (): void => {
			void stopStream(entry);
		};
		if (signal.aborted) onAbort();
		else signal.addEventListener("abort", onAbort, { once: true });
		entry.detach = () => signal.removeEventListener("abort", onAbort);
	}

	emit({ type: "start", data: spec.argv.join(" ") });
	void finishWhenExited(entry);
	return { handle, streaming: true, argv: spec.argv, packageDir: ctx.packageDir };
}

async function finishWhenExited(entry: ActiveStream): Promise<void> {
	const proc = entry.proc;
	try {
		await Promise.all([
			pump(proc.stdout as ReadableStream<Uint8Array>, (data) =>
				entry.emit({ type: "stdout", data }),
			),
			pump(proc.stderr as ReadableStream<Uint8Array>, (data) =>
				entry.emit({ type: "stderr", data }),
			),
			proc.exited,
		]);
	} catch (err) {
		if (proc.exitCode === null && proc.signalCode === null) {
			entry.emit({ type: "error", data: messageOf(err) });
		}
	}
	const exitCode = proc.exitCode ?? (proc.signalCode === null ? 1 : 0);
	entry.emit({ type: "exit", data: String(exitCode), exitCode });
	entry.detach();
	streams.delete(entry.handle);
}

/** SIGTERM, then SIGKILL after a bounded grace period. Resolves once the child has exited. */
async function stopStream(entry: ActiveStream): Promise<boolean> {
	entry.emit({ type: "cancelled", data: `cancel requested for ${entry.handle}` });
	const proc = entry.proc;
	if (proc.exitCode !== null || proc.signalCode !== null) return true;
	signalTree(proc, "SIGTERM");
	if (await settledWithin(proc.exited, 1500)) return true;
	signalTree(proc, "SIGKILL");
	return settledWithin(proc.exited, 1500);
}

function signalTree(proc: ReturnType<typeof spawnPiped>, signal: NodeJS.Signals): void {
	try {
		if (process.platform === "win32") proc.kill(signal);
		else process.kill(-proc.pid, signal);
	} catch {
		try {
			proc.kill(signal);
		} catch {
			// Already gone.
		}
	}
}

async function settledWithin(promise: Promise<unknown>, ms: number): Promise<boolean> {
	let timer: ReturnType<typeof setTimeout> | undefined;
	const timeout = new Promise<boolean>((resolve) => {
		timer = setTimeout(() => resolve(false), ms);
	});
	try {
		return await Promise.race([promise.then(() => true), timeout]);
	} finally {
		if (timer !== undefined) clearTimeout(timer);
	}
}

/** Stop every live stream. Exported so a host, or a test, can drop all children at shutdown. */
export async function cancelAllStreams(): Promise<void> {
	await Promise.all([...streams.values()].map((entry) => stopStream(entry)));
}

const VALID_NAMES = listTools().map((t) => t.name);

function asRecord(input: unknown): Record<string, unknown> {
	if (input !== null && typeof input === "object" && !Array.isArray(input)) {
		return input as Record<string, unknown>;
	}
	return {};
}

function strArray(v: unknown): string[] {
	return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

function resolveCtx(cwd: string, filter?: string): ProjectContext {
	return filter === undefined ? resolveProject(cwd) : resolveProject(cwd, { filter });
}

async function runSpec(
	spec: CommandSpec,
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
	const r = await runCommand(spec, { stdio: "pipe" });
	return { exitCode: r.exitCode, stdout: r.stdout, stderr: r.stderr };
}

async function runSpecs(
	specs: CommandSpec[],
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
	let exitCode = 0;
	let stdout = "";
	let stderr = "";
	for (const spec of specs) {
		const r = await runSpec(spec);
		exitCode = r.exitCode;
		stdout += r.stdout;
		stderr += r.stderr;
		if (exitCode !== 0) break;
	}
	return { exitCode, stdout, stderr };
}

function dispatchSpec(
	ctx: ProjectContext,
	verb: string,
	input: Record<string, unknown>,
): CommandSpec {
	const pm = ctx.config.project.package_manager.value;
	const cwd = ctx.packageDir;
	const req: ArgvRequest = {
		verb: verb as ArgvRequest["verb"],
		args: strArray(input.args),
		dev: input.dev === true,
		latest: input.latest === true,
	};
	if (verb === "exec") {
		const args = strArray(input.args);
		const bin = args[0];
		if (bin !== undefined) {
			const resolved = resolveExecutable(pm, cwd, bin);
			if (resolved !== "bunx" && resolved !== "pnpm") {
				return { file: resolved, argv: args.slice(1), cwd };
			}
		}
		const argv = buildArgv(pm, { verb: "exec", args });
		if (pm === "bun") return { file: argv[0] ?? "bunx", argv: argv.slice(1), cwd };
		return { file: "pnpm", argv, cwd };
	}
	const argv = buildArgv(pm, req);
	return { file: pm, argv, cwd };
}

export function callTool(
	name: "jyz_watch",
	input: unknown,
	target?: CallTarget,
): Promise<StreamStart>;
export function callTool(
	name: "jyz_cancel",
	input: unknown,
	target?: CallTarget,
): Promise<CancelResult>;
export function callTool(name: string, input: unknown, target?: CallTarget): Promise<ToolResponse>;
export async function callTool(
	name: string,
	input: unknown,
	target?: CallTarget,
): Promise<ToolResponse> {
	const options = normalizeTarget(target);
	const cwd = options.cwd ?? process.cwd();
	if (!VALID_NAMES.includes(name)) {
		throw new UnknownToolError(name, VALID_NAMES);
	}
	const i = asRecord(input);

	switch (name) {
		case "jyz_watch":
			return startWatch(i, options);
		case "jyz_cancel": {
			const handle = typeof i.handle === "string" ? i.handle : "";
			if (handle === "") throw new ToolInputError("jyz_cancel", "a handle is required");
			const entry = streams.get(handle);
			if (entry === undefined) throw new UnknownHandleError(handle);
			const stopped = await stopStream(entry);
			return { handle, cancelled: true, stopped, argv: entry.argv };
		}
		case "jyz_install":
		case "jyz_add":
		case "jyz_remove":
		case "jyz_run":
		case "jyz_update":
		case "jyz_outdated": {
			const verb = name.replace("jyz_", "");
			const v = verb === "remove" ? "remove" : verb;
			const ctx = resolveCtx(cwd, typeof i.filter === "string" ? i.filter : undefined);
			const spec = dispatchSpec(ctx, v, i);
			const r = await runSpec(spec);
			return {
				exitCode: r.exitCode,
				argv: spec.argv,
				packageDir: ctx.packageDir,
				stdout: r.stdout,
				stderr: r.stderr,
			};
		}
		case "jyz_exec": {
			const ctx = resolveCtx(cwd, typeof i.filter === "string" ? i.filter : undefined);
			const spec = dispatchSpec(ctx, "exec", i);
			const r = await runSpec(spec);
			return {
				exitCode: r.exitCode,
				argv: spec.argv,
				packageDir: ctx.packageDir,
				stdout: r.stdout,
				stderr: r.stderr,
			};
		}
		case "jyz_create": {
			const opts = {
				name: String(i.name ?? ""),
				template: i.template as unknown,
				dir: typeof i.dir === "string" ? i.dir : undefined,
				packageManager: i.packageManager as unknown,
				typechecker: i.typechecker as unknown,
				linter: i.linter as unknown,
				formatter: i.formatter as unknown,
				docs: i.docs === true,
				git: i.git as unknown,
				install: i.install === true,
				publishable: i.publishable === true,
				yes: i.yes === true,
			};
			const result = await createProject(opts as Parameters<typeof createProject>[0], cwd);
			return {
				exitCode: 0,
				argv: [],
				packageDir: result.dir,
				stdout: result.files.join("\n"),
				stderr: result.warnings.join("\n"),
			};
		}
		case "jyz_config": {
			const action = typeof i.action === "string" ? i.action : "show";
			const key = typeof i.key === "string" ? i.key : undefined;
			const value = typeof i.value === "string" ? i.value : undefined;
			const strict = i.strict === true;
			const ctx = resolveCtx(cwd, typeof i.filter === "string" ? i.filter : undefined);
			const packageDir = ctx.packageDir;
			const config = ctx.config;
			switch (action) {
				case "show":
					return {
						exitCode: 0,
						argv: [],
						packageDir,
						stdout: JSON.stringify(config),
						stderr: "",
					};
				case "get": {
					if (key === undefined)
						return {
							exitCode: 1,
							argv: [],
							packageDir,
							stdout: "",
							stderr: "missing key",
						};
					const bare = key.startsWith("project.") ? key.slice("project.".length) : key;
					const projKeys = ["package_manager", "typechecker", "linter", "formatter"];
					let found: string | null = null;
					if (projKeys.includes(bare)) {
						found = config.project[bare as keyof typeof config.project].value;
					} else {
						const [section, ...tail] = key.split(".");
						const rest = tail.join(".");
						if (section === "aliases") found = config.aliases[rest] ?? null;
						else if (section === "scripts") found = config.scripts[rest] ?? null;
						else if (section === "create") {
							const ck = ["default_template", "default_package_manager", "git"];
							if (ck.includes(rest))
								found = String(config.create[rest as keyof typeof config.create]);
						} else if (section === "monorepo" && rest === "default_filter") {
							found = String(config.monorepo.default_filter);
						}
					}
					if (found === null)
						return {
							exitCode: 1,
							argv: [],
							packageDir,
							stdout: "",
							stderr: `unknown config key "${key}"`,
						};
					return { exitCode: 0, argv: [], packageDir, stdout: found, stderr: "" };
				}
				case "set": {
					if (key === undefined || value === undefined)
						return {
							exitCode: 1,
							argv: [],
							packageDir,
							stdout: "",
							stderr: "missing key or value",
						};
					const path = findConfigPath(cwd) ?? `${cwd}/jyz.config.toml`;
					const { text } = writeConfigValue(path, key, value);
					writeFileSync(path, text, "utf8");
					return {
						exitCode: 0,
						argv: [],
						packageDir,
						stdout: `${path}: set ${key} = ${value}`,
						stderr: "",
					};
				}
				case "check": {
					const path = findConfigPath(cwd);
					if (path === null)
						return {
							exitCode: 0,
							argv: [],
							packageDir,
							stdout: `no jyz.config.toml found from ${cwd}`,
							stderr: "",
						};
					const { warnings } = readConfigFile(path);
					if (warnings.length === 0)
						return {
							exitCode: 0,
							argv: [],
							packageDir,
							stdout: `${path}: ok`,
							stderr: "",
						};
					return {
						exitCode: strict ? 1 : 0,
						argv: [],
						packageDir,
						stdout: "",
						stderr: warnings.map((w) => `warning: ${w} (${path})`).join("\n"),
					};
				}
				default:
					return {
						exitCode: 1,
						argv: [],
						packageDir,
						stdout: "",
						stderr: `unknown config action "${action}"`,
					};
			}
		}
		case "jyz_typecheck": {
			const ctx = resolveCtx(cwd, typeof i.filter === "string" ? i.filter : undefined);
			const spec = buildTypecheckCommand(ctx, strArray(i.args));
			const r = await runSpec(spec);
			return {
				exitCode: r.exitCode,
				argv: spec.argv,
				packageDir: ctx.packageDir,
				stdout: r.stdout,
				stderr: r.stderr,
			};
		}
		case "jyz_lint": {
			const ctx = resolveCtx(cwd, typeof i.filter === "string" ? i.filter : undefined);
			const spec = buildLintCommand(ctx, strArray(i.args));
			const r = await runSpec(spec);
			return {
				exitCode: r.exitCode,
				argv: spec.argv,
				packageDir: ctx.packageDir,
				stdout: r.stdout,
				stderr: r.stderr,
			};
		}
		case "jyz_check": {
			const ctx = resolveCtx(cwd, typeof i.filter === "string" ? i.filter : undefined);
			const specs = buildCheckCommand(ctx, strArray(i.args));
			const r = await runSpecs(specs);
			return {
				exitCode: r.exitCode,
				argv: specs[0]?.argv ?? [],
				packageDir: ctx.packageDir,
				stdout: r.stdout,
				stderr: r.stderr,
			};
		}
		case "jyz_fmt": {
			const ctx = resolveCtx(cwd, typeof i.filter === "string" ? i.filter : undefined);
			const spec = buildFmtCommand(ctx, { check: i.check === true });
			const r = await runSpec(spec);
			return {
				exitCode: r.exitCode,
				argv: spec.argv,
				packageDir: ctx.packageDir,
				stdout: r.stdout,
				stderr: r.stderr,
			};
		}
		default: {
			throw new UnknownToolError(name, VALID_NAMES);
		}
	}
}

export interface ToolResult {
	exitCode: number;
	argv: string[];
	packageDir: string;
	stdout: string;
	stderr: string;
}

export type ProgressKind = "start" | "stdout" | "stderr" | "exit" | "cancelled" | "error";

export interface ProgressFrame {
	handle: string;
	type: ProgressKind;
	data: string;
	exitCode?: number;
}

export interface StreamStart {
	handle: string;
	streaming: true;
	argv: string[];
	packageDir: string;
}

export interface CancelResult {
	handle: string;
	cancelled: boolean;
	stopped: boolean;
	argv: string[];
}

export interface CallOptions {
	cwd?: string;
	onProgress?: (frame: ProgressFrame) => void;
	signal?: AbortSignal;
}

export type CallTarget = string | CallOptions;

export type ToolResponse = ToolResult | StreamStart | CancelResult;

export class ConfigError extends Error {
	readonly path: string;
	constructor(path: string, message: string) {
		super(message);
		this.name = "ConfigError";
		this.path = path;
	}
}

export class ConfigWriteError extends Error {
	readonly path: string;
	constructor(path: string, message: string) {
		super(message);
		this.name = "ConfigWriteError";
		this.path = path;
	}
}

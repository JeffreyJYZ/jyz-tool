/** Raised when a template cannot be rendered; the message names the offending flag or path. */
export class CreateError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "CreateError";
	}
}

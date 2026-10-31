/** One project error as a record, so a test can read its fields without a cast at every site. */
export function asError(value: unknown): Record<string, unknown> {
	return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

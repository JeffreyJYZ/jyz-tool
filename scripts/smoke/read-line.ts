type ByteReader = { read(): Promise<{ done: boolean; value?: Uint8Array }> };

export async function readLine(
	reader: ByteReader,
	decoder: TextDecoder,
	state: { buffer: string },
	deadline: number,
): Promise<string | null> {
	while (!state.buffer.includes("\n")) {
		if (Date.now() >= deadline) return null;
		const remaining = deadline - Date.now();
		let timer: ReturnType<typeof setTimeout> | undefined;
		const timeoutPromise = new Promise<{ value: undefined; done: true }>((resolve) => {
			timer = setTimeout(() => resolve({ value: undefined, done: true }), remaining);
		});
		const readPromise = reader.read().then((r) => {
			if (timer !== undefined) clearTimeout(timer);
			return r;
		});
		const result = await Promise.race([readPromise, timeoutPromise]);
		if (timer !== undefined) clearTimeout(timer);
		if (result.done) {
			if (state.buffer.trim() !== "") {
				const line = state.buffer;
				state.buffer = "";
				return line;
			}
			return null;
		}
		if (result.value !== undefined) {
			state.buffer += decoder.decode(result.value, { stream: true });
		}
	}
	const idx = state.buffer.indexOf("\n");
	const line = state.buffer.slice(0, idx);
	state.buffer = state.buffer.slice(idx + 1);
	return line;
}

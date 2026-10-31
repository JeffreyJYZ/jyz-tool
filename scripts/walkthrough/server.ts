/** Serve the built `dist/` on an ephemeral port. The content type matters: a module script served as
 * text/html is refused by the browser, which is exactly how a Vite build breaks a naive file server. */
export function serveUi(root: string): { url: string; stop(): void } {
	const types: Record<string, string> = {
		".html": "text/html; charset=utf-8",
		".js": "text/javascript; charset=utf-8",
		".css": "text/css; charset=utf-8",
		".json": "application/json; charset=utf-8",
		".svg": "image/svg+xml",
		".woff2": "font/woff2",
	};
	const server = Bun.serve({
		port: 0,
		async fetch(request) {
			const path = new URL(request.url).pathname;
			const name = path === "/" ? "/index.html" : path;
			const file = Bun.file(`${root}${name}`);
			if (!(await file.exists())) return new Response("not found", { status: 404 });
			// The type comes from the file actually served: taking it from the request path turns "/"
			// into octet-stream, and the browser then downloads the page instead of rendering it.
			const ext = name.slice(name.lastIndexOf("."));
			return new Response(file, {
				headers: { "content-type": types[ext] ?? "application/octet-stream" },
			});
		},
	});
	return { url: `http://127.0.0.1:${server.port}/`, stop: () => server.stop(true) };
}

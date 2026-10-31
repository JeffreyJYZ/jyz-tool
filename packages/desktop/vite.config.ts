import { defineConfig } from "vite";

// Vite + Tauri shape: Vite serves on 1420 during `tauri dev`, builds into ../dist,
// and Tauri (see src-tauri/tauri.conf.json) points frontendDist at that dist.
export default defineConfig({
	root: ".",
	base: "./",
	server: { port: 1420, strictPort: true },
	build: { outDir: "dist", emptyOutDir: true },
});

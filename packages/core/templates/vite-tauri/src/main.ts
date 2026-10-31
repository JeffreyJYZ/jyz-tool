import "./app.css";

const app = document.querySelector<HTMLDivElement>("#app");
if (app) {
	app.innerHTML = `<main><h1>__NAME__</h1><p>Vite + Tauri 2</p></main>`;
}

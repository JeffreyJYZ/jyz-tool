# Task 52b report

Generated updater.rs:

```rust
// jyz:updater
use tauri::Manager;
use tauri_plugin_updater::UpdaterExt;

#[derive(serde::Serialize)]
pub struct UpdateOffer {
	pub current: String,
	pub version: String,
	pub notes: Option<String>,
}

#[tauri::command]
pub async fn check_for_update(app: tauri::AppHandle) -> Result<Option<UpdateOffer>, String> {
	let update = app.updater()?.check().await.map_err(|e| e.to_string())?;
	Ok(update.map(|u| UpdateOffer {
		current: u.current_version,
		version: u.version,
		notes: u.body,
	}))
}

#[tauri::command]
pub async fn install_update(app: tauri::AppHandle) -> Result<(), String> {
	let update = app.updater()?.check().await.map_err(|e| e.to_string())?;
	if let Some(update) = update {
		update.download_and_install(|_, _| {}, || {}).await.map_err(|e| e.to_string())?;
	}
	app.restart();
	Ok(())
}
```

Gates green: bun test packages/core/test (160 pass), bun check (0 errors), bun run size (18 oversized), targeted biome clean. EOF

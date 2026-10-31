//! Updater commands.

use tauri::AppHandle;

#[derive(serde::Serialize)]
pub struct UpdateOffer {
	pub current: String,
	pub version: String,
	pub notes: Option<String>,
}

#[allow(dead_code)]
pub fn updater_pubkey_from_config(config: &serde_json::Value) -> Result<String, String> {
	config
		.get("plugins")
		.and_then(|plugins| plugins.get("updater"))
		.and_then(|updater| updater.get("pubkey"))
		.and_then(|value| value.as_str())
		.map(|value| value.to_string())
		.ok_or_else(|| "missing updater pubkey in config".to_string())
}

#[tauri::command]
pub async fn jyz_update_check(app: AppHandle) -> Result<Option<UpdateOffer>, String> {
	use tauri_plugin_updater::UpdaterExt;
	let updater = app.updater().map_err(|error| error.to_string())?;
	match updater.check().await.map_err(|error| error.to_string())? {
		Some(update) => Ok(Some(UpdateOffer {
			current: update.current_version.clone(),
			version: update.version.clone(),
			notes: update.body.clone(),
		})),
		None => Ok(None),
	}
}

#[tauri::command]
pub async fn jyz_update_install(app: AppHandle) -> Result<(), String> {
	use tauri_plugin_updater::UpdaterExt;
	let updater = app.updater().map_err(|error| error.to_string())?;
	let Some(update) = updater.check().await.map_err(|error| error.to_string())? else {
		return Ok(());
	};
	update
		.download_and_install(|_, _| {}, || {})
		.await
		.map_err(|error| error.to_string())?;
	app.restart()
}

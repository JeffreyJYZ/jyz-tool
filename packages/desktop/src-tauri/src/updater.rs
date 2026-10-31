//! Updater commands.

use std::sync::{
	atomic::{AtomicU64, Ordering},
	Arc,
};

use tauri::{AppHandle, Emitter};

#[derive(serde::Serialize)]
pub struct UpdateOffer {
	pub current: String,
	pub version: String,
	pub notes: Option<String>,
}

/// Bytes pulled so far, emitted while the installer downloads. `total` is what the server declared
/// and is `None` when the response carried no length — the page then shows bytes, not a percentage.
#[derive(Clone, serde::Serialize)]
pub struct DownloadProgress {
	pub downloaded: u64,
	pub total: Option<u64>,
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
	// A ~47 MB download with no feedback reads as a hang, so every chunk is announced and the page
	// renders a percentage.
	let seen = Arc::new(AtomicU64::new(0));
	let emitter = app.clone();
	let counter = Arc::clone(&seen);
	update
		.download_and_install(
			move |chunk, total| {
				let downloaded = counter.fetch_add(chunk as u64, Ordering::Relaxed) + chunk as u64;
				let _ = emitter.emit(
					"jyz:update-progress",
					DownloadProgress { downloaded, total },
				);
			},
			|| {},
		)
		.await
		.map_err(|error| error.to_string())?;
	app.restart()
}

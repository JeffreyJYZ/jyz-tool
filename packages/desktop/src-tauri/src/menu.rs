//! Application menu: update actions reachable from the accessible native menu bar.
//!
//! The WKWebView window exposes no accessibility element, so a native menu is the one surface a
//! screen reader and an automation tree can both reach. The Edit submenu is not decoration:
//! replacing the default menu drops the standard clipboard items, and without them Cmd+C/Cmd+V
//! stop working inside the webview.

use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{AppHandle, Emitter};

pub const CHECK_ID: &str = "jyz_check_updates";
pub const INSTALL_ID: &str = "jyz_install_update";

pub fn build_menu<R: tauri::Runtime>(app: &AppHandle<R>) -> tauri::Result<Menu<R>> {
	let menu = Menu::new(app)?;

	let app_menu = Submenu::new(app, "jyz", true)?;
	app_menu.append(&MenuItem::with_id(
		app,
		CHECK_ID,
		"Check for Updates…",
		true,
		Some("CmdOrCtrl+U"),
	)?)?;
	app_menu.append(&MenuItem::with_id(
		app,
		INSTALL_ID,
		"Install Update",
		true,
		Some("CmdOrCtrl+Shift+U"),
	)?)?;
	app_menu.append(&PredefinedMenuItem::separator(app)?)?;
	app_menu.append(&PredefinedMenuItem::close_window(app, None)?)?;
	app_menu.append(&PredefinedMenuItem::quit(app, None)?)?;
	menu.append(&app_menu)?;

	let edit = Submenu::new(app, "Edit", true)?;
	edit.append(&PredefinedMenuItem::undo(app, None)?)?;
	edit.append(&PredefinedMenuItem::redo(app, None)?)?;
	edit.append(&PredefinedMenuItem::separator(app)?)?;
	edit.append(&PredefinedMenuItem::cut(app, None)?)?;
	edit.append(&PredefinedMenuItem::copy(app, None)?)?;
	edit.append(&PredefinedMenuItem::paste(app, None)?)?;
	edit.append(&PredefinedMenuItem::select_all(app, None)?)?;
	menu.append(&edit)?;

	Ok(menu)
}

pub fn handle_menu_event(app: &AppHandle, event_id: &str) {
	match event_id {
		CHECK_ID => {
			let handle = app.clone();
			tauri::async_runtime::spawn(async move {
				let result = crate::jyz_update_check(handle.clone()).await;
				let _ = handle.emit("jyz:update-check-result", &result);
			});
		}
		INSTALL_ID => {
			let handle = app.clone();
			tauri::async_runtime::spawn(async move {
				let _ = crate::jyz_update_install(handle).await;
			});
		}
		_ => {}
	}
}

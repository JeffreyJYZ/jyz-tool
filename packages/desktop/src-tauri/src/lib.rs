//! The jyz desktop shell: one window onto the CLI's JSON-RPC stdio surface.
//!
//! The window owns no resolution logic. A call spawns the installed `jyz`, writes exactly one
//! newline-terminated JSON-RPC request frame, reads one response line, and kills the child. The
//! raw line goes back to the page, which parses it with the helpers in `src/bridge.ts`, so result
//! extraction and error mapping live where a unit test reaches them. A transport fault — no `jyz`
//! on PATH, no answer, a timeout — comes back as an error string instead of a frame.

mod capabilities;
#[cfg(unix)]
mod linux_process;
mod menu;
mod opencode;
mod program;
mod rpc;
mod updater;

pub use capabilities::*;
pub use opencode::*;
pub use program::*;
pub use rpc::*;
pub use updater::*;

// (no extra imports)

#[tauri::command]
fn jyz_call(method: String, params: String) -> Result<String, String> {
	let name = method.trim();
	if name.is_empty() {
		return Err("jyz_call needs a method".to_string());
	}
	round_trip(&serve_argv(), &request_frame(name, &params))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
	tauri::Builder::default()
		.plugin(tauri_plugin_updater::Builder::new().build())
		.menu(|app| menu::build_menu(app))
		.on_menu_event(|app, event| menu::handle_menu_event(app, event.id().as_ref()))
		.invoke_handler(tauri::generate_handler![
			jyz_call,
			jyz_version,
			jyz_capabilities,
			jyz_oc,
			jyz_update_check,
			jyz_update_install
		])
		.run(tauri::generate_context!())
		.expect("error while running the jyz desktop shell");
}

#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn frame_is_one_line() {
		let frame = request_frame("config", "{\"action\":\"show\"}");
		assert_eq!(frame.lines().count(), 1);
		assert!(frame.ends_with("\n"));
		assert_eq!(
			frame,
			"{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"config\",\"params\":{\"action\":\"show\"}}\n"
		);
	}

	#[test]
	fn blank_params_become_null() {
		assert!(request_frame("lint", "  ").contains("\"params\":null"));
	}

	#[test]
	fn method_is_escaped() {
		assert!(request_frame("a\"b", "{}").contains("\"method\":\"a\\\"b\""));
	}

	#[test]
	fn control_characters_are_escaped() {
		assert!(json_string("\u{1}").contains("\\u0001"));
	}

	#[test]
	fn oc_allowlist_accepts_sessions_and_prompt() {
		assert!(oc_allowed("sessions"));
		assert!(oc_allowed("prompt"));
		assert!(!oc_allowed("foo"));
		assert!(!oc_allowed(""));
	}

	#[test]
	fn sibling_wins_over_path() {
		let base = std::env::temp_dir().join("jyz-sibling-test");
		let _ = std::fs::remove_dir_all(&base);
		std::fs::create_dir_all(&base).unwrap();
		std::fs::write(base.join(sidecar_name()), b"").unwrap();
		let resolved = resolve_program(Some(&base));
		assert_eq!(resolved, base.join(sidecar_name()).display().to_string());
		let _ = std::fs::remove_dir_all(&base);
	}

	#[test]
	fn offer_shape_serializes_three_fields() {
		let offer = UpdateOffer {
			current: "0.1.0".to_string(),
			version: "0.1.1".to_string(),
			notes: Some("notes".to_string()),
		};
		let value = serde_json::to_value(&offer).unwrap();
		assert_eq!(value.get("current").unwrap(), "0.1.0");
		assert_eq!(value.get("version").unwrap(), "0.1.1");
		assert_eq!(value.get("notes").unwrap(), "notes");
	}

	#[test]
	fn missing_config_key_is_an_error() {
		let config = serde_json::json!({});
		assert!(updater_pubkey_from_config(&config).is_err());
	}
}

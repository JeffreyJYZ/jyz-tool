//! Capability read: manifest and version.

use std::process::{Command, Stdio};

use crate::program::{program, PROGRAM};

#[tauri::command]
pub fn jyz_capabilities() -> Vec<serde_json::Value> {
	let output = Command::new(program())
		.arg("capabilities")
		.arg("--json")
		.stdin(Stdio::null())
		.output();
	let Ok(output) = output else {
		return Vec::new();
	};
	if !output.status.success() {
		return Vec::new();
	}
	let text = String::from_utf8_lossy(&output.stdout);
	serde_json::from_str::<Vec<serde_json::Value>>(text.trim()).unwrap_or_default()
}

#[tauri::command]
pub fn jyz_version() -> Result<String, String> {
	let output = Command::new(program())
		.arg("--version")
		.stdin(Stdio::null())
		.output()
		.map_err(|error| format!("could not run {PROGRAM} --version: {error}"))?;
	let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
	if output.status.success() {
		return Ok(stdout);
	}
	let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
	if stderr.is_empty() {
		Err(format!("{PROGRAM} --version exited with {}", output.status))
	} else {
		Err(stderr)
	}
}

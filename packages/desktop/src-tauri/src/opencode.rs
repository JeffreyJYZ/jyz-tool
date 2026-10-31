//! The `jyz oc` command wrapper.

use std::process::{Command, Stdio};

use crate::program::{program, PROGRAM};

pub fn oc_allowed(subcommand: &str) -> bool {
	matches!(subcommand, "sessions" | "prompt")
}

#[tauri::command]
pub fn jyz_oc(args: Vec<String>) -> Result<String, String> {
	let subcommand = args.first().map(|value| value.as_str()).unwrap_or("");
	if !oc_allowed(subcommand) {
		return Err(format!("jyz oc: disallowed subcommand {subcommand:?}"));
	}
	let output = Command::new(program())
		.arg("oc")
		.args(&args)
		.stdin(Stdio::null())
		.output()
		.map_err(|error| format!("could not run {PROGRAM} oc: {error}"))?;
	if output.status.success() {
		Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
	} else {
		let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
		if stderr.is_empty() {
			Err(format!("{PROGRAM} oc exited with {}", output.status))
		} else {
			Err(stderr)
		}
	}
}

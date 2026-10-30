//! The jyz desktop shell: one window onto the CLI's JSON-RPC stdio surface.
//!
//! The window owns no resolution logic. A call spawns the installed `jyz`, writes exactly one
//! newline-terminated JSON-RPC request frame, reads one response line, and kills the child. The
//! raw line goes back to the page, which parses it with the helpers in `src/bridge.ts`, so result
//! extraction and error mapping live where a unit test reaches them. A transport fault — no `jyz`
//! on PATH, no answer, a timeout — comes back as an error string instead of a frame.

use std::io::{BufRead, BufReader, Read, Write};
use std::process::{Child, Command, Stdio};
use std::sync::mpsc::{self, RecvTimeoutError};
use std::thread;
use std::time::Duration;

#[cfg(unix)]
mod linux_process;

/// The program name every install of the CLI answers to.
const PROGRAM: &str = "jyz";

/// How long one capability call may take before the child is killed.
const CALL_TIMEOUT: Duration = Duration::from_secs(30);

#[cfg(unix)]
fn program() -> String {
	linux_process::resolve()
}

#[cfg(not(unix))]
fn program() -> String {
	PROGRAM.to_string()
}

/// One capability call: `method` names a capability, `params` is its JSON object as text.
///
/// Returns the response frame, not the extracted result: the page needs the JSON-RPC error code
/// too, and a `Value` here would need `serde_json` as a direct dependency.
#[tauri::command]
fn jyz_call(method: String, params: String) -> Result<String, String> {
	let name = method.trim();
	if name.is_empty() {
		return Err("jyz_call needs a method".to_string());
	}
	round_trip(&serve_argv(), &request_frame(name, &params))
}

/// The capability manifest: runs `jyz capabilities --json` and returns the parsed array.
///
/// A non-zero exit or unparseable output yields an empty array instead of an error, so the page
/// can always render a method list even when the CLI is missing or misbehaving.
#[tauri::command]
fn jyz_capabilities() -> Vec<serde_json::Value> {
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

/// The `--version` line the window footer prints.
#[tauri::command]
fn jyz_version() -> Result<String, String> {
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

/// `jyz serve`, resolving against the window's project directory when it has one.
fn serve_argv() -> Vec<String> {
	let mut argv = vec!["serve".to_string()];
	if let Some(cwd) = project_dir() {
		argv.push("--cwd".to_string());
		argv.push(cwd);
	}
	argv
}

/// The directory the CLI resolves against: `JYZ_CWD` when a launcher set it, else the process
/// directory. A bundled app started from Finder sits at `/`, where the CLI finds no project.
fn project_dir() -> Option<String> {
	if let Ok(cwd) = std::env::var("JYZ_CWD") {
		if !cwd.trim().is_empty() {
			return Some(cwd);
		}
	}
	std::env::current_dir()
		.ok()
		.map(|dir| dir.display().to_string())
}

/// Spawn `jyz`, hand it one frame, and return the one line it answered with.
fn round_trip(argv: &[String], frame: &str) -> Result<String, String> {
	let mut child = spawn(argv)?;
	let mut stdin = child
		.stdin
		.take()
		.ok_or("jyz is not accepting a request on stdin")?;
	stdin
		.write_all(frame.as_bytes())
		.and_then(|()| stdin.flush())
		.map_err(|error| format!("could not write the request to {PROGRAM}: {error}"))?;
	// Closing stdin lets `jyz serve` answer its remaining buffer, then exit on EOF by itself.
	drop(stdin);
	let stdout = child
		.stdout
		.take()
		.ok_or("jyz is not answering on stdout")?;
	let stderr = child.stderr.take();
	// Reading on a thread is what makes the timeout real: a hung child cannot block the caller.
	let (sender, receiver) = mpsc::channel();
	thread::spawn(move || {
		let mut reader = BufReader::new(stdout);
		let mut line = String::new();
		let outcome = reader.read_line(&mut line).map(|_| line);
		let _ = sender.send(outcome);
	});
	let outcome = receiver.recv_timeout(CALL_TIMEOUT);
	let _ = child.kill();
	let _ = child.wait();
	let complaints = stderr.map(read_to_string).unwrap_or_default();
	match outcome {
		Ok(Ok(line)) => {
			let line = line.trim().to_string();
			if line.is_empty() {
				Err(answered_nothing(&complaints))
			} else {
				Ok(line)
			}
		}
		Ok(Err(error)) => Err(format!("could not read the answer from {PROGRAM}: {error}")),
		Err(RecvTimeoutError::Timeout) => Err(format!(
			"{PROGRAM} did not answer within {}s",
			CALL_TIMEOUT.as_secs()
		)),
		Err(RecvTimeoutError::Disconnected) => Err(answered_nothing(&complaints)),
	}
}

fn read_to_string(mut handle: impl Read) -> String {
	let mut text = String::new();
	let _ = handle.read_to_string(&mut text);
	text.trim().to_string()
}

/// An empty answer, quoting the child's stderr when it said anything.
fn answered_nothing(stderr: &str) -> String {
	if stderr.is_empty() {
		format!("{PROGRAM} answered nothing")
	} else {
		format!("{PROGRAM} answered nothing: {stderr}")
	}
}

fn spawn(argv: &[String]) -> Result<Child, String> {
	let mut command = Command::new(program());
	command
		.args(argv)
		.stdin(Stdio::piped())
		.stdout(Stdio::piped())
		.stderr(Stdio::piped());
	#[cfg(unix)]
	linux_process::isolate(&mut command);
	command
		.spawn()
		.map_err(|error| format!("could not start {PROGRAM}: {error}"))
}

/// The JSON-RPC 2.0 request frame for one call: a single newline-terminated message.
fn request_frame(method: &str, params: &str) -> String {
	let params = params.trim();
	let params = if params.is_empty() { "null" } else { params };
	format!(
		"{{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":{},\"params\":{params}}}\n",
		json_string(method)
	)
}

/// A JSON string literal: the escapes the format requires, nothing else.
fn json_string(text: &str) -> String {
	let mut out = String::with_capacity(text.len() + 2);
	out.push('"');
	for character in text.chars() {
		match character {
			'"' => out.push_str("\\\""),
			'\\' => out.push_str("\\\\"),
			'\n' => out.push_str("\\n"),
			'\r' => out.push_str("\\r"),
			'\t' => out.push_str("\\t"),
			control if (control as u32) < 0x20 => {
				out.push_str(&format!("\\u{:04x}", control as u32));
			}
			plain => out.push(plain),
		}
	}
	out.push('"');
	out
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
	tauri::Builder::default()
		.invoke_handler(tauri::generate_handler![
			jyz_call,
			jyz_version,
			jyz_capabilities
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
}

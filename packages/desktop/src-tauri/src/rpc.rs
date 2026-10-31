//! JSON-RPC call plumbing: spawn, round-trip, frame helpers.

use std::io::{BufRead, BufReader, Read, Write};
use std::process::{Child, Command, Stdio};
use std::sync::mpsc::{self, RecvTimeoutError};
use std::thread;
use std::time::Duration;

use crate::program::{program, CALL_TIMEOUT_SECS, PROGRAM};

pub fn call_timeout() -> Duration {
	Duration::from_secs(CALL_TIMEOUT_SECS)
}

pub fn spawn(argv: &[String]) -> Result<Child, String> {
	let mut command = Command::new(program());
	command
		.args(argv)
		.stdin(Stdio::piped())
		.stdout(Stdio::piped())
		.stderr(Stdio::piped());
	#[cfg(unix)]
	crate::linux_process::isolate(&mut command);
	command
		.spawn()
		.map_err(|error| format!("could not start {PROGRAM}: {error}"))
}

pub fn round_trip(argv: &[String], frame: &str) -> Result<String, String> {
	let mut child = spawn(argv)?;
	let mut stdin = child
		.stdin
		.take()
		.ok_or("jyz is not accepting a request on stdin")?;
	stdin
		.write_all(frame.as_bytes())
		.and_then(|()| stdin.flush())
		.map_err(|error| format!("could not write the request to {PROGRAM}: {error}"))?;
	drop(stdin);
	let stdout = child
		.stdout
		.take()
		.ok_or("jyz is not answering on stdout")?;
	let stderr = child.stderr.take();
	let (sender, receiver) = mpsc::channel();
	thread::spawn(move || {
		let mut reader = BufReader::new(stdout);
		let mut line = String::new();
		let outcome = reader.read_line(&mut line).map(|_| line);
		let _ = sender.send(outcome);
	});
	let outcome = receiver.recv_timeout(call_timeout());
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
			call_timeout().as_secs()
		)),
		Err(RecvTimeoutError::Disconnected) => Err(answered_nothing(&complaints)),
	}
}

pub fn read_to_string(mut handle: impl Read) -> String {
	let mut text = String::new();
	let _ = handle.read_to_string(&mut text);
	text.trim().to_string()
}

pub fn answered_nothing(stderr: &str) -> String {
	if stderr.is_empty() {
		format!("{PROGRAM} answered nothing")
	} else {
		format!("{PROGRAM} answered nothing: {stderr}")
	}
}

pub fn request_frame(method: &str, params: &str) -> String {
	let params = params.trim();
	let params = if params.is_empty() { "null" } else { params };
	format!(
		"{{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":{},\"params\":{params}}}\n",
		json_string(method)
	)
}

pub fn json_string(text: &str) -> String {
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

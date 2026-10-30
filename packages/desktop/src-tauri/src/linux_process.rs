//! Finding and isolating the CLI child on Linux.
//!
//! Two things a Linux desktop install cannot take for granted. A launcher does not inherit the
//! shell's `PATH`, so `jyz` may be installed and still invisible to `Command::new("jyz")`; and a
//! child that outlives the window keeps the JSON-RPC pipe open. The first is a lookup with the
//! standard install locations as a fallback, the second is one process group per call, so a kill
//! reaches everything the call started.
//!
//! The module is compiled on every unix so `cargo check` on a mac still type-checks it; only the
//! lookup order below is Linux-specific.

use std::path::Path;
use std::process::Command;

/// Where an installer puts `jyz` on Linux, in the order a shell would find them.
const CANDIDATES: [&str; 3] = ["/usr/local/bin/jyz", "/usr/bin/jyz", "/opt/jyz/bin/jyz"];

/// The `jyz` to run: the one `PATH` yields, else the first standard location that exists.
///
/// Answers the bare program name when neither finds it, so the spawn error names what was missing
/// instead of pointing at a path that was never there.
pub fn resolve() -> String {
	let on_path = std::env::var_os("PATH")
		.map(|path| {
			std::env::split_paths(&path)
				.map(|dir| dir.join("jyz"))
				.find(|candidate| candidate.is_file())
		})
		.flatten();
	if let Some(found) = on_path {
		return found.display().to_string();
	}
	for candidate in CANDIDATES {
		if Path::new(candidate).is_file() {
			return candidate.to_string();
		}
	}
	"jyz".to_string()
}

/// Put the child in its own process group, so closing the window cannot orphan it inside ours.
pub fn isolate(command: &mut Command) {
	use std::os::unix::process::CommandExt;
	command.process_group(0);
}

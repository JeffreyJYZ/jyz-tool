//! Resolution of the `jyz` CLI binary and the argv it is invoked with.

use std::path::Path;
use std::path::PathBuf;

/// The program name every install of the CLI answers to.
pub const PROGRAM: &str = "jyz";

/// How long one capability call may take before the child is killed.
pub const CALL_TIMEOUT_SECS: u64 = 30;

/// The directory that may hold a sibling `jyz` binary, taken from `current_exe()`.
pub fn sibling_dir() -> Option<PathBuf> {
	std::env::current_exe()
		.ok()?
		.parent()
		.map(|dir| dir.to_path_buf())
}

/// The name the installer gives the sidecar on this platform.
pub fn sidecar_name() -> &'static str {
	if cfg!(windows) {
		"jyz.exe"
	} else {
		"jyz"
	}
}

/// A `jyz` sitting beside the running executable, if one is there.
pub fn sibling_candidate(dir: &Path) -> Option<String> {
	let candidate = dir.join(sidecar_name());
	if candidate.is_file() {
		Some(candidate.display().to_string())
	} else {
		None
	}
}

/// Resolve the CLI to run: a sibling sidecar wins over `PATH` and the Linux fallbacks.
pub fn resolve_program(sibling: Option<&Path>) -> String {
	if let Some(dir) = sibling {
		if let Some(found) = sibling_candidate(dir) {
			return found;
		}
	}
	#[cfg(unix)]
	{
		crate::linux_process::resolve()
	}
	#[cfg(not(unix))]
	{
		PROGRAM.to_string()
	}
}

pub fn program() -> String {
	resolve_program(sibling_dir().as_deref())
}

/// `jyz serve`, resolving against the window's project directory when it has one.
pub fn serve_argv() -> Vec<String> {
	let mut argv = vec!["serve".to_string()];
	if let Some(cwd) = project_dir() {
		argv.push("--cwd".to_string());
		argv.push(cwd);
	}
	argv
}

/// The directory the CLI resolves against: `JYZ_CWD` when a launcher set it, else the process
/// directory. A bundled app started from Finder sits at `/`, where the CLI finds no project.
pub fn project_dir() -> Option<String> {
	if let Ok(cwd) = std::env::var("JYZ_CWD") {
		if !cwd.trim().is_empty() {
			return Some(cwd);
		}
	}
	std::env::current_dir()
		.ok()
		.map(|dir| dir.display().to_string())
}

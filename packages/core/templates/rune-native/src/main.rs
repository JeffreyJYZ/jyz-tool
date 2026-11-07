// A Rune app is a plain crate: Cargo.toml plus this file. No manifest, no
// build script, nothing generated.

use rune::{AppSpec, Cx, El, TextStyle, col, el, oklch, text};

const NAME: &str = "__NAME__";
const VERSION: &str = "__VERSION__";

fn ink() -> rune::Color {
	oklch(0.97, 0.01, 270.0)
}

fn dim() -> rune::Color {
	oklch(0.64, 0.02, 270.0)
}

fn accent() -> rune::Color {
	oklch(0.72, 0.19, 300.0)
}

#[derive(Default)]
struct App {
	taps: u32,
}

fn view(s: &App, _cx: &mut Cx<App>) -> El {
	col()
		.key("root")
		.w_full()
		.h_full()
		.center()
		.gap(10.0)
		.fill(oklch(0.18, 0.02, 270.0))
		.child(
			text(NAME)
				.key("name")
				.font(TextStyle::new(18.0, 600.0))
				.color(ink()),
		)
		.child(
			text(format!("v{VERSION} · tapped {} times", s.taps))
				.key("status")
				.font(TextStyle::new(12.0, 500.0).features("'tnum' 1"))
				.color(dim()),
		)
		.child(
			el()
				.key("tap")
				.role("button")
				.label("Tap")
				.h(40.0)
				.px(18.0)
				.center()
				.radius(12.0)
				.fill(accent())
				.on_press(|s: &mut App| s.taps += 1)
				.child(
					text("Tap")
						.key("glyph")
						.font(TextStyle::new(13.0, 600.0))
						.color(oklch(0.18, 0.02, 270.0)),
				),
		)
}

fn main() {
	// `scenes` is what makes `--snap` able to render a state that is not the
	// default; without one, headless verification only ever sees the first frame.
	// The literal ends `..AppSpec::new(..)` on purpose: a new upstream field must
	// not break this file.
	rune::run(AppSpec::<App> {
		scenes: &[("default", |_| {}), ("tapped", |s| s.taps = 3)],
		..AppSpec::new(NAME, (360.0, 240.0), App::default, view)
	});
}

#[cfg(test)]
mod tests {
	use super::*;
	use rune::{Env, Runtime};

	#[test]
	fn a_tap_counts() {
		let mut rt = Runtime::new(App::default(), view, (360.0, 240.0), Env::new(true, 2.0));
		rt.frame(0.0);
		let (x, y) = rt.find("tap").expect("the button is laid out");
		rt.pointer_down(x, y);
		rt.pointer_up(x, y);
		rt.frame(1.0 / 60.0);
		assert_eq!(rt.state.taps, 1);
	}
}

pub struct Greeting {
	pub name: &'static str,
}

impl Greeting {
	pub fn new(name: &'static str) -> Self {
		Self { name }
	}
}

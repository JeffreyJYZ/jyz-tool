pub struct Greeting {
	pub name: String,
}

impl Greeting {
	pub fn new(name: &str) -> Self {
		Self {
			name: name.to_string(),
		}
	}
}

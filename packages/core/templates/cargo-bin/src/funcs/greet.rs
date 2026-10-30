use crate::types::Greeting;

pub fn greet(greeting: &Greeting) -> String {
	format!("{} is running", greeting.name)
}

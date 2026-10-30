mod funcs;
mod types;

use crate::funcs::greet::greet;
use crate::types::Greeting;

fn main() {
	let greeting = Greeting::new("__NAME__");
	println!("{}", greet(&greeting));
}

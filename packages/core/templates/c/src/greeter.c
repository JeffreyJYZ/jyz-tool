#include <stdio.h>

#include "greeter.h"

char *greet(const char *name) {
	static char message[128];
	snprintf(message, sizeof message, "%s is running", name);
	return message;
}

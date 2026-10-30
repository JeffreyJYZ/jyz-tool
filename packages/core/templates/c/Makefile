# C17, chosen at M3 and recorded here so the standard never drifts silently.
CC ?= cc
CFLAGS ?= -std=c17 -Wall -Wextra -Wpedantic -O2 -Isrc
BIN := dist/__NAME__

.PHONY: all build run check fmt lint clean

all: build

build: $(BIN)

$(BIN): src/main.c src/greeter.c src/greeter.h
	@mkdir -p dist
	$(CC) $(CFLAGS) src/main.c src/greeter.c -o $(BIN)

run: build
	./$(BIN)

check:
	$(CC) $(CFLAGS) -fsyntax-only src/main.c src/greeter.c

fmt:
	clang-format -i src/*.c src/*.h

lint:
	clang-tidy src/main.c src/greeter.c -- $(CFLAGS)

clean:
	rm -rf dist

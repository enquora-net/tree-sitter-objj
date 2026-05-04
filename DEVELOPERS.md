# Developer Setup

macOS-focused. Linux instructions to follow.

---

## Quick start

For grammar development only — verifying parse correctness and running tests
without a full cross-platform build:

```sh
tree-sitter generate
tree-sitter build
```

`tree-sitter build` compiles the grammar using the system compiler and produces
`tree-sitter-objj.dylib` in the current directory. This is the filename other
toolchain components expect. For those tools to find it without manual
configuration, copy it to the standard location:

```sh
sudo cp tree-sitter-objj.dylib /usr/local/lib/
```

This path is not a substitute for `make install-local`, which builds versioned
release artifacts via Zig. Use this quick start only for grammar development
and test iteration.

---

## Prerequisites

### Xcode Command Line Tools

Required for the macOS SDK headers, which Zig uses when targeting macOS.

```sh
xcode-select --install
```

### Zig

Install from the canonical source at [ziglang.org/download](https://ziglang.org/download/).
Do not use MacPorts or Homebrew — both pin Zig against their own Clang toolchain,
which is unnecessary on macOS where the system SDK is already present.

The download package contains installation instructions. The conventional placement
is the Zig binary in `/usr/local/bin` and supporting files in `/usr/local/lib`,
which puts it on the default `PATH` without further configuration.

Verify:

```sh
zig version
```

### tree-sitter CLI

Required to regenerate `src/parser.c` from `grammar.js`. The CLI requires
Node.js 18 or later. If you use MacPorts:

```sh
port install nodejs20
```

Then install the CLI:

```sh
npm install -g tree-sitter-cli
```

Verify:

```sh
tree-sitter --version
```

---

## Building

```sh
make
```

Runs `tree-sitter generate` followed by a full cross-platform build for macOS,
Linux, and Windows. All artifacts are written to `./build/`, versioned, and
accompanied by individual SHA-256 checksum files.

---

## Installing locally

For development and testing of other toolchain components against the current
build:

```sh
sudo make install-local
```

Installs the appropriate library for the current host to `/usr/local/lib`.

To remove:

```sh
sudo make uninstall-local
```

---

## Running the tests

```sh
tree-sitter test
```

Runs the corpus tests in `test/corpus/`. All tests must pass before committing
a grammar change.

---

## Version

The current version is the first line of `version.txt`. Increment it before
cutting a release. Pre-release versions follow semver convention:
`1.0.0-beta.1`, `1.0.0-beta.2`, and so on.

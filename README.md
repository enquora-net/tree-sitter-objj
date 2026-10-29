# tree-sitter-objj

The [tree-sitter](https://tree-sitter.github.io/tree-sitter/) grammar for [Objective-J](https://www.cappuccino.dev/), the language of the [Cappuccino](https://github.com/cappuccino/cappuccino) web application framework.

This is a runtime dependency of the Cappuccino toolchain, not a tool itself.
Most users need only install the compiled dynamic library. The grammar source is here for editor integrations, third-party tooling authors, and contributors.

Tree-sitter is used for the parser because the grammar is a declarative specification written in JavaScript - accessible to anyone familiar with the Objective-J language, without requiring parser theory expertise. The compiled parser is high-performance, supports keystroke-level incremental re-parsing, and produces useful partial trees even for source containing errors. The compiled C library can be consumed from any language with a C FFI - Go,  Swift, Python, Rust, and others - making the same grammar available to static analysis tools, linters, formatters, and editor integrations without each needing its own independent implementation. [capp-parse](https://github.com/enquora-net/capp-parse) is a convenient command-line tool and Go library for running the grammar directly.

> **Pre-release.** This software is in developer preview. It should only be
> used in environments where rollback or recovery is in place.
>
> The grammar has been validated against the full Cappuccino AppKit and
> Foundation corpus and is stable in practice. Toolchain hardening ahead of
> full release may nonetheless require minor adjustments to the CST node
> structure. Any such changes will be small; none are anticipated. Tooling
> authors who depend on specific node types or field names should treat the
> CST shape as settled but watch the changelog before upgrading.

---

## Installation

Download the dynamic library for your platform from the
[releases page](https://github.com/enquora-net/tree-sitter-objj/releases).
Release files are named for platform, architecture and version; rename the file
when installing it:

| Platform | Release file | Install as |
|---|---|---|
| macOS, Apple silicon | `tree-sitter-objj_macos_arm64_<version>.dylib` | `libtree-sitter-objj.dylib` |
| macOS, Intel | `tree-sitter-objj_macos_x64_<version>.dylib` | `libtree-sitter-objj.dylib` |
| Linux, x86-64 | `tree-sitter-objj_linux_x64_<version>.so` | `libtree-sitter-objj.so` |
| Linux, arm64 | `tree-sitter-objj_linux_arm64_<version>.so` | `libtree-sitter-objj.so` |
| Windows, x86-64 | `tree-sitter-objj_windows_x64_<version>.dll` | `tree-sitter-objj.dll` |
| Windows, arm64 | `tree-sitter-objj_windows_arm64_<version>.dll` | `tree-sitter-objj.dll` |

The Linux libraries require glibc 2.28 or later.

### Install locations

The toolchain searches these directories in order and uses the first library it
finds. A per-user copy therefore takes precedence over a system-wide one, which
lets a new version be tried without removing the old. The canonical list is
defined in capp-parse's `grammar` package; `capp-build env` shows it for the
current machine.

**macOS**

1. `~/Library/Application Support/dev.cappuccino/grammar` - current user
2. `/Library/Application Support/dev.cappuccino/grammar` - all users
3. `/usr/local/lib` - all users, unmanaged

**Linux**

1. `$XDG_DATA_HOME/cappuccino/grammar`, by default
   `~/.local/share/cappuccino/grammar` - current user
2. `/usr/local/lib` - all users

**Windows**

1. `%LOCALAPPDATA%\Cappuccino\grammar` - current user
2. `%ProgramFiles%\Cappuccino\grammar` - all users; requires
   administrator rights

### Example: macOS, current user

```sh
DIR="$HOME/Library/Application Support/dev.cappuccino/grammar"
mkdir -p "$DIR"
cp tree-sitter-objj_macos_arm64_2.0.0-beta.2.dylib "$DIR/libtree-sitter-objj.dylib"
```

Gatekeeper quarantines downloaded files. Strip the attribute before use:

```sh
xattr -d com.apple.quarantine "$HOME/Library/Application Support/dev.cappuccino/grammar/libtree-sitter-objj.dylib"
```

### Checking the download

Each release file has a matching `.sha256` file holding its SHA-256 checksum.
The two lines printed by these commands must be identical:

```sh
shasum -a 256 tree-sitter-objj_macos_arm64_2.0.0-beta.2.dylib | cut -d' ' -f1
cat tree-sitter-objj_macos_arm64_2.0.0-beta.2.dylib.sha256
```

### Confirming the installation

```sh
capp-build env
```

This lists every install location, the libraries found in each with their
versions, and which one is in use. capp-build stops with an explanation when
the library in use is missing, cannot be loaded, or is older than it accepts.

---

## Version

Version numbers follow Cappuccino 2: the major version is the Cappuccino
version whose Objective-J the grammar covers, not a count of grammar releases.
The first release was published as `1.0.0-beta.1`; numbering moved to 2.0.0
from `2.0.0-beta.2`, continuing the beta sequence. Breaking changes to node
types or field names are announced in the [changelog](CHANGELOG.md), not by a
change of major version.

Each library reports its version in two ways.

**Release version.** Tree-sitter's standard metadata, readable by any
tree-sitter consumer: `ts_language_metadata()` in C, `Metadata()` in
go-tree-sitter 0.25. It holds major, minor and patch numbers only, so
`2.0.0-beta.2` reports `2.0.0`. It comes from `tree-sitter.json`, and is
present only in libraries generated with tree-sitter CLI 0.25 or later.

**Build version.** An exported function:

```c
const char *tree_sitter_objj_version(void);
```

It returns the full version and the commit the library was built from, for
example `2.0.0-beta.2+g<commit>`, where `<commit>` is the first 12 characters
of the commit hash. The `+g<commit>` part is omitted when the
library is built outside a git checkout. Changes not yet committed when the
library was built are not reflected.

Libraries released before `2.0.0-beta.2` do not export `tree_sitter_objj_version`; a
consumer should treat its absence as an outdated library.

### How the version is set

The first line of `VERSION.txt` is the single source of the version.

1. Edit the first line of `VERSION.txt`, e.g. `2.0.0-beta.3`.
2. Copy it into the package manifests:

   ```sh
   tree-sitter version 2.0.0-beta.3
   ```

   This updates `tree-sitter.json`, `package.json`, `Cargo.toml`,
   `pyproject.toml` and `CMakeLists.txt`.
3. In `CMakeLists.txt`, drop the pre-release part, e.g. `2.0.0`. CMake accepts
   numbers only.
4. Add a `CHANGELOG.md` entry headed `## 2.0.0-beta.3`, followed by the release date.
5. Build:

   ```sh
   make build-all
   ```

   The build stops if `tree-sitter.json` does not match `VERSION.txt`. It then
   regenerates the parser, which compiles the release version into it, and
   builds the six libraries into `build/` with their `.sha256` files. During
   development, `make build` builds the library for this machine only. The
   Makefile passes `VERSION.txt` and the current commit to `src/version.c`,
   which exports them as the build version.

Build a release only from committed source, so that the embedded commit
identifies it. Building requires tree-sitter CLI 0.25 or later, Zig, make and
git.

---

## What this provides

This grammar is the single authoritative source of truth for the syntactic shape of Objective-J. Every tool that needs to understand Objective-J source - the compiler, editor plugins, linters, documentation tooling - reads the same concrete syntax tree, produced from the same grammar, with the same semantics.
There is no secondary or informal specification.

Objective-J is a strict superset of JavaScript, extending it with the fundamental constructs of Objective-C: classes, protocols, message expressions, and a runtime type system. The grammar inherits the core JavaScript rule set from [tree-sitter-javascript](https://github.com/tree-sitter/tree-sitter-javascript) and layers the Objective-J constructs on top without modifying it. A JavaScript-only file parses correctly under this grammar with no special handling, which matters because Cappuccino projects mix `.j` and `.js` files freely.

Tree-sitter was chosen because the grammar is a declarative specification written in JavaScript - accessible to anyone familiar with the Objective-J language, without requiring parser theory expertise. The compiled parser is high-performance, supports keystroke-level incremental re-parsing, and produces useful partial trees even for source containing errors. The compiled C library can be consumed from any language with a C FFI - Go, Swift, Python, Rust, and others - making the same grammar available to static analysis tools, linters,
formatters, and editor integrations without each needing its own independent implementation. [capp-parse](https://github.com/enquora-net/capp-parse) is a convenient command-line tool and Go library for running the grammar directly.

---

## For contributors and grammar authors

See [DEVELOPERS.md](DEVELOPERS.md) for environment setup, build instructions, grammar internals, rule naming conventions, corpus validation workflow, and contribution guidelines.

---

## License

Copyright David Richardson. The binaries distributed here may be freely run
for any purpose. All other rights are reserved pending transfer to the
Cappuccino Project, at which point this software will be released under
AGPL-3.0.

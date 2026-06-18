# tree-sitter-objj

The [tree-sitter](https://tree-sitter.github.io/tree-sitter/) grammar for [Objective-J](https://www.cappuccino.dev/), the language of the [Cappuccino](https://github.com/cappuccino/cappuccino) web application framework.

This is a runtime dependency of the Cappuccino toolchain, not a tool itself.
Most users need only install the compiled dynamic library. The grammar source is here for editor integrations, third-party tooling authors, and contributors.

Tree-sitter was chosen because the grammar is a declarative specification written in JavaScript — accessible to anyone familiar with the Objective-J language, without requiring parser theory expertise. The compiled parser is high-performance, supports keystroke-level incremental re-parsing, and produces useful partial trees even for source containing errors. The compiled C library can be consumed from any language with a C FFI — Go,  Swift, Python, Rust, and others — making the same grammar available to static analysis tools, linters, formatters, and editor integrations without each needing its own independent implementation. [capp-parse](https://github.com/enquora-net/capp-parse) is a convenient command-line tool and Go library for running the grammar directly.

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
[releases page](https://github.com/enquora-net/tree-sitter-objj/releases) and place it in `/usr/local/lib`.

On macOS, Gatekeeper quarantines downloaded files. Strip the attribute before use:

```sh
xattr -d com.apple.quarantine /usr/local/lib/libtree-sitter-objj.dylib
```

Confirm the toolchain can locate it:

```sh
capp-parse verify
```

---

## What this provides

This grammar is the single authoritative source of truth for the syntactic shape of Objective-J. Every tool that needs to understand Objective-J source — the compiler, editor plugins, linters, documentation tooling — reads the same concrete syntax tree, produced from the same grammar, with the same semantics.
There is no secondary or informal specification.

Objective-J is a strict superset of JavaScript, extending it with the fundamental constructs of Objective-C: classes, protocols, message expressions, and a runtime type system. The grammar inherits the core JavaScript rule set from [tree-sitter-javascript](https://github.com/tree-sitter/tree-sitter-javascript) and layers the Objective-J constructs on top without modifying it. A JavaScript-only file parses correctly under this grammar with no special handling, which matters because Cappuccino projects mix `.j` and `.js` files freely.

Tree-sitter was chosen because the grammar is a declarative specification written in JavaScript — accessible to anyone familiar with the Objective-J language, without requiring parser theory expertise. The compiled parser is high-performance, supports keystroke-level incremental re-parsing, and produces useful partial trees even for source containing errors. The compiled C library can be consumed from any language with a C FFI — Go, Swift, Python, Rust, and others — making the same grammar available to static analysis tools, linters,
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

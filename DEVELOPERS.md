# Developer Guide
macOS-focused. Linux instructions to follow.

---

## Quick start
For grammar development — verifying parse correctness and running tests:
```sh
tree-sitter generate
tree-sitter test
```

`tree-sitter test` and `tree-sitter parse` compile the grammar themselves; no separate build step is needed.

To use the grammar from other toolchain components, build the library with `make`. Only `make` compiles in the build version and checks the version files; a library built any other way, such as with `tree-sitter build`, has no build version and is not named as the toolchain expects. For this machine only:

```sh
make build
```

This regenerates the parser if the grammar has changed, builds the library for this machine, and prints its path. Then install it in the per-user location, under the name the toolchain searches for:

```sh
DIR="$HOME/Library/Application Support/dev.cappuccino/grammar"
mkdir -p "$DIR"
cp build/tree-sitter-objj_macos_arm64_$(head -1 VERSION.txt).dylib "$DIR/libtree-sitter-objj.dylib"
```

On an Intel Mac, the library is `tree-sitter-objj_macos_x64_<version>.dylib`.

A library in the per-user location takes precedence over one in `/usr/local/lib`, which is left in place. To install to `/usr/local/lib` instead, see [Installing locally](#installing-locally). For all install locations, see [Install locations](README.md#install-locations).

---

## `make` and the standard tree-sitter workflow

This is a standard tree-sitter grammar with one addition for the Cappuccino toolchain: `src/version.c`, which exports the build version (`tree_sitter_objj_version`). It compiles only when given the version, which `make` supplies. Built without it, the compile stops with `TS_OBJJ_VERSION is not defined`.

**Using the grammar in your own tool** — an editor, linter, code host or other third-party integration: use your usual tree-sitter workflow, such as `tree-sitter build`, the language bindings, or compiling `src/parser.c` and `src/scanner.c`. Do not compile `src/version.c`. If your build compiles every `.c` file in `src/`, exclude it. The release version remains available through tree-sitter's standard `ts_language_metadata()`.

**Building libraries for the Cappuccino toolchain**: use `make`. Only `make` supplies the build version and checks that `tree-sitter.json` matches `VERSION.txt`.

---

## Prerequisites
### Xcode Command Line Tools
Required for the macOS SDK headers, which Zig uses when targeting macOS.
```sh
xcode-select --install
```

### Zig
Install from the canonical source at [ziglang.org/download](https://ziglang.org/download/). Do not use MacPorts or Homebrew — both pin Zig against their own Clang toolchain, which is unnecessary on macOS where the system SDK is already present. The download package contains installation instructions. The conventional placement is the Zig binary in `/usr/local/bin` and supporting files in `/usr/local/lib`, which puts it on the default `PATH` without further configuration. Verify:
```sh
zig version
```

### tree-sitter CLI
Required to regenerate `src/parser.c` from `grammar.js`. Version 0.25 or later is required: earlier versions do not compile the release version into the parser. The CLI requires Node.js 18 or later. If you use MacPorts:
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
During development, build for this machine only:
```sh
make build
```

For a release, build all six platforms:
```sh
make build-all
```

`make` on its own is the same as `make build-all`. Both check that `tree-sitter.json` matches `VERSION.txt`, regenerate the parser if `grammar.js`, `tree-sitter.json` or the inherited JavaScript grammar has changed, and rebuild only the libraries whose sources or build version have changed. All artifacts are written to `./build/`, versioned. `make build-all` also writes a SHA-256 checksum file for each library. Each library carries the release version and the build version described in [Version](README.md#version).

To regenerate the parser unconditionally, run `make generate`. A single platform can be built by name: `macos-arm64`, `macos-x64`, `linux-x64`, `linux-arm64`, `windows-x64`, `windows-arm64`.

---

## Installing locally
For development and testing of other toolchain components against the current build:
```sh
make build
sudo make install-local
```

Building first, without `sudo`, keeps the build artifacts owned by you. `install-local` installs the library for the current host to `/usr/local/lib` as `libtree-sitter-objj.dylib` (macOS) or `libtree-sitter-objj.so` (Linux), the name the toolchain searches for. Any library already installed there under that name is replaced. A library in the per-user location takes precedence over it; see [Install locations](README.md#install-locations). To remove:
```sh
sudo make uninstall-local
```


---

## Running the tests
```sh
tree-sitter test
```

Runs the corpus tests in `test/corpus/`. All tests must pass before committing a grammar change.

---

## Validating against the Cappuccino corpus
Before a grammar change is merged, validate it against the full AppKit and Foundation source in the Cappuccino repository:
```sh
scripts/validate-corpus.sh
```

The [capp-parse](https://github.com/enquora-net/capp-parse) application provides a more fluid workflow for extended grammar work — in particular its `debug` command, which stops at the first parse error and opens the failing file in Xcode at the error line. Failures on previously-passing files are regressions and must be resolved before merging.

---

## How the grammar is structured
The grammar inherits from `tree-sitter-javascript`. Objective-J is a strict superset of JavaScript: every valid JavaScript file is valid Objective-J, and the JavaScript semantics are unchanged. The grammar therefore does not re-specify JavaScript; it extends it. The inheritance is declared in `grammar.json` as:
```json
{
  "name": "objj",
  "inherits": "javascript",
  ...
}
```


All Objective-J additions are layered on top of the JavaScript rules without modifying them. The top-level `statement` rule is extended to admit the Objective-J statement forms; `expression` and `primary_expression` are extended to admit the Objective-J expression forms. Everything else — variable declarations, control flow, functions, classes, template strings, JSX — is inherited unmodified. This layering is intentional and must be preserved. A JavaScript-only file parses correctly under this grammar with no special handling, which matters because Cappuccino projects mix `.j` and `.js` files freely.

---

## The Objective-J language layer

The grammar adds the following constructs on top of JavaScript. Each maps to one or more named rules in the grammar.

### Imports
```objj
@import <Foundation/Foundation.j>
@import "MyClass.j"
```


`objj_import` handles both the angle-bracket (framework) and quoted (relative) forms. These are distinct from ES module `import` statements and carry different semantics: they are resolved at compile time by the Cappuccino build system, not at runtime by the module loader.

### Class declarations and implementations
```objj
@class MyClass;                          // objj_class_forward_declaration

@implementation MyClass : CPObject      // objj_class_implementation
{
    CPString _name;                      // objj_instance_variable
    @outlet CPButton _button;            // objj_visibility_specifier
}

- (id)initWithName:(CPString)aName
{
    ...
}
@end
```


`objj_class_implementation` is the central construct of any Objective-J program. It contains optional instance variables (`objj_instance_variables`, `objj_instance_variable`) and a sequence of method definitions (`objj_method_definition`). Instance variables may carry visibility specifiers (`objj_visibility_specifier`: `@public`, `@protected`, `@private`, `@outlet`,` @accessors`) and, in the `@accessors` case, an accessor attribute list (`objj_accessors_directive`,`objj_accessor_attribute`).

### Protocols

```objj
@protocol Serialisable <NSObject>       // objj_protocol_declaration
- (CPString)serialise;
@optional
- (void)deserialise:(CPString)data;
@end

id <Serialisable> obj;                  // objj_protocol_type
```


`objj_protocol_declaration` mirrors `@implementation` but describes an interface contract. `objj_protocol_reference_list` captures the comma-separated list of adopted protocols in `<...>` angle brackets. `objj_protocol_expression `captures the `@protocol(Name)` introspection expression. Protocol types in variable and parameter declarations are handled by `objj_protocol_type`.

### Method declarations and definitions

```objj
- (void)setName:(CPString)aName age:(int)anAge;   // declaration (in protocol)
- (void)setName:(CPString)aName age:(int)anAge    // definition (in implementation)
{
    _name = aName;
}
```


`objj_method_declaration` (signature only, no body) and `objj_method_definition`(signature plus body) share the same parameter structure: `objj_method_parameter_part` captures each keyword-argument pair, and `objj_method_type` captures the return and parameter type annotations in parentheses. The leading `-` or `+` determines instance vs. class scope.

### Message expressions

```objj
[receiver doSomething]
[receiver setName:aName age:anAge]
[[CPArray alloc] initWithObjects:a, b, nil]
```


`objj_message_expression` is the Objective-J equivalent of a method call. `objj_message_selector` holds either a unary selector or one or more keyword arguments (`objj_message_keyword_argument`). Nested message expressions are handled naturally by the recursive structure of` expression`.

### Selector expressions
```objj
@selector(doSomething:withArgument:)
```


`objj_selector_expression` captures selector literals used for target-action and `performSelector:` patterns. The selector name is decomposed into`objj_selector_name` and `objj_selector_identifier` components.

### Objective-J literals

```objj
@"a string"                    // objj_string_literal
@{ @"key": value }             // objj_dictionary_literal
@[ a, b, c ]                   // objj_array_literal
```


These produce `CPString`, `CPDictionary`, and `CPArray` values respectively rather than JavaScript primitives. The rule `_objj_literal` is the supertype grouping all three. `native_array` and `_bracket_expression` handle the syntactic overlap between subscript access (`a[i]`), JavaScript array literals, and Objective-J message expressions, which share the `[` character. The precedence and conflict resolution for these is non-trivial; see the `conflicts` section of the grammar.

### Type annotations

```objj
- (CPString)name
- (void)setName:(CPString)aName
CPString _name;
```


`objj_type` covers the full range of type positions: primitive C types (`int`,`float`, `char`, etc.), Objective-J class types (`CPString`, `CPArray`), `id`,`void`, and pointer forms. `objj_multi_word_type` handles multi-token type names such as `unsigned long` and `unsigned int`. `objj_protocol_type` handles`id <Protocol>` qualified types.

### Globals and typedefs

```objj
@global MyGlobalFunction
typedef unsigned int CPUInteger;
```


`objj_global_declaration` marks a symbol as globally accessible across compilation units. `objj_typedef` introduces a type alias, mirroring C typedef semantics.

### Preprocessor directives

```objj
#if PLATFORM(DOM)
...
#else
...
#endif
```


`preproc_if_block`, `preproc_if_line`, `preproc_else_line`, `preproc_endif_line`, `preproc_condition`, and `preproc_directive` handle the preprocessor subset used in Cappuccino source. `preproc_ivar_if_block` handles the case where preprocessor conditionals appear inside an `@implementation`instance variable block, which requires distinct handling because the enclosing context is not a general statement context. `system_lib_string` is the `<...>` token form used inside `@import` and preprocessor include directives.

---

## Rule naming conventions

Rules follow a consistent naming scheme throughout the grammar.

Rules prefixed `objj_` are Objective-J constructs with no JavaScript counterpart. These are the rules most likely to require attention when the Objective-J language changes. Rules prefixed `preproc_` are preprocessor constructs. They are not part of the JavaScript layer and are not Objective-J object-model constructs; they belong to the textual preprocessing stage. Rules prefixed with `_` (underscore) are **hidden rules** in tree-sitter terminology. They participate in matching but do not appear as named nodes in the output syntax tree. They are structural conveniences — factored-out common sequences or alternatives — inlined into their call sites in the generated tree. For example, `_objj_literal` groups `objj_string_literal`, `objj_dictionary_literal`, and `objj_array_literal`; a consumer cares about which literal it has, not that it matched the supertype.

Rules without either prefix are inherited from or parallel to the JavaScript grammar. Modifying them requires understanding the inheritance mechanism; changes that remove or rename inherited rules will break the JavaScript layer.

---

## Consumer interface contracts

The grammar serves multiple consumers. The design constraint is that all share one tree; there is no per-consumer variant.

**Compiler.** The compiler relies on named fields within rules to locate operands without positional fragility. Named fields are declared with the `field()` combinator in `grammar.js`. When adding or modifying rules that the compiler consumes, check whether existing field names are depended upon.

**Editor syntax highlighting.** Highlight queries live in `queries/highlights.scm`. Node type names used in those queries must remain stable when rules are renamed. Renaming an `objj_`-prefixed rule requires updating the highlight queries.

**Linting.** Linters depend on the tree being accurate even for partially written code, which requires that error recovery produce plausible partial trees. Rules that introduce deeply nested optional structure can degrade recovery quality.

**Documentation generation.** The grammar preserves `comment` nodes (inherited from the JavaScript grammar) in positions where Doxygen expects them. Rules must not introduce anonymous intermediate nodes between a comment and the declaration it precedes.

---

## Working with the grammar

**Adding a new keyword or attribute.** Find the rule that handles the surrounding construct and add the new string literal to the appropriate `CHOICE`. Run `tree-sitter generate` and `tree-sitter test` to confirm no conflicts were introduced.

**Adding a new top-level statement form.** Add an `objj_`-prefixed rule, then add a `SYMBOL` reference to it in the `statement` rule's `CHOICE` list.

**A construct is being misclassified.** Run `tree-sitter parse --cst file.j` and inspect the tree. If the tree is wrong, the grammar needs changing. If the tree is correct but highlighting is wrong, the query file needs changing.

**Conflicts.** An unexpected conflict means a new rule is ambiguous with an existing one. The most common cause is a new construct beginning with `@`, `[`, or `(` — tokens shared with existing constructs. Consult the `conflicts` and `precedences` arrays to understand how existing resolutions work before adding a new one.

**Do not modify inherited JavaScript rules** unless you understand the inheritance mechanism thoroughly. The JavaScript rules are not present in `grammar.js`; they exist in the upstream `tree-sitter-javascript` dependency and are merged at generation time. Overriding them should be treated as a last resort, documented explicitly, and kept to the minimum change necessary.

---

## Generated files

The files `src/parser.c`, `src/grammar.json`, `src/node-types.json`, and the headers in `src/tree_sitter/` are **generated artefacts**. They are not committed to the repository; `make` regenerates them whenever the grammar changes, so building requires `tree-sitter-cli`. They must never be edited by hand. Always edit `grammar.js` and regenerate.

`src/scanner.c` and `src/version.c` are hand-written and committed.

`grammar.json` is the serialised form of the compiled grammar DSL, consumed by downstream binding generators and language server integrations. It is the file from which the node type index (`src/node-types.json`) and the grammar schema are derived.

---

## Contributing

Contributions are welcome from the Cappuccino community. The bar for grammar changes is correctness against the full Cappuccino source corpus, not parser theory expertise. If a change passes `tree-sitter test` and the corpus validation script, it is almost certainly correct.

For changes to Objective-J constructs, the reference is the Cappuccino compiler itself. If the compiler accepts it, the grammar should accept it. If there is disagreement, file an issue with a minimal reproducing example.

Do not open pull requests that reformat `grammar.js` without a corresponding behaviour change. The file structure is intentional.

---

## Relationship to upstream grammars

This grammar depends on [tree-sitter-javascript](https://github.com/tree-sitter/tree-sitter-javascript) as its base. The JavaScript grammar version is pinned in `package.json`. When upgrading the JavaScript dependency, run the full corpus validation before releasing, as JavaScript grammar changes can alter inherited rule names or conflict resolution in ways that affect Objective-J constructs.

The grammar does not depend on, and should not be confused with, any Objective-C tree-sitter grammar. Objective-J shares Objective-C's object model syntax but has JavaScript as its expression and statement language, not C. The type system is advisory rather than enforced, and there is no C preprocessor macro expansion at the grammar level — only the conditional inclusion forms used in Cappuccino's platform abstraction layer.

---

## Version

The current version is the first line of `VERSION.txt`. Increment it before cutting a release. The major version follows Cappuccino 2 rather than counting grammar releases; see [Version](README.md#version). Pre-release versions follow semver convention: `2.0.0-beta.2`, `2.0.0-beta.3`, and so on. The steps for changing it are in [How the version is set](README.md#how-the-version-is-set).

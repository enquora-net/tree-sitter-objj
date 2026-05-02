# tree-sitter-objj

A [tree-sitter](https://tree-sitter.github.io/tree-sitter/) grammar for
[Objective-J](https://www.cappuccino.dev/), the language of the
[Cappuccino](https://github.com/cappuccino/cappuccino) web application framework.

---

## Contents

- [What this repository is](#what-this-repository-is)
- [Why a grammar exists at all](#why-a-grammar-exists-at-all)
- [What tree-sitter does — and does not do](#what-tree-sitter-does--and-does-not-do)
- [How this grammar is structured](#how-this-grammar-is-structured)
- [The Objective-J language layer](#the-objective-j-language-layer)
- [Rule naming conventions](#rule-naming-conventions)
- [Consumers of this grammar](#consumers-of-this-grammar)
- [Working with the grammar as a non-specialist](#working-with-the-grammar-as-a-non-specialist)
- [Development workflow](#development-workflow)
- [Contributing](#contributing)
- [Relationship to upstream grammars](#relationship-to-upstream-grammars)

---

## What this repository is

This repository contains the formal grammar that describes every syntactically valid construct in Objective-J source code. It is the single authoritative source of truth for the shape of the language — used simultaneously by the compiler, editor plugins, linters, and documentation tooling. Every tool that needs to understand Objective-J source reads the same tree, produced from the same grammar, with the same semantics. There is no secondary or informal specification.

---

## Why tree-sitter rather than a hand-written parser

Cappuccino is maintained by a volunteer community, most of whom are application developers rather than language-tooling specialists. Previously, the parser was implemented in raw Javascript using a forked version of the Acorn parser as a base.

That approach accumulated several compounding problems. Acorn is a JavaScript parser; the Objective-J extensions had to be grafted onto it by modifying its internals rather than composing with it cleanly. Every upstream Acorn improvement or fix had to be evaluated against the fork's divergence and either ported manually or abandoned. The fork was therefore simultaneously out of date with JavaScript evolution and difficult for a non-specialist to modify without breaking something non-obviously.

More critically, a JavaScript parser implemented in JavaScript is effectively captive to that runtime. Any tool outside the Node.js ecosystem — a Go-based compiler pipeline, a native editor plugin, a linter written in Python or Rust — had no viable path to consuming the same parser. Each would have needed its own independent implementation, each with its own interpretation of edge cases, each diverging silently from the others over time. The result would have been exactly the situation tree-sitter is designed to prevent: one language, multiple incompatible parsers, no authoritative source of truth.

Tree-sitter solves all of these problems at once. The grammar is written once, in a declarative DSL, and compiled to a C parser with bindings available for every language an Objective-J tool is likely to be written in. The C ABI is the only viable shared library boundary across runtimes, and tree-sitter targets it directly. A Go pipeline, a Swift editor extension, and a JavaScript build tool can all consume the identical parser, producing identical trees, from a single grammar definition. A change to the language requires one authoritative edit to grammar.js. Every consumer follows on its next rebuild.

The grammar is simultaneously the specification, the documentation, and the running implementation. All of this while being maintainable by anyone who understands the target language semantics (objj in this case).

---

## What tree-sitter does — and does not do

Tree-sitter is a **parser generator**. A grammar is written in a JavaScript DSL (`grammar.js`); tree-sitter compiles it to a C parser and a set of binding libraries. The resulting parser accepts source text and produces a **concrete syntax tree (CST)** — a lossless, structured representation of every token in the file, including whitespace and comments where relevant.

Tree-sitter parsers are:

- **Incremental.** They re-parse only the portions of a file that changed,
  making them fast enough for keystroke-by-keystroke editor use.
- **Error-tolerant.** They produce a partial tree even for source containing
  syntax errors, which is essential for editor support of in-progress code.
- **Language-agnostic at the consumer level.** Every tree-sitter language
  exposes the same query and traversal API, so a tool written against the
  tree-sitter API can support many languages without language-specific code.

Tree-sitter does **not** perform semantic analysis. It does not resolve names, infer types, or check whether a method exists on a class. It knows only structure, not meaning. Semantic checks belong in later pipeline stages that consume the CST.

---

## How this grammar is structured

The grammar inherits from `tree-sitter-javascript`. Objective-J is a strict superset of JavaScript: every valid JavaScript file is valid Objective-J, and the JavaScript semantics are unchanged. The grammar therefore does not re-specify JavaScript; it extends it.

The inheritance is declared in `grammar.json` as:

```json
{
  "name": "objj",
  "inherits": "javascript",
  ...
}
```

All Objective-J additions are layered on top of the JavaScript rules without modifying them. The top-level `statement` rule is extended to admit the Objective-J statement forms; the `expression` and `primary_expression` rules are extended to admit the Objective-J expression forms. Everything else — variable declarations, control flow, functions, classes, template strings, JSX — is inherited unmodified.

This layering is intentional and must be preserved. It means that a
JavaScript-only file parses correctly under this grammar with no special
handling - important because Cappuccino projects mix `.j` and `.js`
files freely.

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

`objj_class_implementation` is the central construct of any Objective-J
program. It contains optional instance variables (`objj_instance_variables`,
`objj_instance_variable`) and a sequence of method definitions
(`objj_method_definition`). Instance variables may carry visibility specifiers
(`objj_visibility_specifier`: `@public`, `@protected`, `@private`, `@outlet`,
`@accessors`) and, in the `@accessors` case, an accessor attribute list
(`objj_accessors_directive`, `objj_accessor_attribute`).

### Protocols

```objj
@protocol Serialisable <NSObject>       // objj_protocol_declaration
- (CPString)serialise;
@optional
- (void)deserialise:(CPString)data;
@end

id <Serialisable> obj;                  // objj_protocol_type
```

`objj_protocol_declaration` mirrors `@implementation` but describes an
interface contract. `objj_protocol_reference_list` captures the
comma-separated list of adopted protocols in `<...>` angle brackets.
`objj_protocol_expression` captures the `@protocol(Name)` introspection
expression. Protocol types in variable and parameter declarations are handled by `objj_protocol_type`.

### Method declarations and definitions

```objj
- (void)setName:(CPString)aName age:(int)anAge;   // declaration (in protocol)
- (void)setName:(CPString)aName age:(int)anAge    // definition (in implementation)
{
    _name = aName;
}
```

`objj_method_declaration` (signature only, no body) and `objj_method_definition`
(signature plus body) share the same parameter structure: `objj_method_parameter_part`
captures each keyword-argument pair, and `objj_method_type` captures the return and parameter type annotations in parentheses. The leading `-` or `+` determines instance vs. class scope.

### Message expressions

```objj
[receiver doSomething]
[receiver setName:aName age:anAge]
[[CPArray alloc] initWithObjects:a, b, nil]
```

`objj_message_expression` is the Objective-J equivalent of a method call.
`objj_message_selector` holds either a unary selector or one or more keyword arguments (`objj_message_keyword_argument`). Nested message expressions are handled naturally by the recursive structure of `expression`.

### Selector expressions

```objj
@selector(doSomething:withArgument:)
```

`objj_selector_expression` captures selector literals used for target-action and `performSelector:` patterns. The selector name is decomposed into `objj_selector_name` and `objj_selector_identifier` components.

### Objective-J literals

```objj
@"a string"                    // objj_string_literal
@{ @"key": value }             // objj_dictionary_literal
@[ a, b, c ]                   // objj_array_literal
```

These are the Objective-J equivalents of JavaScript string literals, object literals, and array literals. They produce `CPString`, `CPDictionary`, and `CPArray` values respectively rather than JavaScript primitives. The rule `_objj_literal` is the supertype grouping all three.

`native_array` and `_bracket_expression` handle the syntactic overlap between subscript access (`a[i]`), JavaScript array literals, and Objective-J message expressions, which share the `[` character. The precedence and conflict resolution for these is non-trivial; see the `conflicts` section of the grammar.

### Type annotations

```objj
- (CPString)name
- (void)setName:(CPString)aName
CPString _name;
```

`objj_type` covers the full range of type positions: primitive C types
(`int`, `float`, `char`, etc.), Objective-J class types (`CPString`,
`CPArray`), `id`, `void`, and pointer forms. `objj_multi_word_type` handles multi-token type names such as `unsigned long` and `unsigned int`.
`objj_protocol_type` handles `id <Protocol>` qualified types.

### Globals and typedefs

```objj
@global MyGlobalFunction
typedef unsigned int CPUInteger;
```

`objj_global_declaration` marks a symbol as globally accessible across
compilation units. `objj_typedef` introduces a type alias, mirroring C typedef semantics.

### Preprocessor directives

```objj
#if PLATFORM(DOM)
...
#else
...
#endif
```

`preproc_if_block`, `preproc_if_line`, `preproc_else_line`,
`preproc_endif_line`, `preproc_condition`, and `preproc_directive` handle the preprocessor subset used in Cappuccino source. These mirror the C preprocessor forms used in the AppKit/Foundation headers. `preproc_ivar_if_block` handles the case where preprocessor conditionals appear inside an `@implementation` instance variable block, which requires distinct handling because the enclosing context is not a general statement context.

`system_lib_string` is the `<...>` token form used inside `@import` and
preprocessor include directives.

---

## Rule naming conventions

Rules follow a consistent naming scheme throughout the grammar.

Rules prefixed `objj_` are Objective-J constructs that have no JavaScript
counterpart. These are the rules most likely to require attention when the
Objective-J language changes.

Rules prefixed `preproc_` are preprocessor constructs. They are not part of the JavaScript layer and are not Objective-J object-model constructs; they belong to the textual preprocessing stage.

Rules prefixed with `_` (underscore) are **hidden rules** in tree-sitter
terminology. They participate in matching but do not appear as named nodes in the output syntax tree. They are structural conveniences — factored-out common sequences or alternatives — and are inlined into their call sites in the generated tree. Hiding a rule is appropriate when its presence in the tree would add noise without adding information. For example, `_objj_literal` is the supertype grouping `objj_string_literal`, `objj_dictionary_literal`, and `objj_array_literal`; a consumer cares about which literal it has, not that it matched the supertype.

Rules without either prefix are inherited from or parallel to the JavaScript grammar. Modifying them requires understanding the inheritance mechanism; changes that remove or rename inherited rules will break the JavaScript layer.

---

## Consumers of this grammar

The grammar is designed to serve multiple distinct consumers, each with
different requirements. The design constraint is that all consumers share one tree; there is no per-consumer variant of the grammar.

### Compiler (`objj2`)

The compiler traverses the CST to generate JavaScript output. It requires
accurate, complete trees for all Objective-J constructs and relies on named fields within rules to locate operands without positional fragility. Named fields are declared with the `field()` combinator in `grammar.js` and appear as named properties on tree nodes. When adding or modifying rules that the compiler consumes, check whether existing field names are depended upon.

### Editor syntax highlighting

Tree-sitter syntax highlighting is driven by **highlight queries** — pattern files that match node types and assign semantic scopes. The highlight queries for this grammar live in `queries/highlights.scm`. Node type names used in those queries must remain stable when rules are renamed. Renaming an `objj_`-prefixed rule requires updating the highlight queries.

### Linting

Static analysis tools consume the CST to identify patterns that are legal but inadvisable: missing `@end`, unused instance variables, selector mismatches, etc. Linters depend on the tree being accurate even for partially-written code, which requires that error recovery produce plausible partial trees. Tree-sitter's built-in error recovery handles most cases; rules that introduce deeply nested optional structure can degrade recovery quality.

### Documentation generation (Doxygen)

Doxygen support for Objective-J processes comment blocks attached to method declarations and definitions, class implementations, and instance variables.

The grammar preserves `comment` nodes (inherited from the JavaScript grammar) in positions where Doxygen expects them. The association between a doc comment and its subject node is made by proximity in the tree, so rules must not introduce anonymous intermediate nodes between a comment and the declaration it precedes.

---

## Working with the grammar as a non-specialist

Most maintenance tasks on this grammar do not require understanding parser
theory. The common cases are:

**Adding a new Objective-J keyword or attribute.** Find the rule that handles the surrounding construct (e.g., `objj_ivar_modifier` for a new ivar modifier) and add the new string literal to the appropriate `CHOICE`. Run `tree-sitter generate` and `tree-sitter test` to confirm no conflicts were introduced.

**Adding a new top-level statement form.** Add an `objj_`-prefixed rule for the new construct, then add a `SYMBOL` reference to it in the `statement` rule's `CHOICE` list. All the existing statement forms are examples to follow.

**A construct is being misclassified.** First check whether the issue is in the grammar or in the highlight/tag/injection queries. Run `tree-sitter parse` on a representative file and inspect the tree (`tree-sitter parse --cst file.j`). If the tree is wrong, the grammar needs changing. If the tree is correct but highlighting is wrong, the query file needs changing.

**Conflicts.** Tree-sitter will report conflicts when it cannot determine which rule applies based on the tokens seen so far. The `conflicts` array in the grammar lists known, intentional ambiguities that tree-sitter resolves by precedence. An unexpected new conflict means a new rule is ambiguous with an existing one. The most common cause in this grammar is a new construct that begins with `@`, `[`, or `(` — tokens shared with existing Objective-J and JavaScript constructs. Consult the `precedences` array to understand how the existing resolutions work before adding a new one.

**Do not modify inherited JavaScript rules** unless you understand the
inheritance mechanism thoroughly. The JavaScript rules are not present in
`grammar.js`; they exist in the upstream `tree-sitter-javascript` dependency and are merged at generation time. Overriding them is possible but should be treated as a last resort, documented explicitly, and kept to the minimum change necessary.

---

## Development workflow

### Prerequisites

- Node.js 24 or later
- `tree-sitter-cli` (`npm install -g tree-sitter-cli`)
- A C compiler (Apple Clang on macOS, GCC on Linux)

### Generate and test

```sh
# Regenerate the parser from grammar.js
tree-sitter generate

# Run the corpus tests
tree-sitter test

# Parse a specific file and print the tree
tree-sitter parse path/to/file.j

# Parse and show the full CST (including anonymous nodes)
tree-sitter parse --cst path/to/file.j
```

For extended development, use the independent `capp-parse` application with the `--debug` flag. The included scripts are for quick changes only. 

The corpus tests live in `test/corpus/`. Each test is a named example of
source text paired with its expected tree. When changing a rule, add or update corpus tests to cover the change. The tests are the executable specification of the grammar's intended behaviour.

### Validating against the Cappuccino corpus

Before a grammar change is merged, it should be validated against the full
AppKit and Foundation source in the Cappuccino repository. A script for this is provided in `scripts/validate-corpus.sh`. The separate `capp-parse` application implements a fluid workflow doing the same thing, optimized for extensive changes. Failures on previously-passing files are regressions and must be resolved before merging.

### Generated files

The files `src/parser.c`, `src/tree_sitter/parser.h`, and `grammar.json` are **generated artefacts**. They are committed to the repository so that
consumers can build without installing tree-sitter-cli, but they must never be edited by hand. Always edit `grammar.js` and regenerate.

`grammar.json` is the serialised form of the compiled grammar DSL. It is what downstream binding generators and language server integrations consume. It is the file from which the node type index (`src/node-types.json`) and the grammar schema are derived.

---

## Contributing

Contributions are welcome from the Cappuccino community. The bar for grammar changes is correctness against the full Cappuccino source corpus, not parser theory expertise. If a change passes `tree-sitter test` and passes the corpus validation script, it is almost certainly correct.

For changes to Objective-J constructs, the reference implementation is the
Cappuccino compiler itself. If the compiler accepts it, the grammar should
accept it. If there is disagreement, file an issue with a minimal reproducing example.

Please do not open pull requests that reformat `grammar.js` without a
corresponding behaviour change. The file structure is intentional and
maintained for readability.

---

## Relationship to upstream grammars

This grammar depends on
[tree-sitter-javascript](https://github.com/tree-sitter/tree-sitter-javascript) as its base. The JavaScript grammar version is pinned in `package.json`. When upgrading the JavaScript dependency, run the full corpus validation before releasing, as JavaScript grammar changes can alter inherited rule names or conflict resolution in ways that affect Objective-J constructs.

The grammar does not depend on, and should not be confused with, any
Objective-C tree-sitter grammar. Objective-J shares Objective-C's object model syntax (brackets, `@implementation`, `@protocol`, selectors, typed message expressions) but has JavaScript as its expression and statement language, not C. The type system is advisory rather than enforced, and there is no C preprocessor macro expansion at the grammar level — only the conditional inclusion forms used in Cappuccino's platform abstraction layer.

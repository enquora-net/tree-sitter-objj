# Changelog

Notable changes to the grammar, newest first.

Version numbers follow Cappuccino 2: the major version is the Cappuccino
version whose Objective-J the grammar covers, not a count of grammar releases.
Breaking changes to node types or field names are therefore announced here,
not by a change of major version.

## 2.0.0-beta.2 - 2026-10-28

The version moves from 1.0.0 to 2.0.0 because grammar
versions now follow Cappuccino 2: the major version is the Cappuccino version
whose Objective-J the grammar covers. The beta number continues from the first
release, which was published as `1.0.0-beta.1`.

The addition of embedded grammar version reporting requires tree-sitter 0.25 or later.
Third-party tooling using this grammar must use tree-sitter 0.25 or later, or a language binding built against it.
### Added

- The release version is compiled into the parser and reported by
  tree-sitter's standard `ts_language_metadata()`: 2.0.0 for this release.
- `tree_sitter_objj_version()` is exported, returning the release and the
  commit the library was built from, e.g. `2.0.0-beta.2+g<commit>`.
- `make build` builds the library for this machine only; `make build-all`
  builds all six platforms with their checksums.
- Install locations and search order for macOS, Linux and Windows are
  documented in the README.

### Changed

- The parser is generated with tree-sitter CLI 0.25 or later (language
  ABI 15).
- `make install-local` installs the library under the name the toolchain
  searches for: `libtree-sitter-objj.dylib` or `libtree-sitter-objj.so`.
- Libraries for the Cappuccino toolchain must be built with `make`;
  DEVELOPERS.md explains using the grammar with the standard tree-sitter
  tools.

### Fixed

- Native array single-element multiline parse failure
- Bare-colon (unnamed label) method parameters e.g. `functionWithControlPoints:(float)c1x :(float)c1y`
- Standalone scalar return types e.g. `- (long)longValue`
- Field definition semicolons are now optional to accommodate missing terminators
- GLR conflict for `computed_property_name` vs `native_array`

## 1.0.0-beta.1 - 2026-05-04

Initial release, published as `v1.0.0-beta.1`. Under the numbering described
above it is the first 2.0.0 beta.

Complete Objective-J grammar covering the full Cappuccino AppKit and Foundation
source corpus. Validated against all AppKit and Foundation source files. Node
semantics are considered stable but remain subject to change before the final
2.0.0 release.

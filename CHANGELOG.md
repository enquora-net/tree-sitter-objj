# Changelog

## 1.0.0-beta.1

Initial release.

Complete Objective-J grammar covering the full Cappuccino AppKit and Foundation
source corpus. Validated against all AppKit and Foundation source files. Node
semantics are considered stable but remain subject to change prior to 1.0.0.

## v1.0.0-beta.2

### Fixed

- Native array single-element multiline parse failure
- Bare-colon (unnamed label) method parameters e.g. `functionWithControlPoints:(float)c1x :(float)c1y`
- Standalone scalar return types e.g. `- (long)longValue`
- Field definition semicolons are now optional to accommodate missing terminators
- GLR conflict for `computed_property_name` vs `native_array`

/**
 * Build Version for Objective-J
 *
 * src/version.c
 * tree-sitter-objj
 *
 * Copyright (c) 2026 David Richardson.
 * Source code and compiled binaries are made available under the MIT License.
 * ============================================================================
 * Exports the build version for consumers that load the library at run time.
 * TS_OBJJ_VERSION is supplied by the Makefile: the first line of VERSION.txt,
 * plus "+g<commit>" when built from a git checkout, e.g. 2.0.0-beta.2+gabc123.
 *
 * The X.Y.Z part is also available through tree-sitter's standard
 * ts_language_metadata(), generated from tree-sitter.json.
 */

#ifndef TS_OBJJ_VERSION
#error "TS_OBJJ_VERSION is not defined; build with the Makefile"
#endif

#if defined(_WIN32)
#define TS_OBJJ_PUBLIC __declspec(dllexport)
#else
#define TS_OBJJ_PUBLIC __attribute__((visibility("default")))
#endif

TS_OBJJ_PUBLIC const char *tree_sitter_objj_version(void) {
  return TS_OBJJ_VERSION;
}

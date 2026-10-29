# ============================================================================
# tree-sitter-objj Build Orchestrator
# ============================================================================
# Cross-compilation via Zig. All targets buildable from any host.
# Primary output: platform-specific dynamic libraries in ./build/
#
#   make build          generate if needed, build the library for this host
#   make build-all      generate if needed, build all six platforms, checksums
#   make install-local  build and install the library for this host
#
# The parser is regenerated whenever grammar.js, tree-sitter.json or the
# inherited JavaScript grammar changes; libraries are rebuilt whenever their
# sources or the build version change.
# ============================================================================

ZIG      := zig cc
TS_CLI   := tree-sitter
NAME     := tree-sitter-objj
GRAMMAR_VERSION := $(shell head -1 VERSION.txt)
OUT_DIR  := ./build

# Build version compiled into the library (src/version.c):
# VERSION.txt plus the commit, when built from a git checkout
COMMIT        := $(shell git rev-parse --short=12 HEAD 2>/dev/null)
BUILD_VERSION := $(GRAMMAR_VERSION)$(if $(COMMIT),+g$(COMMIT))

# Compilation flags
CFLAGS   := -std=c99 -O3 -shared -fPIC -Isrc -Wall -Wextra \
	     -Wno-typedef-redefinition -Wno-unused-parameter \
	     -DTS_OBJJ_VERSION='"$(BUILD_VERSION)"'

# Sources: parser.c is generated; scanner.c and version.c are hand-written
SRCS     := src/parser.c src/scanner.c src/version.c

# Grammar inputs: parser.c is regenerated when any of these change
GRAMMAR_SRCS := grammar.js tree-sitter.json \
		$(wildcard node_modules/tree-sitter-javascript/grammar.js)

# Records the build version; touched only when it changes, so a new commit
# rebuilds the libraries even when no source has changed
BUILD_STAMP := $(OUT_DIR)/.build-version

# Libraries, one per platform
LIB_MACOS_ARM64   := $(OUT_DIR)/$(NAME)_macos_arm64_$(GRAMMAR_VERSION).dylib
LIB_MACOS_X64     := $(OUT_DIR)/$(NAME)_macos_x64_$(GRAMMAR_VERSION).dylib
LIB_LINUX_X64     := $(OUT_DIR)/$(NAME)_linux_x64_$(GRAMMAR_VERSION).so
LIB_LINUX_ARM64   := $(OUT_DIR)/$(NAME)_linux_arm64_$(GRAMMAR_VERSION).so
LIB_WINDOWS_X64   := $(OUT_DIR)/$(NAME)_windows_x64_$(GRAMMAR_VERSION).dll
LIB_WINDOWS_ARM64 := $(OUT_DIR)/$(NAME)_windows_arm64_$(GRAMMAR_VERSION).dll

ALL_LIBS := $(LIB_MACOS_ARM64) $(LIB_MACOS_X64) \
	    $(LIB_LINUX_X64) $(LIB_LINUX_ARM64) \
	    $(LIB_WINDOWS_X64) $(LIB_WINDOWS_ARM64)

# Host library: the library for this machine, and the name the toolchain
# searches for (see README, Install locations)
UNAME_S  := $(shell uname -s)
UNAME_M  := $(shell uname -m)
INSTALL_DIR := /usr/local/lib

ifeq ($(UNAME_S),Darwin)
HOST_LIB  := $(if $(filter arm64,$(UNAME_M)),$(LIB_MACOS_ARM64),$(LIB_MACOS_X64))
INSTALLED := $(INSTALL_DIR)/lib$(NAME).dylib
else ifeq ($(UNAME_S),Linux)
HOST_LIB  := $(if $(filter aarch64 arm64,$(UNAME_M)),$(LIB_LINUX_ARM64),$(LIB_LINUX_X64))
INSTALLED := $(INSTALL_DIR)/lib$(NAME).so
endif

.PHONY: all build build-all install-local uninstall-local clean generate \
	check-version checksums FORCE \
	macos-arm64 macos-x64 linux-x64 linux-arm64 windows-x64 windows-arm64

# Default: build all platforms
all: build-all

# Build the library for this host only
build:
ifdef HOST_LIB
build: $(HOST_LIB)
	@echo "Host library: $(HOST_LIB) ($(BUILD_VERSION))"
else
	@echo "error: unsupported host for build: $(UNAME_S)/$(UNAME_M)" >&2
	@exit 1
endif

# Build all platforms and emit checksums
build-all: checksums

# Install the library for this host to /usr/local/lib under the searched
# name, replacing any library already installed there
install-local:
ifdef INSTALLED
install-local: $(HOST_LIB)
	@install -m 755 $(HOST_LIB) $(INSTALLED)
	@echo "Installed: $(HOST_LIB) -> $(INSTALLED)"
else
	@echo "error: unsupported platform for install-local: $(UNAME_S)/$(UNAME_M)" >&2
	@exit 1
endif

uninstall-local:
ifdef INSTALLED
	@rm -f $(INSTALLED)
	@echo "Removed: $(INSTALLED)"
else
	@echo "error: unsupported platform for uninstall-local: $(UNAME_S)/$(UNAME_M)" >&2
	@exit 1
endif

# tree-sitter.json must match VERSION.txt: generate compiles its version into
# parser.c, where ts_language_metadata() reports it
check-version:
	@TS_VERSION=$$(sed -n 's/^ *"version": *"\([^"]*\)".*/\1/p' tree-sitter.json); \
	if [ "$$TS_VERSION" != "$(GRAMMAR_VERSION)" ]; then \
	    echo "error: tree-sitter.json version '$$TS_VERSION' does not match VERSION.txt '$(GRAMMAR_VERSION)'" >&2; \
	    echo "       run: $(TS_CLI) version $(GRAMMAR_VERSION)" >&2; \
	    exit 1; \
	fi

# --- Grammar ---
src/parser.c: $(GRAMMAR_SRCS) | check-version
	@echo "Generating parser sources..."
	@$(TS_CLI) generate

# Regenerate unconditionally
generate: check-version
	@echo "Generating parser sources..."
	@$(TS_CLI) generate

# Also creates OUT_DIR. (A rule for OUT_DIR itself would clash with the
# build target: make treats ./build and build as the same name.)
$(BUILD_STAMP): FORCE
	@mkdir -p $(OUT_DIR)
	@echo '$(BUILD_VERSION)' | cmp -s - $@ || echo '$(BUILD_VERSION)' > $@

FORCE:

LIB_DEPS := $(SRCS) $(BUILD_STAMP)

# --- macOS ---
macos-arm64: $(LIB_MACOS_ARM64)
$(LIB_MACOS_ARM64): $(LIB_DEPS)
	@echo "Building macOS arm64..."
	@$(ZIG) $(CFLAGS) -target aarch64-macos $(SRCS) -o $@

macos-x64: $(LIB_MACOS_X64)
$(LIB_MACOS_X64): $(LIB_DEPS)
	@echo "Building macOS x86_64..."
	@$(ZIG) $(CFLAGS) -target x86_64-macos $(SRCS) -o $@

# --- Linux (glibc 2.28 for broad distribution compatibility) ---
linux-x64: $(LIB_LINUX_X64)
$(LIB_LINUX_X64): $(LIB_DEPS)
	@echo "Building Linux x86_64..."
	@$(ZIG) $(CFLAGS) -target x86_64-linux-gnu.2.28 $(SRCS) -o $@

linux-arm64: $(LIB_LINUX_ARM64)
$(LIB_LINUX_ARM64): $(LIB_DEPS)
	@echo "Building Linux arm64..."
	@$(ZIG) $(CFLAGS) -target aarch64-linux-gnu.2.28 $(SRCS) -o $@

# --- Windows (Zig internalizes MinGW headers) ---
windows-x64: $(LIB_WINDOWS_X64)
$(LIB_WINDOWS_X64): $(LIB_DEPS)
	@echo "Building Windows x86_64..."
	@$(ZIG) $(CFLAGS) -target x86_64-windows $(SRCS) -o $@

windows-arm64: $(LIB_WINDOWS_ARM64)
$(LIB_WINDOWS_ARM64): $(LIB_DEPS)
	@echo "Building Windows arm64..."
	@$(ZIG) $(CFLAGS) -target aarch64-windows $(SRCS) -o $@

# SHA-256 checksum per library, named identically with .sha256 extension
checksums: $(ALL_LIBS)
	@echo "Computing checksums..."
	@for f in $(ALL_LIBS); do \
	    shasum -a 256 "$$f" | awk '{print $$1}' > "$$f.sha256" && \
	    echo "  $$f.sha256"; \
	done
	@echo "Done."

clean:
	@echo "Cleaning build artifacts..."
	@rm -rf $(OUT_DIR)
	@rm -f src/parser.c src/tree_sitter/parser.h

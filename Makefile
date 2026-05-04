# ============================================================================
# tree-sitter-objj Build Orchestrator
# ============================================================================
# Cross-compilation via Zig. All targets buildable from any host.
# Primary output: platform-specific dynamic libraries in ./build/
# ============================================================================

ZIG      := zig cc
TS_CLI   := tree-sitter
NAME     := tree-sitter-objj
VERSION  := $(shell head -1 version.txt)
OUT_DIR  := ./build

# Compilation flags
CFLAGS   := -std=c99 -O3 -shared -fPIC -Isrc -Wall -Wextra \
	     -Wno-typedef-redefinition -Wno-unused-parameter

# Sources: parser.c is generated; scanner.c is hand-written
SRCS     := src/parser.c src/scanner.c

# Detect local platform for install-local target
UNAME_S  := $(shell uname -s)
UNAME_M  := $(shell uname -m)
INSTALL_DIR := /usr/local/lib

.PHONY: all build-all install-local uninstall-local clean generate setup checksums \
	macos-arm64 macos-x64 linux-x64 linux-arm64 windows-x64 windows-arm64

# Default: generate and build all platforms
all: build-all

# Build all platforms and emit checksums
build-all: setup generate \
	   macos-arm64 macos-x64 \
	   linux-x64 linux-arm64 \
	   windows-x64 windows-arm64 \
	   checksums

# Install the appropriate library for the current host to /usr/local/lib
install-local: build-all
ifeq ($(UNAME_S),Darwin)
ifeq ($(UNAME_M),arm64)
	@install -m 755 $(OUT_DIR)/$(NAME)_macos_arm64_$(VERSION).dylib $(INSTALL_DIR)/
	@echo "Installed: $(INSTALL_DIR)/$(NAME)_macos_arm64_$(VERSION).dylib"
else
	@install -m 755 $(OUT_DIR)/$(NAME)_macos_x64_$(VERSION).dylib $(INSTALL_DIR)/
	@echo "Installed: $(INSTALL_DIR)/$(NAME)_macos_x64_$(VERSION).dylib"
endif
else ifeq ($(UNAME_S),Linux)
ifeq ($(UNAME_M),aarch64)
	@install -m 755 $(OUT_DIR)/$(NAME)_linux_arm64_$(VERSION).so $(INSTALL_DIR)/
	@echo "Installed: $(INSTALL_DIR)/$(NAME)_linux_arm64_$(VERSION).so"
else
	@install -m 755 $(OUT_DIR)/$(NAME)_linux_x64_$(VERSION).so $(INSTALL_DIR)/
	@echo "Installed: $(INSTALL_DIR)/$(NAME)_linux_x64_$(VERSION).so"
endif
else
	@echo "error: unsupported platform for install-local: $(UNAME_S)/$(UNAME_M)" >&2
	@exit 1
endif

uninstall-local:
ifeq ($(UNAME_S),Darwin)
ifeq ($(UNAME_M),arm64)
	@rm -f $(INSTALL_DIR)/$(NAME)_macos_arm64_$(VERSION).dylib
	@echo "Removed: $(INSTALL_DIR)/$(NAME)_macos_arm64_$(VERSION).dylib"
else
	@rm -f $(INSTALL_DIR)/$(NAME)_macos_x64_$(VERSION).dylib
	@echo "Removed: $(INSTALL_DIR)/$(NAME)_macos_x64_$(VERSION).dylib"
endif
else ifeq ($(UNAME_S),Linux)
ifeq ($(UNAME_M),aarch64)
	@rm -f $(INSTALL_DIR)/$(NAME)_linux_arm64_$(VERSION).so
	@echo "Removed: $(INSTALL_DIR)/$(NAME)_linux_arm64_$(VERSION).so"
else
	@rm -f $(INSTALL_DIR)/$(NAME)_linux_x64_$(VERSION).so
	@echo "Removed: $(INSTALL_DIR)/$(NAME)_linux_x64_$(VERSION).so"
endif
else
	@echo "error: unsupported platform for uninstall-local: $(UNAME_S)/$(UNAME_M)" >&2
	@exit 1
endif

setup:
	@mkdir -p $(OUT_DIR)

generate:
	@echo "Generating parser sources..."
	@$(TS_CLI) generate
	@echo "Done."

# --- macOS ---
macos-arm64: setup
	@echo "Building macOS arm64..."
	@$(ZIG) $(CFLAGS) -target aarch64-macos \
	    $(SRCS) -o $(OUT_DIR)/$(NAME)_macos_arm64_$(VERSION).dylib

macos-x64: setup
	@echo "Building macOS x86_64..."
	@$(ZIG) $(CFLAGS) -target x86_64-macos \
	    $(SRCS) -o $(OUT_DIR)/$(NAME)_macos_x64_$(VERSION).dylib

# --- Linux (glibc 2.28 for broad distribution compatibility) ---
linux-x64: setup
	@echo "Building Linux x86_64..."
	@$(ZIG) $(CFLAGS) -target x86_64-linux-gnu.2.28 \
	    $(SRCS) -o $(OUT_DIR)/$(NAME)_linux_x64_$(VERSION).so

linux-arm64: setup
	@echo "Building Linux arm64..."
	@$(ZIG) $(CFLAGS) -target aarch64-linux-gnu.2.28 \
	    $(SRCS) -o $(OUT_DIR)/$(NAME)_linux_arm64_$(VERSION).so

# --- Windows (Zig internalizes MinGW headers) ---
windows-x64: setup
	@echo "Building Windows x86_64..."
	@$(ZIG) $(CFLAGS) -target x86_64-windows \
	    $(SRCS) -o $(OUT_DIR)/$(NAME)_windows_x64_$(VERSION).dll

windows-arm64: setup
	@echo "Building Windows arm64..."
	@$(ZIG) $(CFLAGS) -target aarch64-windows \
	    $(SRCS) -o $(OUT_DIR)/$(NAME)_windows_arm64_$(VERSION).dll

# SHA-256 checksum per artifact, named identically with .sha256 extension
checksums:
	@echo "Computing checksums..."
	@cd $(OUT_DIR) && for f in *.dylib *.so *.dll; do \
	    [ -f "$$f" ] && shasum -a 256 "$$f" | awk '{print $$1}' > "$$f.sha256" && \
	    echo "  $$f.sha256"; \
	done || true
	@echo "Done."

clean:
	@echo "Cleaning build artifacts..."
	@rm -rf $(OUT_DIR)
	@rm -f src/parser.c src/tree_sitter/parser.h

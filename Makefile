# ============================================================================
# tree-sitter-objj Orchestrator
# ============================================================================
# Targets: macOS (Native), Linux, Windows (x64 and ARM64)
# Primary Toolchain: Zig (via 'zig cc' wrapper)
# ============================================================================

ZIG      := zig cc
TS_CLI   := tree-sitter
NAME     := tree-sitter-objj
OUT_DIR  := ./build

# Compilation Flags
# [span_1](start_span)Inherited c99 standard and optimization levels from existing workflow[span_1](end_span)
CFLAGS   := -std=c99 -O3 -shared -fPIC -Isrc -Wall -Wextra \
	    -Wno-typedef-redefinition -Wno-unused-parameter

# Sources
# [span_2](start_span)parser.c is generated; scanner.c is hand-written logic[span_2](end_span)
SRCS     := src/parser.c src/scanner.c

.PHONY: all clean generate setup \
	macos-arm64 macos-x64 linux-x64 linux-arm windows-x64 windows-arm

# Default target: builds local architecture + standard cross-targets
all: setup generate macos-arm64 macos-x64 linux-x64 windows-x64

setup:
	@echo "Preparing build directory..."
	@mkdir -p $(OUT_DIR)

generate:
	@echo "Generating parser sources with tree-sitter..."
	@$(TS_CLI) generate
	@echo "✅ Generated parser sources"

# --- macOS (Single Platform Binaries) ---
# Separated to simplify platform detection in the master application
macos-arm64: setup
	@echo "Building macOS ARM64 dylib..."
	@$(ZIG) $(CFLAGS) -target aarch64-macos $(SRCS) -o $(OUT_DIR)/$(NAME)_macos_arm64.dylib

macos-x64: setup
	@echo "Building macOS x86_64 dylib..."
	@$(ZIG) $(CFLAGS) -target x86_64-macos $(SRCS) -o $(OUT_DIR)/$(NAME)_macos_x64.dylib

# --- Linux ---
# Targeting glibc 2.28 for broad distribution compatibility
linux-x64: setup
	@echo "Building Linux x64 shared object..."
	@$(ZIG) $(CFLAGS) -target x86_64-linux-gnu.2.28 $(SRCS) -o $(OUT_DIR)/$(NAME)_linux_x64.so

linux-arm: setup
	@echo "Building Linux ARM64 shared object..."
	@$(ZIG) $(CFLAGS) -target aarch64-linux-gnu.2.28 $(SRCS) -o $(OUT_DIR)/$(NAME)_linux_arm64.so

# --- Windows ---
# Zig internalizes MinGW headers, eliminating external dependencies
windows-x64: setup
	@echo "Building Windows x64 DLL..."
	@$(ZIG) $(CFLAGS) -target x86_64-windows $(SRCS) -o $(OUT_DIR)/$(NAME)_x64.dll

windows-arm: setup
	@echo "Building Windows ARM64 DLL..."
	@$(ZIG) $(CFLAGS) -target aarch64-windows $(SRCS) -o $(OUT_DIR)/$(NAME)_arm64.dll

clean:
	@echo "Cleaning build artifacts..."
	@rm -rf $(OUT_DIR)
	@rm -f src/parser.c src/tree_sitter/parser.h

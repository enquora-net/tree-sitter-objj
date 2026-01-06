# ----------------------------
# Objective-J Tree-sitter grammar Makefile
# ----------------------------

NAME = tree-sitter-objj
BUILD_DIR = build
RELEASE_DIR = build
TARGET = $(BUILD_DIR)/$(NAME).dylib

# macOS universal build
ARCHS = arm64 x86_64
CFLAGS = -std=c99 -fPIC -O3 -Wall -Wextra -Wno-typedef-redefinition -Wno-unused-parameter
LDFLAGS = -Wl,-install_name,@rpath/$(NAME).dylib

SRC = src/parser.c
# Generated parser source files: parser.c, scanner.c if applicable
# Include scanner if present
ifeq ($(wildcard src/scanner.c), src/scanner.c)
    SRC += src/scanner.c
endif

# Default install prefix (system-wide)
PREFIX ?= /usr/local
LIBDIR = $(PREFIX)/lib/tree-sitter

# ----------------------------
# Targets
# ----------------------------

# Build: generate parser sources and build universal dylib
build:
	@echo "Generating parser sources with tree-sitter..."
	@tree-sitter generate
	@echo "✅ Generated parser sources"
	@mkdir -p $(BUILD_DIR) $(RELEASE_DIR)
	@echo "Building universal dylib for macOS ($(ARCHS))..."
	# Compile object files per architecture
	@for arch in $(ARCHS); do \
		for srcfile in $(SRC); do \
			objfile=$(BUILD_DIR)/$$(basename $$srcfile .c)_$$arch.o; \
			echo "  Compiling $$srcfile for $$arch -> $$objfile"; \
			clang $(CFLAGS) -arch $$arch -c $$srcfile -o $$objfile; \
		done; \
	done
	# Link universal dylib in a single command
	@clang -dynamiclib $(BUILD_DIR)/*.o -o $(TARGET) $(LDFLAGS)
	@echo "✅ Built universal dylib at $(TARGET)"

# Install the dylib to a stable system path
install: build
	@echo "Installing $(NAME) dylib to $(LIBDIR)..."
	@mkdir -p $(LIBDIR)
	@cp $(TARGET) $(LIBDIR)/
	@echo "✅ Installed $(LIBDIR)/$(NAME).dylib"

# Remove build artifacts
clean:
	@echo "Cleaning build directory..."
	@rm -rf $(BUILD_DIR)

# ----------------------------
# Phony targets
# ----------------------------
.PHONY: build install clean


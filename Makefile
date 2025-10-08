# ----------------------------
# Objective-J Tree-sitter grammar Makefile
# ----------------------------

NAME = tree-sitter-objj
BUILD_DIR = build
RELEASE_DIR = build
TARGET = $(BUILD_DIR)/$(NAME).dylib

# macOS universal build
ARCHS = arm64 x86_64
CFLAGS = -std=c99 -fPIC -O3 -Wall -Wextra
LDFLAGS = -dynamiclib -Wl,-install_name,@rpath/$(NAME).dylib

SRC = src/parser.c
# Include scanner if present
ifeq ($(wildcard src/scanner.c), src/scanner.c)
    SRC += src/scanner.c
endif

# Default install prefix (system-wide)
PREFIX ?= /opt/local
LIBDIR = $(PREFIX)/lib/tree-sitter

# ----------------------------
# Targets
# ----------------------------

# Default target: build the release dylib
all: release

# Build object files and universal fat dylib
build: $(TARGET)

# Build release version: clean + build
release: clean $(TARGET)
	@echo "✅ Release built at $(TARGET)"

# Rule to create the universal dylib
$(TARGET): $(SRC)
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
	@clang -dynamiclib $(foreach arch,$(ARCHS),$(BUILD_DIR)/*_$(arch).o) -o $(TARGET) $(LDFLAGS)
	@echo "✅ Built universal dylib at $(TARGET)"

# Install the release dylib to a stable system path
install: $(TARGET)
	@echo "Installing $(NAME) dylib to $(LIBDIR)..."
	@mkdir -p $(LIBDIR)
	@cp $(TARGET) $(LIBDIR)/
	@echo "✅ Installed $(LIBDIR)/$(NAME).dylib"

# Remove build and release artifacts
clean:
	@echo "Cleaning build and release directories..."
	@rm -rf $(BUILD_DIR) $(RELEASE_DIR)

# Remove installed dylib
uninstall:
	@echo "Removing installed $(NAME) dylib from $(LIBDIR)..."
	@rm -f $(LIBDIR)/$(NAME).dylib

# ----------------------------
# Phony targets
# ----------------------------
.PHONY: all build release install clean uninstall

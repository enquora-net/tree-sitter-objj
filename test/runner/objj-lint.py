#!/usr/bin/env python3
"""
Tree-sitter grammar test walker for Objective-J files.
Tests all .j files in a directory tree against a tree-sitter grammar.
"""

import argparse
import ctypes
import sys
from pathlib import Path
from typing import List, Optional, Tuple

from tree_sitter import Language, Parser


def find_grammar_library(language_name: str) -> Optional[Path]:
    """
    Search for a tree-sitter grammar library in standard macOS locations.

    Args:
        language_name: Name of the language (e.g., 'objj')

    Returns:
        Path to the dylib if found, None otherwise
    """
    # Standard macOS library search paths
    search_paths = [
        Path("/usr/local/lib/tree-sitter"),
        Path("/opt/local/lib/tree-sitter"),
        Path.home() / "Library/tree-sitter",
        Path("/Library/tree-sitter"),
    ]

    # Possible library names
    lib_names = [
        f"libtree-sitter-{language_name}.dylib",
        f"{language_name}.dylib",
    ]

    for search_path in search_paths:
        if search_path.exists():
            for lib_name in lib_names:
                lib_path = search_path / lib_name
                if lib_path.exists():
                    return lib_path

    return None


class GrammarTester:
    """Tests Objective-J files against a tree-sitter grammar."""

    def __init__(self, grammar_path: str, language_name: str):
        """
        Initialize the grammar tester.

        Args:
            grammar_path: Path to the compiled tree-sitter grammar (.dylib)
            language_name: Name of the language from grammar.js (e.g., 'objj')
        """
        # Load the language from the compiled grammar (tree-sitter 0.23+)
        # Load the shared library
        lib = ctypes.CDLL(grammar_path)

        # Get the language function - tree-sitter exports tree_sitter_<language_name>()
        language_func = getattr(lib, f"tree_sitter_{language_name}")
        language_func.restype = ctypes.c_void_p

        # Call the function to get the language pointer
        language_ptr = language_func()

        # Create the Language object from the pointer
        self.language = Language(language_ptr)

        # In 0.25.0+, Parser takes the language in its constructor
        self.parser = Parser(self.language)

        # Statistics
        self.files_tested = 0
        self.files_passed = 0
        self.files_failed = 0

    def has_errors(self, node) -> List[Tuple[int, int]]:
        """
        Recursively find all ERROR nodes in the parse tree.

        Args:
            node: The tree-sitter node to check

        Returns:
            List of (line, column) tuples for error positions
        """
        errors = []

        if node.type == "ERROR":
            start_point = node.start_point
            errors.append((start_point[0] + 1, start_point[1] + 1))  # 1-indexed

        for child in node.children:
            errors.extend(self.has_errors(child))

        return errors

    def test_file(self, file_path: Path) -> bool:
        """
        Test a single file against the grammar.

        Args:
            file_path: Path to the file to test

        Returns:
            True if parsing succeeded without errors, False otherwise
        """
        try:
            with open(file_path, "rb") as f:
                source_code = f.read()

            tree = self.parser.parse(source_code)
            errors = self.has_errors(tree.root_node)

            if errors:
                print(f"\n{file_path}")
                for line, col in errors:
                    print(f"  {line}:{col}")
                return False
            else:
                # Silent on success
                return True

        except Exception as e:
            print(f"\n{file_path}")
            print(f"  ERROR: {e}")
            return False

    def test_path(self, path: Path, extensions: List[str]):
        """
        Test a file or recursively test all files in a directory.

        Args:
            path: Path to file or directory to test
            extensions: List of file extensions to test (e.g., ['.j'])
        """
        if path.is_file():
            if path.suffix in extensions:
                self.files_tested += 1
                if self.test_file(path):
                    self.files_passed += 1
                else:
                    self.files_failed += 1

        elif path.is_dir():
            # Walk the directory tree
            for entry in sorted(path.rglob("*")):
                if entry.is_file() and entry.suffix in extensions:
                    self.files_tested += 1
                    if self.test_file(entry):
                        self.files_passed += 1
                    else:
                        self.files_failed += 1

        else:
            print(f"⚠ Path does not exist: {path}")

    def print_summary(self):
        """Print testing summary statistics."""
        if self.files_failed > 0:
            print("\n" + "=" * 70)
            print("SUMMARY")
            print("=" * 70)
            print(f"Files tested:  {self.files_tested}")
            print(f"Files failed:  {self.files_failed}")

            if self.files_tested > 0:
                fail_rate = (self.files_failed / self.files_tested) * 100
                print(f"Failure rate:  {fail_rate:.1f}%")
        else:
            print("\nAll files parsed successfully.")


def main():
    parser = argparse.ArgumentParser(
        description="Test Objective-J files against a tree-sitter grammar",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Auto-search for grammar, test current directory
  %(prog)s

  # Auto-search, test specific directory
  %(prog)s ./Cappuccino/

  # Specify grammar location explicitly
  %(prog)s --grammar /usr/local/lib/tree-sitter/libtree-sitter-objj.dylib

  # Test specific file
  %(prog)s --grammar ./parser.dylib MyFile.j

  # Custom language name
  %(prog)s --lang objj --grammar ./parser.dylib
        """,
    )

    parser.add_argument(
        "path",
        nargs="?",
        default=".",
        help="File or directory to test (default: current directory)",
    )

    parser.add_argument(
        "--grammar",
        "-g",
        help="Path to the compiled tree-sitter grammar (.dylib). If not provided, searches standard locations.",
    )

    parser.add_argument(
        "--lang",
        "-l",
        default="objj",
        help="Language name from grammar.js (default: objj)",
    )

    parser.add_argument(
        "--ext",
        action="append",
        help="File extension(s) to test (default: .j). Can be specified multiple times.",
    )

    args = parser.parse_args()

    language_name = args.lang

    # Determine grammar path
    if args.grammar:
        grammar_path = Path(args.grammar)
        if not grammar_path.exists():
            print(f"Error: Grammar file not found: {grammar_path}", file=sys.stderr)
            sys.exit(1)
    else:
        # Search standard locations
        print(
            f"Searching for '{language_name}' grammar in standard locations...",
            file=sys.stderr,
        )
        grammar_path = find_grammar_library(language_name)
        if grammar_path is None:
            print(
                f"Error: Could not find grammar for '{language_name}'", file=sys.stderr
            )
            print(f"\nSearched locations:", file=sys.stderr)
            print(f"  /usr/local/lib/tree-sitter/", file=sys.stderr)
            print(f"  /opt/local/lib/tree-sitter/", file=sys.stderr)
            print(f"  ~/Library/tree-sitter/", file=sys.stderr)
            print(f"  /Library/tree-sitter/", file=sys.stderr)
            print(f"\nSpecify the grammar path with --grammar", file=sys.stderr)
            sys.exit(1)
        print(f"Found grammar: {grammar_path}", file=sys.stderr)

    # Validate target path
    test_path = Path(args.path)
    if not test_path.exists():
        print(f"Error: Path not found: {test_path}", file=sys.stderr)
        sys.exit(1)

    # Initialize tester
    extensions = args.ext if args.ext else [".j"]
    tester = GrammarTester(str(grammar_path), language_name)

    print(f"Testing with grammar: {grammar_path}")
    print(f"Language: {language_name}")
    print(f"Target path: {test_path}")
    print(f"File extensions: {', '.join(extensions)}")
    print("=" * 70)

    # Run tests
    tester.test_path(test_path, extensions)

    # Print summary
    tester.print_summary()

    # Exit with appropriate code
    sys.exit(0 if tester.files_failed == 0 else 1)


if __name__ == "__main__":
    main()

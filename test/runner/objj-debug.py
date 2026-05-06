#!/usr/bin/env python3
"""
Tree-sitter parse tree debugger for Objective-J files.
Stops at first error and displays full parse tree context.
"""

from    pathlib      import  Path
from    tree_sitter  import  Language, Parser
from    typing       import  Optional, Tuple

import  argparse
import  ctypes
import  shlex
import  subprocess
import  sys


def find_grammar_library(language_name: str) -> Optional[Path]:
    """
    Search for a tree-sitter grammar library in standard macOS locations.

    Args:
        language_name: Name of the language (e.g., 'objj')

    Returns:
        Path to the dylib if found, None otherwise
    """
    search_paths = [
        Path("/usr/local/lib/tree-sitter"),
        Path("/opt/local/lib/tree-sitter"),
        Path.home() / "Library/tree-sitter",
        Path("/Library/tree-sitter"),
    ]

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


class ParseTreeDebugger:
    """Debug Objective-J files with detailed parse tree inspection."""

    def __init__(self, grammar_path: str, language_name: str):
        """
        Initialize the debugger.

        Args:
            grammar_path: Path to the compiled tree-sitter grammar (.dylib)
            language_name: Name of the language from grammar.js (e.g., 'objj')
        """
        lib = ctypes.CDLL(grammar_path)
        language_func = getattr(lib, f"tree_sitter_{language_name}")
        language_func.restype = ctypes.c_void_p
        language_ptr = language_func()
        self.language = Language(language_ptr)
        self.parser = Parser(self.language)
        self.source_lines = []

    def find_first_error(self, node) -> Optional[Tuple]:
        """
        Find the first ERROR node in the parse tree (depth-first).

        Args:
            node: The tree-sitter node to check

        Returns:
            Tuple of (error_node, parent_chain) or None
        """
        if node.type == "ERROR":
            return (node, [])

        for child in node.children:
            result = self.find_first_error(child)
            if result:
                error_node, parent_chain = result
                parent_chain.insert(0, node)
                return (error_node, parent_chain)

        return None

    def format_node(self, node, indent=0, show_text=True) -> str:
        """
        Format a node as an S-expression with optional source text.
        Line numbers shown only for ERROR nodes.

        Args:
            node: The tree-sitter node to format
            indent: Current indentation level
            show_text: Whether to show source text for leaf nodes

        Returns:
            Formatted string representation
        """
        prefix = "  " * indent
        node_type = node.type
        is_error = node_type == "ERROR"

        # Mark ERROR nodes and include location
        if is_error:
            start = node.start_point
            end = node.end_point
            location = f" [{start[0] + 1}:{start[1] + 1}-{end[0] + 1}:{end[1] + 1}]"
            node_type = f"❌ ERROR{location}"

        # Leaf node
        if len(node.children) == 0:
            if show_text and node.text and not is_error:
                text = node.text.decode("utf-8", errors="replace")
                # Truncate long text
                if len(text) > 50:
                    text = text[:47] + "..."
                # Escape newlines and tabs
                text = text.replace("\n", "\\n").replace("\t", "\\t")
                return f'{prefix}({node_type} "{text}")'
            else:
                return f"{prefix}({node_type})"

        # Parent node
        result = [f"{prefix}({node_type}"]
        for child in node.children:
            result.append(self.format_node(child, indent + 1, show_text))
        result.append(f"{prefix})")
        return "\n".join(result)

    def show_source_context(self, node, context_lines=3):
        """
        Display source code context around a node.

        Args:
            node: The node to show context for
            context_lines: Number of lines before/after to show
        """
        start_line = node.start_point[0]
        end_line = node.end_point[0]

        # Calculate context window
        first_line = max(0, start_line - context_lines)
        last_line = min(len(self.source_lines) - 1, end_line + context_lines)

        print("\n" + "─" * 70)
        print("SOURCE CONTEXT")
        print("─" * 70)

        for i in range(first_line, last_line + 1):
            line_num = i + 1
            line_text = self.source_lines[i].rstrip()

            # Mark error lines
            if start_line <= i <= end_line:
                marker = ">>>"
                print(f"{marker} {line_num:4d} | {line_text}")

                # Show column marker for single-line errors
                if start_line == end_line:
                    col = node.start_point[1]
                    width = node.end_point[1] - col
                    pointer = " " * (len(marker) + 7 + col) + "^" * max(1, width)
                    print(pointer)
            else:
                print(f"    {line_num:4d} | {line_text}")

    def show_parent_chain(self, parent_chain):
        """
        Display the chain of parent nodes leading to an error.

        Args:
            parent_chain: List of parent nodes from root to error parent
        """
        if not parent_chain:
            return

        print("\n" + "─" * 70)
        print("PARENT CONTEXT")
        print("─" * 70)

        for i, node in enumerate(parent_chain):
            indent = "  " * i
            start = node.start_point
            print(f"{indent}↓ {node.type} at {start[0] + 1}:{start[1] + 1}")

    def print_error_summary(self, error_node, parent_chain):
        print(f"\n{'═' * 70}")
        print("ERROR SUMMARY")
        print(f"{'═' * 70}")
        print(f"Type: {error_node.type}")
        start_row = error_node.start_point[0] + 1
        start_col = error_node.start_point[1] + 1
        end_row = error_node.end_point[0] + 1
        end_col = error_node.end_point[1] + 1
        if start_row == end_row:
            print(f"Position: line {start_row}, cols {start_col}-{end_col}")
        else:
            print(f"Position: line {start_row}, col {start_col} to line {end_row}, col {end_col}")
        print(f"Text: {error_node.text}")
        print(f"Parent chain length: {len(parent_chain)}")

    def debug_file(self, file_path: Path):
        """
        Debug a single file, showing full CST if errors found.

        Args:
            file_path: Path to the file to debug

        Returns:
            True if parsing succeeded, False if errors found
        """
        try:
            with open(file_path, "rb") as f:
                source_code = f.read()

            # Store source lines for context display
            self.source_lines = source_code.decode(
                "utf-8", errors="replace"
            ).splitlines()

            tree = self.parser.parse(source_code)

            # Check for errors
            error_result = self.find_first_error(tree.root_node)

            if error_result:
                error_node, parent_chain = error_result

                print("\nDEBUG: Found error node. Opening file in Xcode and printing CST...")

                open_file_with_default_app(file_path, error_node.start_point.row)

                print(f"\n{'═' * 70}")
                print(f"PARSE ERROR in {file_path}")
                print(f"{'═' * 70}")
                print(
                    f"First error at line {error_node.start_point[0] + 1}, column {error_node.start_point[1] + 1}"
                )
                print(f"Total lines: {len(self.source_lines)}")

                # Show full CST with ERROR nodes marked
                print("\n" + "─" * 70)
                print("FULL CONCRETE SYNTAX TREE")
                print("─" * 70)
                print(self.format_node(tree.root_node, show_text=False))

                # Repeat concise error summary at the end for convenience
                self.print_error_summary(error_node, parent_chain)

                return False

            else:
                # No errors - silent success
                return True

        except Exception as e:
            print(f"\n{'═' * 70}")
            print(f"EXCEPTION in {file_path}")
            print(f"{'═' * 70}")
            print(f"ERROR: {e}")
            import traceback

            traceback.print_exc()
            return False


def open_file_with_default_app(filepath, line_number):
    """
    Open a file in Xcode at the given line number.
    """
    filepath = Path(filepath).expanduser().resolve()

    try:
        # Xcode expects 1-based line numbers; clamp to minimum of 1
        one_based_line = max(1, int(line_number) + 1)
        subprocess.run(
            ["xed", "--line", str(one_based_line), str(filepath)],
            check=True
        )
        print(f"Opened {filepath} at line {one_based_line}")

    except FileNotFoundError:
        print("Error: 'xed' not found. Is Xcode installed and on your PATH?")
    except subprocess.CalledProcessError as e:
        print(f"Error opening file in Xcode: {e}")

def main():
    parser = argparse.ArgumentParser(
        description="Debug Objective-J files with parse tree inspection",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Debug a specific file (shows full CST if error found)
  %(prog)s MyFile.j

  # Specify grammar location
  %(prog)s --grammar /usr/local/lib/tree-sitter/libtree-sitter-objj.dylib MyFile.j

  # Test directory (stops at first error, shows full CST)
  %(prog)s test/corpus/AppKit/
        """,
    )

    parser.add_argument(
        "path",
        help="File or directory to debug",
    )

    parser.add_argument(
        "--grammar",
        "-g",
        help="Path to the compiled tree-sitter grammar (.dylib)",
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

    # Validate target path
    test_path = Path(args.path)
    if not test_path.exists():
        print(f"Error: Path not found: {test_path}", file=sys.stderr)
        sys.exit(1)

    # Initialize debugger
    extensions = args.ext if args.ext else [".j"]
    debugger = ParseTreeDebugger(str(grammar_path), language_name)

    # Process path
    if test_path.is_file():
        success = debugger.debug_file(test_path)
        sys.exit(0 if success else 1)

    elif test_path.is_dir():
        # Test directory - stop at first error
        for entry in sorted(test_path.rglob("*")):
            if entry.is_file() and entry.suffix in extensions:
                if not debugger.debug_file(entry):
                    # Found first error - stop here
                    sys.exit(1)

        # All files passed
        print(f"\n✅ All files in {test_path} parsed successfully")
        sys.exit(0)

    else:
        print(f"Error: Invalid path: {test_path}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()


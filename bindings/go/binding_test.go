package tree_sitter_objj_test

import (
	"testing"

	tree_sitter "github.com/tree-sitter/go-tree-sitter"
	tree_sitter_objj "github.com/tree-sitter/tree-sitter-objj/bindings/go"
)

func TestCanLoadGrammar(t *testing.T) {
	language := tree_sitter.NewLanguage(tree_sitter_objj.Language())
	if language == nil {
		t.Errorf("Error loading Objective-J grammar")
	}
}

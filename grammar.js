/**
 * @file A Javascript superset with support for classes and message passing
 * @author David Richardson <david.richardson@enquora.com>
 * @license MIT
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

module.exports = grammar({
  name: "objj",

  rules: {
    // TODO: add the actual grammar rules
    source_file: $ => "hello"
  }
});

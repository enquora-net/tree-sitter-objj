/**
 * @file A Javascript superset with support for classes and message passing
 * @author David Richardson <david.richardson@enquora.com>
 * @license LGPL v2.1
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

const JAVASCRIPT = require("tree-sitter-javascript/grammar.js");

module.exports = grammar(JAVASCRIPT, {
  name: "objj",

  extras: $ => [
    // Whitespace and line endings
    /\u00A0|\s|\\\r?\n/,
    $.comment
  ],

  rules: {
    // TODO: add the actual grammar rules
  }
});

/**
 * @file A Javascript superset with support for classes and message passing
 * @author David Richardson <david.richardson@enquora.com>
 * @license LGPL v2.1
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

const JAVASCRIPT = require("tree-sitter-javascript/grammar.js");

// -----------------------------------------------------------------------------
// Reserved words for Objective-J
// -----------------------------------------------------------------------------
const reserved_words = {
  classKeywords: [
    '@interface',
    '@implementation',
    '@end',
    '@protocol',
    '@compatibility_alias'
  ],

  memberKeywords: [
    '+',      // class method
    '-',      // instance method
    '@property',
    '@synthesize',
    '@dynamic',
    '@optional',
    '@required',
    '@public',
    '@protected',
    '@private',
    '@package'
  ],

  expressionKeywords: [
    '@selector',
    '^',      // block literal
    'self',
    'super',
    'id',
    'BOOL',
    'IMP',
    'SEL',
    'Class'
  ],

  compilerKeywords: [
    '__unused',
    '__weak',
    '__strong',
    'nullable',
    'nonnull',
    'NS_AVAILABLE',
    'NS_DEPRECATED',
    'API_AVAILABLE',
    'API_DEPRECATED'
  ]
};

module.exports = grammar(JAVASCRIPT, {
  name: "objj",

  extras: $ => [
    // Whitespace and line endings
    /\u00A0|\s|\\\r?\n/,
    $.comment
  ],

  rules: {
    // Make @import a valid statement (and thus valid at the top level)
    statement: ($, original) => choice(
      original,
      $.objj_import
    ),

    // Objective-J imports:
    //   @import <Foundation/CPBundle.j>
    //   @import "CPApplication_Constants.j"
    //
    // Note: Do NOT consume an optional semicolon here. If present in source,
    // it will be parsed as a separate empty statement by the JS grammar.
    // This avoids an ambiguity with empty statements.
    objj_import: $ => prec.dynamic(100, seq(
      '@import',
      field('path', choice(
        $.system_lib_string, // <...>
        $.string             // "..." or '...'
      ))
    )),

    // Single token for angle-bracket system-style import path
    system_lib_string: $ => token(seq(
      '<',
      /[A-Za-z0-9_\/.\-]+/,
      '>'
    )),

    // Suppress decorators to avoid conflicts with @import
    decorator: $ => choice(),

    // Suppress JSX entirely in this dialect
    jsx_element: $ => choice(),
    jsx_fragment: $ => choice(),
    jsx_self_closing_element: $ => choice(),
    jsx_opening_element: $ => choice(),
    jsx_closing_element: $ => choice(),
    jsx_attribute: $ => choice(),
    jsx_expression: $ => choice(),
    jsx_text: $ => choice(),
  }
});

// -----------------------------------------------------------------------------
// Helper: flatten arbitrarily nested reserved words object or array
// (Not currently wired into the grammar; kept here for future identifier work.)
// -----------------------------------------------------------------------------
function flattenReserved(obj) {
  const result = [];

  function walk(node) {
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
    } else if (typeof node === 'object' && node !== null) {
      for (const key of Object.keys(node)) walk(node[key]);
    } else if (typeof node === 'string') {
      result.push(node);
    } else {
      throw new Error('Unexpected reserved entry: ' + node);
    }
  }

  walk(obj);
  return result;
}

// If you later want to use the flattened list for identifiers, you can:
// const reserved_words_flattened = flattenReserved(reserved_words);

//MARK: - Comma separators
function commaSep (rule) {
  return optional(commaSep1(rule));
}

function commaSep1(rule) {
  return seq(rule, repeat(seq(',', rule)));
}

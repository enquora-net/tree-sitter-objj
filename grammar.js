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
//
// These words cannot be used as identifiers. We maintain them as a nested,
// human-readable structure (classKeywords, memberKeywords, etc.) for
// maintainability and as an aide-mémoire during development.
//
// Tree-sitter’s DSL also defines a top-level `reserved` property, which must
// return a flat array of strings. We do not use it here directly because:
//   1. It cannot represent nested categories.
//   2. Each property must be a function returning an array, which complicates
//      incremental grammar development.
//   3. It is inflexible for large grammars.
//
// Instead, we flatten the nested structure via `flattenReserved()` when
// generating the identifier token. This preserves semantic organization for
// humans while satisfying the lexer’s need for a flat list of reserved words.
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
    // TODO: add the actual grammar rules
  }
});

//MARK: - Comma separators
function commaSep (rule) {
  return optional(commaSep1(rule));
}

function commaSep1(rule) {
  return seq(rule, repeat(seq(',', rule)));
}

// -----------------------------------------------------------------------------
// Helper: flatten arbitrarily nested reserved words object or array
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

// -----------------------------------------------------------------------------
// Flatten for identifier token
// -----------------------------------------------------------------------------
const reserved_words_flattened = flattenReserved(reserved_words);

// -----------------------------------------------------------------------------
// Identifier rule using flattened reserved words
// -----------------------------------------------------------------------------
identifier: _ => token(prec(-1, new RegExp(
  "(?!${reservedFlat.join('\\b|')}\\b)[_$a-zA-Z][_$a-zA-Z0-9]*"
)));

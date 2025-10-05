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

  // Help the parser disambiguate “[ … ]” between arrays and ObjJ messages
  conflicts: ($, original) => original.concat([
    [$.objj_message_expression, $.array],
  ]),

  rules: {
    // Make Objective-J forms valid statements (and thus valid at the top level)
    statement: ($, original) => choice(
      original,
      $.objj_import,
      $.objj_typedef,
      $.objj_protocol_declaration,
      $.objj_class_implementation
    ),

    // Extend expressions to support Objective-J constructs
    primary_expression: ($, original) => choice(
      original,
      $.objj_string_literal,
      $.objj_message_expression
    ),

    // Objective-J imports:
    //   @import <Foundation/CPBundle.j>
    //   @import "CPApplication_Constants.j"
    //
    // Note: Do NOT consume an optional semicolon here. If present in source,
    // it will be parsed as a separate empty statement by the JS grammar.
    objj_import: $ => prec.dynamic(100, seq(
      '@import',
      field('path', choice(
        $.system_lib_string, // <...>
        $.string             // "..." or '...'
      ))
    )),

    // Objective-J typedef:
    //   @typedef CPModalSession
    //
    // Also do not consume a trailing semicolon to avoid ambiguity.
    objj_typedef: $ => seq(
      '@typedef',
      field('name', $.identifier)
    ),

    // Objective-J protocol declaration:
    //   @protocol CPApplicationDelegate <CPObject>
    //     @optional
    //     - (ReturnType)name:(ParamType)param;
    //     ...
    //   @end
    //
    // Body accepts @optional/@required directives and method declarations.
    objj_protocol_declaration: $ => seq(
      '@protocol',
      field('name', $.identifier),
      optional(field('protocols', $.objj_protocol_reference_list)),
      repeat(choice(
        '@optional',
        '@required',
        $.objj_method_declaration
      )),
      '@end'
    ),

    objj_protocol_reference_list: $ => seq(
      '<',
      commaSep1($.identifier),
      '>'
    ),

    // Objective-J class implementation:
    //   @implementation ClassName : Superclass
    //   { ... ivars ... }
    //   ... methods ...
    //   @end
    objj_class_implementation: $ => seq(
      '@implementation',
      field('name', $.identifier),
      optional(seq(':', field('superclass', $.identifier))),
      optional($.objj_instance_variables),
      repeat($.objj_implementation_member),
      '@end'
    ),

    objj_instance_variables: $ => seq(
      '{',
      repeat($.objj_instance_variable),
      '}'
    ),

    objj_instance_variable: $ => choice(
      $.objj_visibility_specifier,
      $.objj_field_definition
    ),

    objj_visibility_specifier: _ => choice(
      '@private',
      '@protected',
      '@package',
      '@public'
    ),

    objj_field_definition: $ => seq(
      field('type', $.objj_type),
      field('name', $.identifier),
      optional(field('accessors', $.objj_accessors_directive)),
      ';'
    ),

    // Liberal type rule: simple identifier or protocol-qualified type
    objj_type: $ => choice(
      $.identifier,
      $.objj_protocol_type
    ),

    objj_protocol_type: $ => seq(
      $.identifier,
      $.objj_protocol_reference_list
    ),

    objj_accessors_directive: $ => seq(
      '@accessors',
      '(',
      commaSep1($.objj_accessor_attribute),
      ')'
    ),

    objj_accessor_attribute: $ => choice(
      // property=themeBlend, getter=name, setter=name
      seq($.identifier, '=', $.identifier),
      // standalone attributes if needed
      $.identifier
    ),

    // Implementation members: for now, support method definitions.
    objj_implementation_member: $ => choice(
      $.objj_method_definition
    ),

    // Objective-J boxed string literal: @"..."
    objj_string_literal: $ => seq(
      '@',
      $.string
    ),

    // Objective-J method declaration (interface/protocol form)
    //   - (ReturnType)method;
    //   - (ReturnType)name:(ParamType)param;
    //   - (ReturnType)name:(ParamType)param other:(ParamType)otherParam;
    objj_method_declaration: $ => seq(
      field('scope', choice('+', '-')),
      optional(field('return_type', $.objj_method_type)),
      field('selector', $.objj_method_selector),
      ';'
    ),

    // Objective-J method definition (implementation form)
    //   - (ReturnType)name:(ParamType)param { ... }
    objj_method_definition: $ => seq(
      field('scope', choice('+', '-')),
      optional(field('return_type', $.objj_method_type)),
      field('selector', $.objj_method_selector),
      field('body', $.statement_block)
    ),

    objj_method_type: $ => seq(
      '(',
      // Keep this liberal for now: identifiers or 'void' are typical here.
      field('type', choice($.identifier, 'void')),
      ')'
    ),

    objj_method_selector: $ => choice(
      // Unary selector: - (ReturnType)name;
      $.identifier,
      // Keyword selector: one or more keyword parts
      repeat1($.objj_keyword_declarator)
    ),

    objj_keyword_declarator: $ => seq(
      field('keyword', $.identifier),
      ':',
      optional(field('param_type', $.objj_method_type)),
      field('param_name', $.identifier)
    ),

    // Objective-J message expression:
    //   [ receiver selector ]
    // Examples:
    //   [self init]
    //   [[self alloc] init]
    //   [obj setValue:val forKey:key]
    objj_message_expression: $ => seq(
      '[',
      field('receiver', $.expression),
      field('selector', $.objj_message_selector),
      ']'
    ),

    objj_message_selector: $ => choice(
      // Unary selector
      $.identifier,
      // Keyword selector with one or more parts
      repeat1($.objj_message_keyword_argument)
    ),

    objj_message_keyword_argument: $ => seq(
      field('keyword', $.identifier),
      ':',
      field('argument', $.expression)
    ),

    // Single token for angle-bracket system-style import path
    system_lib_string: $ => token(seq(
      '<',
      /[A-Za-z0-9_\/.\-]+/,
      '>'
    )),

    // Suppress decorators to avoid conflicts with @-prefixed constructs
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

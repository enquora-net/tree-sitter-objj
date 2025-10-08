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

  externals: $ => [
    $._automatic_semicolon,
    $._template_chars,
    $._ternary_qmark,
    $.html_comment,
    '||',
    // We use escape sequence and regex pattern to tell the scanner if we're currently inside a string or template string, in which case
    // it should NOT parse html comments.
    $.escape_sequence,
    $.regex_pattern,
    $.jsx_text,
  ],

  extras: $ => [
    // Whitespace and line endings
    /\u00A0|\s|\\\r?\n/,
    $.comment
  ],

  // Help the parser disambiguate “[ … ]” between arrays and ObjJ messages
  conflicts: ($, original) => original.concat([
    [$.objj_message_expression, $.array],
    [$.statement, $.preproc_if_block],
    [$.binary_expression, $.objj_message_keyword_argument],
    [$.primary_expression, $.function_expression, $.generator_function],
  ]),

  rules: {
    // Make Objective-J forms valid statements (and thus valid at the top level)
    statement: ($, original) => choice(
      original,
      $.objj_import,
      $.objj_global_declaration,
      $.objj_class_forward_declaration,
      $.objj_typedef,
      $.objj_protocol_declaration,
      $.objj_class_implementation,
      $.preproc_if_block,
      $.preproc_directive
    ),

    // Extend expressions to support Objective-J constructs
    primary_expression: ($, original) => choice(
      original,
      $.objj_string_literal,
      $.objj_dictionary_literal,
      $.objj_array_literal,
      $.objj_message_expression,
      $.objj_selector_expression
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

    // Objective-J global declaration:
    //   @global document
    objj_global_declaration: $ => seq(
      '@global',
      field('name', $.identifier)
    ),

    // Objective-J @class forward declaration:
    //   @class CPFontPanel
    objj_class_forward_declaration: $ => seq(
      '@class',
      field('name', $.identifier)
    ),

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
    objj_class_implementation: $ => prec.right(1, seq(
      '@implementation',
      field('name', $.identifier),
      // Accept either a superclass or a category/extension in parentheses
      optional(choice(
        seq(':', field('superclass', $.identifier)),
        seq('(', optional($.identifier), ')')
      )),
      optional($.objj_instance_variables),
      repeat($.objj_implementation_member),
      '@end'
    )),

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
    // Liberal type rule: simple identifier, protocol-qualified type, or multi-word C types
    objj_type: $ => choice(
      $.objj_protocol_type,
      $.objj_multi_word_type,
      $.identifier
    ),

    // Support for multi-word C types like "unsigned int", "long long", etc.
    objj_multi_word_type: $ => choice(
      seq('unsigned', choice('char', 'short', 'int', 'long')),
      seq('signed', choice('char', 'short', 'int', 'long')),
      seq('long', 'long'),
      seq('long', 'double'),
      seq('unsigned', 'long', 'long'),

      // new single-word forms
      'unsigned',
      'signed',
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

    // Allow accessor attribute names like getter=isMultiple and setter=setMultiple:
    // The right-hand side can be a plain identifier or a selector-like name with colons.
    objj_accessor_attribute: $ => choice(
      seq($.identifier, '=', $.objj_accessor_name),
      // standalone attributes if needed
      $.identifier
    ),

    // Accept:
    // - identifier
    // - identifier ':' (e.g., setMultiple:)
    // - identifier ':' identifier ':' ... (e.g., setValue:forKey:)
    objj_accessor_name: $ => choice(
      $.identifier,
      seq($.identifier, repeat1(seq(':', $.identifier)), ':'),
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

    // Objective-J boxed dictionary literal: @{ key: value, ... }
    objj_dictionary_literal: $ => seq(
      '@',
      $.object
    ),

    // Objective-J boxed array literal: @[ item1, item2, ... ]
    objj_array_literal: $ => seq(
      '@',
      $.array
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
      // Allow ObjJ types here, including protocol-qualified ones, or 'void'
      field('type', choice($.objj_type, 'void')),
      ')'
    ),

    // Accept reserved words like `null` as selector identifiers in ObjJ
    objj_selector_identifier: $ => choice(
      $.identifier,
      alias($.null, $.identifier),
      alias('class', $.identifier),
      alias('return', $.identifier),
      alias('void', $.identifier),
      alias('if', $.identifier),
      alias('else', $.identifier),
      alias('switch', $.identifier),
      alias('case', $.identifier),
      alias('default', $.identifier),
      alias('break', $.identifier),
      alias('continue', $.identifier),
      alias('while', $.identifier),
      alias('do', $.identifier),
      alias('for', $.identifier),
      alias('new', $.identifier),
      alias('delete', $.identifier),
      alias('try', $.identifier),
      alias('catch', $.identifier),
      alias('finally', $.identifier),
      alias('throw', $.identifier),
      alias('typeof', $.identifier),
      alias('instanceof', $.identifier),
      alias('in', $.identifier),
      alias('this', $.identifier),
      alias('super', $.identifier),
      alias('static', $.identifier),
      alias('export', $.identifier),
      alias('import', $.identifier),
      alias('from', $.identifier),
      alias('as', $.identifier),
      alias('var', $.identifier),
      alias('let', $.identifier),
      alias('const', $.identifier),
      alias('function', $.identifier),
      alias('async', $.identifier),
      alias('await', $.identifier),
      alias('yield', $.identifier),
      alias('debugger', $.identifier),
      alias('with', $.identifier)
    ),

    objj_method_selector: $ => choice(
      // Unary selector: - (ReturnType)name;
      $.objj_selector_identifier,
      // Keyword selector: one or more parts
      repeat1($.objj_keyword_declarator)
    ),

    objj_keyword_declarator: $ => seq(
      field('keyword', $.objj_selector_identifier),
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
    objj_message_expression: $ => prec.dynamic(100, seq(
      '[',
      field('receiver', $.expression),
      field('selector', $.objj_message_selector),
      ']'
    )),

    objj_message_selector: $ => choice(
      // Unary selector
      $.objj_selector_identifier,
      // Keyword selector with one or more parts
      repeat1($.objj_message_keyword_argument)
    ),

    objj_message_keyword_argument: $ => seq(
      field('keyword', $.objj_selector_identifier),
      ':',
      field('argument', $.expression)
    ),

    // Objective-J selector expression: @selector(name) or @selector(name:part:)
    objj_selector_expression: $ => seq(
      '@selector',
      '(',
      $.objj_selector_name,
      ')'
    ),

    objj_selector_name: $ => choice(
      // Unary selector like "alloc"
      $.objj_selector_identifier,
      // One or more keyword parts like "applicationWillFinishLaunching:" etc.
      repeat1(seq($.objj_selector_identifier, ':'))
    ),

    // -------------------------------------------------------------------------
    // Preprocessor: minimal structured #if ... #else ... #endif with parsed condition
    // -------------------------------------------------------------------------
    preproc_if_block: $ => seq(
      field('if', $.preproc_if_line),
      // Body of the 'if' branch
      repeat(choice(
        $.preproc_if_block,     // nested
        $.preproc_directive,    // other #lines
        $.statement             // normal code
      )),
      // Optional else branch
      optional(seq(
        field('else', $.preproc_else_line),
        repeat(choice(
          $.preproc_if_block,
          $.preproc_directive,
          $.statement
        ))
      )),
      field('endif', $.preproc_endif_line)
    ),

    // #if <condition> - condition is parsed as a separate rule
    preproc_if_line: $ => seq(
      token(prec(1, seq('#', /[ \t]*/, 'if', /[ \t]+/))),
      field('condition', $.preproc_condition)
    ),

    // #else
    preproc_else_line: _ => token(prec(1, seq('#', /[ \t]*/, 'else', /[^\n]*/))),

    // #endif
    preproc_endif_line: _ => token(prec(1, seq('#', /[ \t]*/, 'endif', /[^\n]*/))),
    // Minimal condition language:
    // IDENT or IDENT '(' commaSep(IDENT) ')' or '!' cond or cond '&&' cond or cond '||' cond or '(' cond ')'
    preproc_condition: $ => $.preproc_disjunction,

    preproc_disjunction: $ => prec.left(seq(
      $.preproc_conjunction,
      repeat(seq('||', $.preproc_conjunction))
    )),

    preproc_conjunction: $ => prec.left(seq(
      $.preproc_negation,
      repeat(seq('&&', $.preproc_negation))
    )),

    preproc_negation: $ => choice(
      prec(2, seq('!', $.preproc_negation)),
      $.preproc_primary
    ),

    preproc_primary: $ => choice(
      // Prefer call when an identifier is immediately followed by '('
      prec(1, seq(
        field('callee', $.identifier),
        token.immediate('('),
        commaSep($.identifier),
        ')'
      )),
      $.identifier,
      seq('(', $.preproc_condition, ')')
    ),

    // Fallback for any other directive lines (e.g. #define, #include, #ifdef, etc.)
    preproc_directive: _ => token(seq('#', /[^\n]*/)),

    // Single token for angle-bracket system-style import path
    system_lib_string: $ => token(seq(
      '<',
      /[A-Za-z0-9_\/.\-]+/,
      '>'
    )),

    // Fix Javascript parent grammar
    template_string: $ => seq(
      '`',
      repeat(choice(
        alias($._template_chars, $.string_fragment),
        $.escape_sequence,
        $.template_substitution,
      )),
      '`',
    ),

    template_substitution: $ => seq(
      '${',
      $._expressions,
      '}',
    ),

    ternary_expression: $ => prec.right('ternary', seq(
      field('condition', $.expression),
      alias($._ternary_qmark, '?'),
      field('consequence', $.expression),
      ':',
      field('alternative', $.expression),
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


/**
 * @file A Javascript superset with support for classes and message passing
 * @author David Richardson
 * @license MIT, see LICENSE.txt in source code root
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
    '+', // class method
    '-', // instance method
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
    '^', // block literal
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
    $.escape_sequence,
    $.regex_pattern,
    $.jsx_text,
  ],

  extras: $ => [
    /[\s\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]/,
    /\\\r?\n/,
    $.comment
  ],

  conflicts: ($, original) => original.concat([
    [$.objj_message_expression, $.array],
    [$.statement, $.preproc_if_block],
    [$.binary_expression, $.objj_message_keyword_argument],
    [$.primary_expression, $.function_expression, $.generator_function],
    [$.array_pattern, $.native_array],
    [$._property_name, $._objj_literal],
    // { [expr](args) } is genuinely ambiguous until the parser sees whether
    // a colon follows (object literal with computed key) or not (block
    // containing a single-element array used as a call target).
    // LR(1) cannot resolve this; GLR explores both paths until the colon
    // disambiguates. The upstream JS grammar has the identical entry for
    // computed_property_name vs array; native_array replaces array here.
    [$.computed_property_name, $.native_array],

  ]),

  rules: {
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

    primary_expression: ($, original) => choice(
      original,
      $._objj_literal,
      $.objj_selector_expression,
      $.objj_protocol_expression,
      $._bracket_expression,
      $.objj_ref_expression,
      $.objj_deref_expression,
    ),

    objj_protocol_expression: $ => seq(
      '@protocol',
      '(',
      field('protocol', $.identifier),
      ')'
    ),

    // All bracket constructs routed here - message expressions take precedence over arrays
    _bracket_expression: $ => choice(
      prec.dynamic(10, $.objj_message_expression),
      prec.dynamic(0, $.native_array)
    ),

    // Disable inherited JavaScript array rule - all bracket constructs must go through _bracket_expression
    array: $ => choice(),

    // Native array implementation for use within _bracket_expression only
    native_array: $ => seq(
      '[',
      choice(
        ']',
        seq(
          choice($.expression, $.spread_element),
          choice(
            ']', // ← plain token
            seq(',', commaSep(optional(choice($.expression, $.spread_element))), ']')
          )
        )
      )
    ),

    objj_ref_expression: $ => seq(
      token('@ref'),
      '(',
      field('argument', $.expression),
      ')'
    ),

    objj_deref_expression: $ => seq(
      token('@deref'),
      '(',
      field('argument', $.expression),
      ')'
    ),

    assignment_expression: ($, original) => choice(
      original,
      prec.right('assign', seq(
        field('left', $.objj_deref_expression),
        choice('=', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<=', '>>=', '>>>='),
        field('right', $.expression),
      ))
    ),

    objj_import: $ => prec.dynamic(100, seq(
      '@import',
      field('path', choice(
        $.system_lib_string,
        $.string
      ))
    )),

    objj_global_declaration: $ => seq(
      '@global',
      field('name', $.identifier)
    ),

    objj_class_forward_declaration: $ => seq(
      '@class',
      field('name', $.identifier)
    ),

    objj_typedef: $ => seq(
      '@typedef',
      field('name', $.identifier)
    ),

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

    objj_class_implementation: $ => prec.right(1, seq(
      '@implementation',
      field('name', $.identifier),
      optional(choice(
        seq(':', field('superclass', $.identifier)),
        seq('(', field('category', $.identifier), ')')
      )),
      optional(field('protocols', $.objj_protocol_reference_list)),
      optional($.objj_instance_variables),
      repeat($.objj_implementation_member),
      '@end'
    )),

    objj_instance_variables: $ => seq(
      '{',
      repeat(choice(
        $.objj_instance_variable,
        $.preproc_ivar_if_block
      )),
      '}'
    ),

    preproc_ivar_if_block: $ => seq(
      field('if', $.preproc_if_line),
      repeat(choice(
        $.objj_instance_variable,
        $.preproc_ivar_if_block,
        $.preproc_directive
      )),
      optional(seq(
        field('else', $.preproc_else_line),
        repeat(choice(
          $.objj_instance_variable,
          $.preproc_ivar_if_block,
          $.preproc_directive
        ))
      )),
      field('endif', $.preproc_endif_line)
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

    // Allow storage/interface modifiers like @outlet before ivar type
    objj_ivar_modifiers: $ => repeat1($.objj_ivar_modifier),

    objj_ivar_modifier: _ => choice(
      '@outlet',
      '@IBOutlet',
      '@weak',
      '@strong'
    ),

    objj_field_definition: $ => seq(
      optional($.objj_ivar_modifiers),
      field('type', $.objj_type),
      field('name', $.identifier),
      optional(field('accessors', $.objj_accessors_directive)),
      ';'
    ),

    objj_type: $ => choice(
      $.objj_protocol_type, // identifier + protocol list
      $.objj_multi_word_type,
      seq('id', optional($.objj_protocol_reference_list)), // id and id<Protocol>
      $.identifier // plain identifier without protocol list
    ),

    objj_multi_word_type: $ => choice(
      seq('unsigned', choice('char', 'short', 'int', 'long')),
      seq('signed', choice('char', 'short', 'int', 'long')),
      seq('long', 'long'),
      seq('long', 'double'),
      seq('unsigned', 'long', 'long'),
      'unsigned',
      'signed',
      'long',
      'short',
      'char',
      'int',
    ),

    objj_protocol_type: $ => seq(
      $.identifier,
      $.objj_protocol_reference_list
    ),

    objj_accessors_directive: $ => seq(
      '@accessors',
      optional(seq(
        '(',
        commaSep1($.objj_accessor_attribute),
        ')'
      ))
    ),

    objj_accessor_attribute: $ => choice(
      seq($.identifier, '=', $.objj_accessor_name),
      $.identifier
    ),

    objj_accessor_name: $ => choice(
      $.identifier,
      seq($.identifier, ':'),
      seq($.identifier, repeat1(seq(':', $.identifier)), ':'),
    ),

    objj_implementation_member: $ => choice(
      $.objj_method_definition,
      $.preproc_directive,
      $.objj_global_declaration,
      $.variable_declaration,
      $.function_declaration,
      $.generator_function_declaration,
      $.empty_statement
    ),

    _objj_literal: $ => choice(
      $.objj_dictionary_literal, // Try { after @ first
      $.objj_array_literal, // Try [ after @ second
      $.objj_string_literal, // Try string after @ last (fallback)
    ),

    objj_string_literal: $ => seq(
      '@',
      $.string
    ),

    objj_dictionary_literal: $ => seq(
      '@',
      '{',
      optional(seq(
        commaSep1($.objj_dictionary_pair),
        optional(',')
      )),
      '}'
    ),

    objj_dictionary_key: $ => choice(
      $.identifier, // foo
      $.objj_string_literal, // @"foo"
      $.string, // "foo"
      $.number, // 42, 3.14
      $.unary_expression, // -1, !flag, +value
      $.binary_expression, // @"val" + 1
      $.ternary_expression, // NO ? 0 : 1
      $.call_expression, // computeValue()
      $.member_expression, // obj.property
      $.objj_message_expression, // [CPColor blackColor]
      $.function_expression, // Keep for values - functions ARE used here
      $.arrow_function, // Keep for values
      $.parenthesized_expression, // (complex + expr)
      $.objj_array_literal, // @[1, 2, 3]
      $.objj_dictionary_literal, // @{nested: dict}
      $.native_array // [1, 2, 3]
    ),

    objj_dictionary_value: $ => choice(
      $.identifier, // foo
      $.objj_string_literal, // @"foo"
      $.string, // "foo"
      $.number, // 42, 3.14
      $.unary_expression, // -1, !flag, +value
      $.binary_expression, // @"val" + 1
      $.ternary_expression, // NO ? 0 : 1
      $.call_expression, // computeValue()
      $.member_expression, // obj.property
      $.objj_message_expression, // [CPColor blackColor]
      $.function_expression, // function() { return val; }
      $.arrow_function, // () => val
      $.parenthesized_expression, // (complex + expr)
      $.objj_array_literal, // @[1, 2, 3]
      $.native_array, // [1, 2, 3] - ADD THIS
      $.objj_dictionary_literal // @{nested: dict}
    ),

    // This rule has been made explicit,
    // improving semantic analysis and maintainability
    objj_dictionary_pair: $ => seq(
      field('key', $.objj_dictionary_key),
      ':',
      field('value', $.objj_dictionary_value)
    ),

    objj_array_literal: $ => seq(
      '@',
      $.native_array
    ),

    // ============================================================================
    // METHOD DECLARATIONS AND DEFINITIONS
    // ============================================================================

    // Protocol/interface method declaration: signature + semicolon
    objj_method_declaration: $ => seq(
      field('method_type', choice('+', '-')),
      field('return_type', $.objj_method_type),
      choice(
        field('method_name', $.objj_selector_identifier),
        repeat1($.objj_method_parameter_part)
      ),
      ';'
    ),

    // Implementation method definition: signature + body
    objj_method_definition: $ => seq(
      field('method_type', choice('-', '+')),
      field('return_type', $.objj_method_type),
      choice(
        seq(
          field('method_name', $.objj_selector_identifier),
          optional(';'), // Optional semicolon (valid in Objective-C)
          field('body', $.statement_block)
        ),
        seq(
          repeat1($.objj_method_parameter_part),
          optional(';'), // Optional semicolon (valid in Objective-C)
          field('body', $.statement_block)
        )
      )
    ),

    // One part of a method signature: nameFragment:(Type)paramName
    objj_method_parameter_part: $ => seq(
      optional(field('name_part', $.objj_selector_identifier)), // ← optional
      ':',
      optional(field('parameter_type', $.objj_method_type)),
      field('parameter_name', $.identifier),
      optional(seq(',', '...'))
    ),

    objj_method_type: $ => seq(
      '(',
      optional('async'), // Move async out front
      field('type', choice(
        '@action',
        'void',
        $.objj_type
      )),
      ')'
    ),

    // ============================================================================
    // MESSAGE EXPRESSIONS (kept unchanged for now)
    // ============================================================================

    objj_message_expression: $ => prec.dynamic(100, seq(
      '[',
      field('receiver', $.expression),
      field('selector', $.objj_message_selector),
      ']'
    )),

    objj_message_selector: $ => choice(
      $.objj_selector_identifier,
      repeat1($.objj_message_keyword_argument)
    ),

    objj_message_keyword_argument: $ => seq(
      field('keyword', optional($.objj_selector_identifier)),
      ':',
      commaSep1($.expression)
    ),

    // ============================================================================
    // SELECTOR EXPRESSIONS
    // ============================================================================

    objj_selector_expression: $ => seq(
      '@selector',
      '(',
      $.objj_selector_name,
      ')'
    ),

    objj_selector_name: $ => choice(
      $.objj_selector_identifier,
      repeat1(seq($.objj_selector_identifier, ':'))
    ),

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

    // ============================================================================
    // PREPROCESSOR
    // ============================================================================

    preproc_if_block: $ => seq(
      field('if', $.preproc_if_line),
      repeat(choice(
        $.preproc_if_block,
        $.preproc_directive,
        $.statement,
        'else', // Allow bare else keyword
        'else if' // Possibly this too
      )),
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

    preproc_if_line: $ => seq(
      token(prec(1, choice(
        seq('#', /[ \t]*/, 'if', /[ \t]+/),
        seq('#', /[ \t]*/, 'ifdef', /[ \t]+/),
        seq('#', /[ \t]*/, 'ifndef', /[ \t]+/)
      ))),
      field('condition', $.preproc_condition)
    ),

    preproc_else_line: _ => token(prec(1, seq('#', /[ \t]*/, 'else', /[^\n]*/))),

    preproc_endif_line: _ => token(prec(1, seq('#', /[ \t]*/, 'endif', /[^\n]*/))),

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
      // Comparison: xxxx == 3, yyyy > 5
      prec(3, seq(
        $.identifier,
        choice('==', '!=', '<', '>', '<=', '>='),
        choice($.identifier, $.number)
      )),
      // Function call: defined(FOO)
      prec(1, seq(
        field('callee', $.identifier),
        token.immediate('('),
        commaSep($.identifier),
        ')'
      )),
      // Simple identifier: FOO
      $.identifier,
      // Grouped: (condition)
      seq('(', $.preproc_condition, ')')
    ),

    preproc_directive: _ => token(seq(
      '#',
      repeat(seq(
        /[^\n\\]*/,
        optional(seq('\\', '\n'))
      )),
      /[^\n]*/
    )),

    // TODO: Consider whether filesystem paths should be fully parsed vs opaque strings.
    // Current approach: permissive regex accepting common path characters.
    // Alternative: parse as opaque content between <>, validate in compiler/tooling.
    // Decision deferred pending experience with cross-platform usage and tool requirements.
    system_lib_string: $ => token(seq(
      '<',
      /[A-Za-z0-9_\/\\\.\-+:]+/, // Allow: alphanumeric, _, /, \, ., -, +, :
      '>'
    )),

    // ============================================================================
    // JAVASCRIPT GRAMMAR FIXES
    // ============================================================================

    _property_name: ($, original) => choice(
      original,
      $.objj_string_literal
    ),

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

    decorator: $ => choice(),

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

function commaSep(rule) {
  return optional(commaSep1(rule));
}

function commaSep1(rule) {
  return seq(rule, repeat(seq(',', rule)));
}

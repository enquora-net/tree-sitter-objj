; Inherit JavaScript highlighting
; (JavaScript base patterns will be applied automatically)

; Objective-J keywords
"@interface" @keyword
"@implementation" @keyword
"@end" @keyword
"@protocol" @keyword
"@class" @keyword
"@import" @keyword
"@property" @keyword
"@synthesize" @keyword
"@dynamic" @keyword
"@selector" @keyword
"@encode" @keyword
"@try" @keyword
"@catch" @keyword
"@finally" @keyword
"@throw" @keyword
"@synchronized" @keyword
"@optional" @keyword
"@required" @keyword
"@private" @keyword
"@protected" @keyword
"@public" @keyword
"@package" @keyword
"@compatibility_alias" @keyword

; Method scope indicators
(method_declaration scope: ("+") @keyword)
(method_declaration scope: ("-") @keyword)
(method_definition scope: ("+") @keyword)
(method_definition scope: ("-") @keyword)

; Class and protocol names
(class_interface name: (identifier) @type)
(class_implementation name: (identifier) @type)
(category_interface class_name: (identifier) @type)
(category_implementation class_name: (identifier) @type)
(protocol_declaration name: (identifier) @type)

; Superclass names
(class_interface superclass: (identifier) @type)
(class_implementation superclass: (identifier) @type)

; Method names and selectors
(method_declaration selector: (identifier) @function.method)
(method_definition selector: (identifier) @function.method)
(keyword_parameter keyword: (identifier) @function.method)

; Method parameters
(keyword_parameter parameter: (identifier) @variable.parameter)

; Message expressions
(message_expression) @function.call
(keyword_argument keyword: (identifier) @function.method)

; Property names
(property_declaration name: (identifier) @variable.member)
(synthesize_statement property: (identifier) @variable.member)

; Literals
(objj_string_literal) @string
(objj_number_literal) @number
(objj_array_literal) @punctuation.bracket
(objj_dictionary_literal) @punctuation.bracket

; Built-in constants
(self) @variable.builtin
(super) @variable.builtin
(nil) @constant.builtin
(YES) @constant.builtin
(NO) @constant.builtin

; Types
(method_type) @type
"void" @type
"id" @type
"BOOL" @type
"int" @type
"float" @type
"double" @type

; Property attributes
(property_attributes) @attribute
(_property_attribute) @attribute

; Visibility specifiers
(visibility_specifier) @keyword

; Message expression brackets
(message_expression "[" @punctuation.bracket)
(message_expression "]" @punctuation.bracket)

; Selector and protocol expressions
(selector_expression) @function
(protocol_expression) @type
(encode_expression) @function.builtin

; Comments (inherit from JavaScript)
(comment) @comment

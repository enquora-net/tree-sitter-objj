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
"@global" @keyword
"@typedef" @keyword
"@optional" @keyword
"@required" @keyword
"@private" @keyword
"@protected" @keyword
"@public" @keyword
"@package" @keyword
"@outlet" @keyword
"@IBOutlet" @keyword
"@weak" @keyword
"@strong" @keyword
"@accessors" @keyword
"@ref" @keyword
"@deref" @keyword
"@action" @keyword

; Method scope indicators
(objj_method_declaration method_type: ("+") @keyword)
(objj_method_declaration method_type: ("-") @keyword)
(objj_method_definition method_type: ("+") @keyword)
(objj_method_definition method_type: ("-") @keyword)

; Class and protocol names
(objj_class_implementation name: (identifier) @type)
(objj_protocol_declaration name: (identifier) @type)

; Superclass names
(objj_class_implementation superclass: (identifier) @type)

; Method names
(objj_method_declaration method_name: (objj_selector_identifier) @function.method)
(objj_method_definition method_name: (objj_selector_identifier) @function.method)
(objj_method_parameter_part name_part: (objj_selector_identifier) @function.method)

; Method parameters
(objj_method_parameter_part parameter_name: (identifier) @variable.parameter)

; Message expressions
(objj_message_expression) @function.call
(objj_message_keyword_argument keyword: (objj_selector_identifier) @function.method)

; Selector expressions
(objj_selector_expression) @function
(objj_selector_name (objj_selector_identifier) @function.method)

; Literals
(objj_string_literal) @string
(objj_array_literal) @punctuation.bracket
(objj_dictionary_literal) @punctuation.bracket
(objj_dictionary_key) @property

; Built-in types and constants
"void" @type
"id" @type
"BOOL" @type
"int" @type
"float" @type
"double" @type
"unsigned" @type
"signed" @type
"char" @type
"short" @type
"long" @type
"IMP" @type
"SEL" @type
"Class" @type

; Built-in identifiers
"self" @variable.builtin
"super" @variable.builtin
"nil" @constant.builtin
"null" @constant.builtin
"YES" @constant.builtin
"NO" @constant.builtin

; Visibility specifiers
(objj_visibility_specifier) @keyword

; Instance variables
(objj_field_definition name: (identifier) @variable.member)
(objj_field_definition type: (objj_type) @type)

; Message expression brackets
(objj_message_expression "[" @punctuation.bracket)
(objj_message_expression "]" @punctuation.bracket)

; Native arrays (to distinguish from message expressions)
(native_array "[" @punctuation.bracket)
(native_array "]" @punctuation.bracket)

; Protocol references
(objj_protocol_reference_list) @type

; Preprocessor
(preproc_if_line) @keyword
(preproc_else_line) @keyword
(preproc_endif_line) @keyword
(preproc_directive) @keyword

; Comments (inherited from JavaScript)
(comment) @comment

; System library imports
(system_lib_string) @string.special

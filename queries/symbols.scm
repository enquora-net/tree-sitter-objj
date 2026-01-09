; Class implementations
(objj_class_implementation
  name: (identifier) @name) @subtree
(#set! role type)

; Protocol declarations
(objj_protocol_declaration
  name: (identifier) @name) @subtree
(#set! role interface)

; Method declarations (in protocols)
(objj_method_declaration
  method_name: (objj_selector_identifier) @name) @subtree
(#set! role method)

; Multi-part method declarations
(objj_method_declaration
  (objj_method_parameter_part name_part: (objj_selector_identifier)) @name) @subtree
(#set! role method)

; Method definitions (in implementations)
(objj_method_definition
  method_name: (objj_selector_identifier) @name) @subtree
(#set! role method)

; Multi-part method definitions
(objj_method_definition
  (objj_method_parameter_part name_part: (objj_selector_identifier)) @name) @subtree
(#set! role method)

; Instance variables
(objj_field_definition
  name: (identifier) @name) @subtree
(#set! role property)

; JavaScript functions (inherited)
(function_declaration
  name: (identifier) @name) @subtree
(#set! role function)

; JavaScript variables
(variable_declarator
  name: (identifier) @name) @subtree
(#set! role variable)

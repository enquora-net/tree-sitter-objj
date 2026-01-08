// Empty array
var a = [];

// Single element
var b = [1];

// Multiple elements
var c = [1, 2, 3];

// Nested arrays
var d = [[1, 2], [3, 4]];

// Array with message send as element
var e = [[obj method]];

// Message send (not array)
[receiver method];

// Message send with nested receiver
[[CPNotificationCenter defaultCenter] postNotificationName:CPControlTextDidBeginEditingNotification];
import XCTest
import SwiftTreeSitter
import TreeSitterObjj

final class TreeSitterObjjTests: XCTestCase {
    func testCanLoadGrammar() throws {
        let parser = Parser()
        let language = Language(language: tree_sitter_objj())
        XCTAssertNoThrow(try parser.setLanguage(language),
                         "Error loading Objective-J grammar")
    }
}

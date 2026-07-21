@testable import Contempo
import ContempoCore
import SwiftUI
import XCTest

final class HelpWalkthroughTests: XCTestCase {
    func testWalkthroughStepData() {
        let sheet = HelpWalkthroughSheet()
        XCTAssertNotNil(sheet)
    }
}

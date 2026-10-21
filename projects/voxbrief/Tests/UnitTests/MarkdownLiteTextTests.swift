import XCTest
@testable import Voxbrief

final class MarkdownLiteTextTests: XCTestCase {
    func testToggleChecklistUncheckedToChecked() {
        let initial = """
        # Tasks
        - [ ] Buy groceries
        - [x] Walk the dog
        """

        let toggled = MarkdownLiteText.toggledChecklist(in: initial, at: 1)
        XCTAssertTrue(toggled.contains("- [x] Buy groceries"))
        XCTAssertTrue(toggled.contains("- [x] Walk the dog"))
    }

    func testToggleChecklistCheckedToUnchecked() {
        let initial = """
        # Tasks
        - [x] Walk the dog
        """

        let toggled = MarkdownLiteText.toggledChecklist(in: initial, at: 1)
        XCTAssertTrue(toggled.contains("- [ ] Walk the dog"))
    }

    func testToggleChecklistIgnoresNonChecklistLines() {
        let initial = """
        # Tasks
        - Regular bullet point
        """

        let toggled = MarkdownLiteText.toggledChecklist(in: initial, at: 1)
        XCTAssertEqual(toggled, initial)
    }
}

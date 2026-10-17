import ContempoCore
import XCTest

final class EntryFieldValidationTests: XCTestCase {
    func testAllFieldsPresentIsNotMissing() {
        XCTAssertEqual(
            EntryFieldValidation.missingFields(property: "123 Main St", task: "Cleaned pool", durationMinutes: 30),
            []
        )
    }

    func testBlankPropertyIsMissing() {
        XCTAssertEqual(
            EntryFieldValidation.missingFields(property: "  ", task: "Cleaned pool", durationMinutes: 30),
            [EntryFieldValidation.fieldProperty]
        )
    }

    func testBlankTaskIsMissing() {
        XCTAssertEqual(
            EntryFieldValidation.missingFields(property: "123 Main St", task: "", durationMinutes: 30),
            [EntryFieldValidation.fieldTask]
        )
    }

    func testNonPositiveDurationIsMissing() {
        XCTAssertEqual(
            EntryFieldValidation.missingFields(property: "123 Main St", task: "Cleaned pool", durationMinutes: 0),
            [EntryFieldValidation.fieldDuration]
        )
    }

    func testEverythingBlankReturnsAllThreeInOrder() {
        XCTAssertEqual(
            EntryFieldValidation.missingFields(property: "", task: "", durationMinutes: -5),
            [EntryFieldValidation.fieldProperty, EntryFieldValidation.fieldTask, EntryFieldValidation.fieldDuration]
        )
    }
}

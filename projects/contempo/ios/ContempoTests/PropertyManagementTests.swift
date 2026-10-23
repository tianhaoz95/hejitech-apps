@testable import Contempo
import ContempoCore
import ContempoData
import XCTest

@MainActor
final class PropertyManagementTests: XCTestCase {
    func testPropertyInitializationAndEquality() {
        let prop1 = Property(id: "prop_1", name: "Beach House", createdAt: nil)
        let prop2 = Property(id: "prop_1", name: "Beach House", createdAt: nil)
        let prop3 = Property(id: "prop_2", name: "Mountain Cabin", createdAt: nil)

        XCTAssertEqual(prop1, prop2)
        XCTAssertNotEqual(prop1, prop3)
        XCTAssertEqual(prop1.name, "Beach House")
    }

    func testSettingsViewModelInitialState() {
        let vm = SettingsViewModel()
        XCTAssertNil(vm.propertyError)
        vm.dismissPropertyError()
        XCTAssertNil(vm.propertyError)
    }
}

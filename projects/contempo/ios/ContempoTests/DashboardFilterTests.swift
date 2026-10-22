@testable import Contempo
import ContempoCore
import ContempoData
import XCTest

@MainActor
final class DashboardFilterTests: XCTestCase {
    private func entry(_ property: String, _ task: String, minutes: Int, category: String, role: String? = nil) -> Entry {
        var e = Entry(propertyName: property, task: task, durationMinutes: minutes, category: category, status: "confirmed")
        e.roleId = role
        return e
    }

    private func model() -> DashboardViewModel {
        let vm = DashboardViewModel()
        vm.entries = [
            entry("Ocean Ave Cottage", "Turnover clean", minutes: 120, category: "turnover"),
            entry("Ocean Ave Cottage", "Fix faucet", minutes: 60, category: "maintenance"),
            entry("Pine Ridge Cabin", "Guest messages", minutes: 30, category: "guest_communication"),
            entry("Pine Ridge Cabin", "Deck repaint", minutes: 240, category: "maintenance", role: "contractor"),
        ]
        return vm
    }

    func testFilteredHoursCountOnlyTheOwnersHours() {
        let vm = model()
        vm.selectedProperty = "Pine Ridge Cabin"
        XCTAssertEqual(vm.filteredEntries.count, 2)
        XCTAssertEqual(vm.filteredHours, 0.5, accuracy: 0.001) // the contractor's 4 h are listed, not counted
    }

    func testCategoryFilterUsesStoredValuesAndReadableLabels() {
        let vm = model()
        XCTAssertEqual(vm.categoryOptions.map(vm.categoryLabel), ["All", "Guest Communication", "Maintenance", "Turnover"])
        vm.selectedCategory = "maintenance"
        XCTAssertEqual(vm.filteredEntries.count, 2)
        XCTAssertEqual(vm.filteredHours, 1.0, accuracy: 0.001)
    }

    func testSearchMatchesTaskPropertyAndCategory() {
        let vm = model()
        vm.searchText = "faucet"
        XCTAssertEqual(vm.filteredEntries.map(\.task), ["Fix faucet"])
        vm.searchText = "pine"
        XCTAssertEqual(vm.filteredEntries.count, 2)
        XCTAssertTrue(vm.isFilterActive)
    }
}

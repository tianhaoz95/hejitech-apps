@testable import Contempo
import ContempoCore
import ContempoData
import XCTest

@MainActor
final class WidgetLiveSyncTests: XCTestCase {
    private let testAppGroupId = "test.group.com.hejitech.contempoapp.\(UUID().uuidString)"

    override func tearDown() {
        UserDefaults(suiteName: testAppGroupId)?.removePersistentDomain(forName: testAppGroupId)
        super.tearDown()
    }

    func testDashboardApplyWritesConfirmedHoursToStore() {
        let store = HoursProgressStore(appGroupId: testAppGroupId)
        XCTAssertEqual(store.read(), 0)

        let vm = DashboardViewModel(hoursProgressStore: store)

        var e1 = Entry(propertyName: "Cabin", task: "Cleaning", durationMinutes: 120, category: "turnover", status: "confirmed")
        e1.activityDate = Timestamp(date: Date()) // this year
        var e2 = Entry(propertyName: "Cabin", task: "Fix door", durationMinutes: 60, category: "maintenance", status: "confirmed")
        e2.activityDate = Timestamp(date: Date())
        var contractorEntry = Entry(propertyName: "Cabin", task: "Roof", durationMinutes: 300, category: "maintenance", status: "confirmed")
        contractorEntry.roleId = "contractor"

        vm.apply(entries: [e1, e2, contractorEntry])

        // Only owner hours count: 120m + 60m = 3.0h
        XCTAssertEqual(vm.confirmedHours, 3.0, accuracy: 0.001)
        XCTAssertEqual(store.read(), 3.0, accuracy: 0.001)
    }
}

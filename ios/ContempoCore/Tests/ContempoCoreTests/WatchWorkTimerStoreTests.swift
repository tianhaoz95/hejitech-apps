import ContempoCore
import XCTest

final class WatchWorkTimerStoreTests: XCTestCase {
    func testStartStopWorkTimerFlow() {
        let testSuiteName = "group.com.hejitech.contempo.test.\(UUID().uuidString)"
        let store = WatchWorkTimerStore(appGroupId: testSuiteName)

        XCTAssertFalse(store.isTimerRunning())
        XCTAssertNil(store.startedAt())

        let start = Date()
        store.startWorkTimer(task: "Maintenance & Repair", property: "Beach Villa")

        XCTAssertTrue(store.isTimerRunning())
        XCTAssertEqual(store.currentTask(), "Maintenance & Repair")
        XCTAssertEqual(store.currentProperty(), "Beach Villa")

        let stopDate = start.addingTimeInterval(15 * 60) // 15 minutes later
        let result = store.stopAndCompleteWorkTimer(stoppedAt: stopDate)

        XCTAssertNotNil(result)
        XCTAssertEqual(result?.durationMinutes, 15)
        XCTAssertEqual(result?.task, "Maintenance & Repair")
        XCTAssertEqual(result?.property, "Beach Villa")

        XCTAssertFalse(store.isTimerRunning())

        UserDefaults.standard.removeSuite(named: testSuiteName)
    }
}

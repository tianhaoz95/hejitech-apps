import XCTest
@testable import ContempoCore

final class WatchGpsTripStoreTests: XCTestCase {

    func testStartAndStopGpsTripFlow() {
        let store = WatchGpsTripStore()
        store.clearTrip()

        XCTAssertFalse(store.isTripActive())
        XCTAssertEqual(store.elapsedSeconds(), 0)

        store.startGpsTrip()

        XCTAssertTrue(store.isTripActive())
        XCTAssertNotNil(store.startedAt())

        let start = store.startedAt()!
        let stopTime = start.addingTimeInterval(300) // 5 minutes

        let completed = store.stopAndCompleteGpsTrip(stoppedAt: stopTime)

        XCTAssertNotNil(completed)
        XCTAssertEqual(completed?.durationMinutes, 5)
        XCTAssertFalse(store.isTripActive())
    }
}

import ContempoCore
import XCTest

final class HoursProgressStoreTests: XCTestCase {
    func testReadAndWriteConfirmedHours() {
        let testSuiteName = "group.com.hejitech.contempo.test.\(UUID().uuidString)"
        let store = HoursProgressStore(appGroupId: testSuiteName)

        XCTAssertEqual(store.read(), 0.0)

        store.write(confirmedHours: 42.5)
        XCTAssertEqual(store.read(), 42.5)

        UserDefaults.standard.removeSuite(named: testSuiteName)
    }
}

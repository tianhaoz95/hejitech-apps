import ContempoCore
import XCTest

final class UploadStatsStoreTests: XCTestCase {
    func testUploadStatsStoreRecording() {
        let suiteName = "UploadStatsStoreTests_\(UUID().uuidString)"
        guard let userDefaults = UserDefaults(suiteName: suiteName) else {
            XCTFail("Could not create test user defaults suite")
            return
        }
        defer { userDefaults.removePersistentDomain(forName: suiteName) }

        let store = UploadStatsStore(defaults: userDefaults)
        XCTAssertEqual(store.uploadedTodayCount(), 0)

        store.recordUpload()
        XCTAssertEqual(store.uploadedTodayCount(), 1)

        store.recordUpload()
        XCTAssertEqual(store.uploadedTodayCount(), 2)
    }
}

import ContempoCore
import XCTest

final class PendingCaptureStoreTests: XCTestCase {
    func testSaveListAndDeletePendingCapture() {
        let store = PendingCaptureStore()

        let dummyWavData = Data([0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45])
        let saved = store.save(wav: dummyWavData, lat: 37.7749, lng: -122.4194)

        XCTAssertFalse(saved.id.isEmpty)
        XCTAssertEqual(saved.lat, 37.7749)
        XCTAssertEqual(saved.lng, -122.4194)

        let list = store.listPending()
        XCTAssertTrue(list.contains(where: { $0.id == saved.id }))

        store.delete(saved)

        let listAfterDelete = store.listPending()
        XCTAssertFalse(listAfterDelete.contains(where: { $0.id == saved.id }))
    }
}

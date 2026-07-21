import ContempoCore
import XCTest

final class WatchAudioCaptureQueueWriterTests: XCTestCase {
    func testInitializationWithProjectId() {
        let writer = WatchAudioCaptureQueueWriter(projectId: "my-custom-project", emulatorHost: nil)
        XCTAssertNotNil(writer)
    }

    func testInitializationWithEmptyProjectIdFallsBack() {
        let writer = WatchAudioCaptureQueueWriter(projectId: "", emulatorHost: "localhost")
        XCTAssertNotNil(writer)
    }
}

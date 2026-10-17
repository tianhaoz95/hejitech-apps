import ContempoCore
import XCTest

final class WatchAudioCaptureQueueWriterTests: XCTestCase {
    func testEnqueueRequiresASignedInUser() async {
        do {
            try await WatchAudioCaptureQueueWriter().enqueue(storagePath: "u/audio/x.wav", capturedAt: Date(), lat: nil, lng: nil)
            XCTFail("expected notSignedIn")
        } catch WatchAudioCaptureQueueWriterError.notSignedIn {
            // expected: no session in a test process
        } catch {
            XCTFail("unexpected \(error)")
        }
    }
}

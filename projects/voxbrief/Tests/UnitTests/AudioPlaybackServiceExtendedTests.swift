import XCTest
@testable import Voxbrief

@MainActor
final class AudioPlaybackServiceExtendedTests: XCTestCase {

    func testRateCycling() {
        let service = AudioPlaybackService()
        XCTAssertEqual(service.playbackRate, 1.0)

        let r1 = service.cyclePlaybackRate()
        XCTAssertEqual(r1, 1.25)

        let r2 = service.cyclePlaybackRate()
        XCTAssertEqual(r2, 1.5)

        let r3 = service.cyclePlaybackRate()
        XCTAssertEqual(r3, 2.0)

        let r4 = service.cyclePlaybackRate()
        XCTAssertEqual(r4, 0.8)

        let r5 = service.cyclePlaybackRate()
        XCTAssertEqual(r5, 1.0)
    }

    func testLoopToggle() {
        let service = AudioPlaybackService()
        XCTAssertFalse(service.isLooping)

        service.toggleLooping()
        XCTAssertTrue(service.isLooping)

        service.toggleLooping()
        XCTAssertFalse(service.isLooping)
    }

    func testSkipClampingWhenNoAudioPlaying() {
        let service = AudioPlaybackService()
        // When duration is 0, skipForward and skipBackward should safely no-op
        service.skipForward(seconds: 15)
        XCTAssertEqual(service.currentTime, 0)

        service.skipBackward(seconds: 15)
        XCTAssertEqual(service.currentTime, 0)
    }
}

import XCTest
@testable import Voxbrief

@MainActor
final class AudioRecordingServicePauseTests: XCTestCase {

    func testInitialStateIsNotRecordingAndNotPaused() {
        let service = AudioRecordingService()
        XCTAssertFalse(service.isRecording)
        XCTAssertFalse(service.isPaused)
        XCTAssertEqual(service.recordingDuration, 0)
        XCTAssertEqual(service.audioLevel, 0)
    }

    func testSimulatedRecordingSupportsPauseAndResume() {
        let service = AudioRecordingService()
        service.setSimulatedRecording(active: true, duration: 10.0, level: 0.5, isPaused: false)
        XCTAssertTrue(service.isRecording)
        XCTAssertFalse(service.isPaused)
        XCTAssertEqual(service.recordingDuration, 10.0)

        // Pause simulation
        service.setSimulatedRecording(active: true, duration: 10.0, level: 0.0, isPaused: true)
        XCTAssertTrue(service.isRecording)
        XCTAssertTrue(service.isPaused)
        XCTAssertEqual(service.audioLevel, 0.0)
    }

    func testPauseAndResumeWithoutActiveRecorderAreSafeNoOps() {
        let service = AudioRecordingService()
        // Calling pause or resume when not recording does not crash or corrupt state
        service.pauseRecording()
        XCTAssertFalse(service.isPaused)

        service.resumeRecording()
        XCTAssertFalse(service.isPaused)
    }
}

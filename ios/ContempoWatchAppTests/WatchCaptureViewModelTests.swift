@testable import Contempo_Watch_App
import ContempoCore
import XCTest

@MainActor
final class WatchCaptureViewModelTests: XCTestCase {
    func testWatchCaptureInitialState() {
        let viewModel = WatchCaptureViewModel()
        XCTAssertFalse(viewModel.isRecording)
        XCTAssertFalse(viewModel.isUploadingPending)
        XCTAssertNil(viewModel.errorMessage)
        XCTAssertNil(viewModel.lastSavedSummary)
    }

    func testDismissMessagesClearsErrorAndSummary() {
        let viewModel = WatchCaptureViewModel()
        viewModel.errorMessage = "Sample error"
        viewModel.lastSavedSummary = "Sample summary"

        viewModel.dismissMessages()

        XCTAssertNil(viewModel.errorMessage)
        XCTAssertNil(viewModel.lastSavedSummary)
    }
}

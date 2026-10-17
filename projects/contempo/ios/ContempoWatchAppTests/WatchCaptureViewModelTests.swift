@testable import Contempo_Watch_App
import ContempoCore
import XCTest

/// A watchOS SwiftUI `App`'s `init()` (where `ContempoWatchApp` normally
/// calls `FirebaseBootstrap.configure()`) is not reliably invoked when
/// XCTest hosts this test bundle inside the watch app process — confirmed
/// live: `WatchCaptureViewModel.init()` reaching `WatchServiceLocator`'s
/// Firebase-backed singletons crashed with "The default FirebaseApp
/// instance must be configured" without this. Configuring it explicitly
/// here (guarded so it's a no-op if the app's own init happened to run
/// after all) is what makes constructing this ViewModel safe in a test.
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

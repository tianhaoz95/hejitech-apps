@testable import Contempo
import ContempoCore
import ContempoFirestore
import XCTest

@MainActor
final class CaptureViewModelTests: XCTestCase {
    func testInitialState() {
        let viewModel = CaptureViewModel()
        XCTAssertFalse(viewModel.isRecording)
        XCTAssertFalse(viewModel.isTranscribing)
        XCTAssertFalse(viewModel.isParsing)
        XCTAssertNil(viewModel.errorMessage)
        XCTAssertNil(viewModel.finalizedTranscript)
    }

    func testDiscardTranscriptResetsState() {
        let viewModel = CaptureViewModel()
        viewModel.finalizedTranscript = "Installed smoke alarm at 123 Main St"
        XCTAssertNotNil(viewModel.finalizedTranscript)

        viewModel.discardTranscript()
        XCTAssertNil(viewModel.finalizedTranscript)
    }

    func testManualEntryParamsConstruction() {
        let viewModel = CaptureViewModel()
        var params: ConfirmParams?

        viewModel.manualEntry { confirmParams in
            params = confirmParams
        }

        XCTAssertNotNil(params)
        XCTAssertEqual(params?.source, .manual)
    }
}

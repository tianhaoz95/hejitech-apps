@testable import Contempo
import ContempoCore
import ContempoFirestore
import FirebaseAuth
import XCTest

/// `CaptureViewModel.init()` eagerly attaches Firestore listeners (via
/// `AuthAwareStream`'s `factory` closure, invoked unconditionally as soon as
/// its enclosing `Task` runs) — `FirestoreEntryRepository`'s `uid` getter is
/// a `preconditionFailure` (a fatal trap, not a catchable error) when no
/// user is signed in. Signing in for real via the emulator's fake-auth path
/// (same mechanism `AuthManager.signIn()` uses under `USE_FIREBASE_EMULATOR`,
/// which Debug builds always compile with) is what makes constructing this
/// ViewModel here safe rather than a crash waiting to happen — requires the
/// Firebase emulator suite running against `demo-contempo` (see
/// `scripts/run-android-with-emulators.sh`'s iOS counterpart,
/// `scripts/run-ios-with-emulators.sh`).
///
/// Signed in ONCE for the whole class (not per-test, and deliberately never
/// signed back out) — confirmed live that signing out in `tearDown()`
/// crashes a LATER test: each `CaptureViewModel()`'s init-time Firestore
/// listener Task has no cancellation tied to the test lifecycle, so a
/// still-in-flight background Task from a previous test can still be
/// mid-`observeEntries()` call when the next test's `tearDown`/`setUp`
/// churns the signed-in user, tripping the same fatal precondition on a
/// stale task.
@MainActor
final class CaptureViewModelTests: XCTestCase {
    private static var didSignIn = false

    override func setUp() async throws {
        try await super.setUp()
        guard !Self.didSignIn else { return }
        try await ServiceLocator.authManager.signIn()
        Self.didSignIn = true
    }

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
        XCTAssertEqual(params?.captureSource, .manual)
    }
}

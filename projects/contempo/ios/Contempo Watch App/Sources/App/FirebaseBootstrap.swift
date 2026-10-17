import ContempoCore
import FirebaseAuth
import FirebaseCore
import FirebaseStorage
import Foundation

/// Emulator wiring, gated by the `USE_FIREBASE_EMULATOR` Swift compilation
/// condition — same dual-path convention as the phone app's
/// `FirebaseBootstrap`. No `FirebaseFirestore` import here at all: its SDK
/// target isn't built for watchOS (see `ContempoCore/Package.swift`'s
/// comment), so the watch reaches Firestore only via
/// `WatchAudioCaptureQueueWriter`'s REST calls, pointed at the emulator's
/// Firestore port directly when `emulatorHost` is non-nil. No Functions
/// dependency either — no on-device AI on-watch, no cloud parse call (see
/// CLAUDE.md's wear section: it only captures and relays audio for
/// phone-side processing).
enum FirebaseBootstrap {
    static let emulatorHost: String? = {
        #if USE_FIREBASE_EMULATOR
        return "localhost"
        #else
        return nil
        #endif
    }()

    static func configure() {
        FirebaseApp.configure()

        #if USE_FIREBASE_EMULATOR
        connectToEmulators()
        #endif
    }

    #if USE_FIREBASE_EMULATOR
    private static func connectToEmulators() {
        Auth.auth().useEmulator(withHost: emulatorHost!, port: 9099)
        Storage.storage().useEmulator(withHost: emulatorHost!, port: 9199)
    }
    #endif
}

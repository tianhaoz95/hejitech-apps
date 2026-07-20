import ContempoCore
import FirebaseAuth
import FirebaseCore
import FirebaseFirestore
import FirebaseFunctions
import FirebaseStorage
import Foundation

/// Emulator wiring, gated by the `USE_FIREBASE_EMULATOR` Swift compilation
/// condition (set for Debug builds only — see Config/Debug.xcconfig).
/// Mirrors Android's `ContempoApp.onCreate()`/`BuildConfig.USE_FIREBASE_EMULATOR`
/// two-path pattern: talks to "localhost" on the assumption that the
/// Simulator (or a physical device with the right port-forwarding) can reach
/// the emulator suite directly there, same convention as
/// `scripts/run-android-with-emulators.sh`'s `adb reverse`.
enum FirebaseBootstrap {
    private static let emulatorHost = "localhost"

    static func configure() {
        FirebaseApp.configure()

        #if USE_FIREBASE_EMULATOR
        connectToEmulators()
        #endif
    }

    #if USE_FIREBASE_EMULATOR
    private static func connectToEmulators() {
        Auth.auth().useEmulator(withHost: emulatorHost, port: 9099)

        let firestore = Firestore.firestore()
        firestore.useEmulator(withHost: emulatorHost, port: 8080)
        // Disk-persisted local cache would otherwise survive across app
        // launches/reinstalls and resurrect documents that were wiped
        // server-side via the emulator's REST clear endpoint (the SDK has no
        // way to know about a delete that bypassed it) — memory-only cache
        // keeps each emulator run's data scoped to that process lifetime.
        let settings = firestore.settings
        settings.cacheSettings = MemoryCacheSettings()
        firestore.settings = settings

        Storage.storage().useEmulator(withHost: emulatorHost, port: 9199)
        Functions.functions().useEmulator(withHost: emulatorHost, port: 5001)
    }
    #endif
}

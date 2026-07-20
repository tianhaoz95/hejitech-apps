import FirebaseAuth
import Foundation
import Observation
import WatchConnectivity

/// Same two-path shape as the phone's `AuthManager`/Android's
/// `WearAuthManager` in emulator mode — but the real path differs
/// fundamentally: watchOS has no supported standalone Google Sign-In flow
/// (see backend/functions/src/watchAuth.ts's kdoc), so instead of signing in
/// itself, this waits for a Firebase custom token relayed from the phone
/// (`WatchAuthTokenRelay`) over WatchConnectivity and signs in with that.
/// Once that first handoff completes, Firebase Auth persists the resulting
/// session locally — no phone reachability needed for subsequent launches.
@Observable
@MainActor
final class WatchAuthManager: NSObject, WCSessionDelegate {
    static let shared = WatchAuthManager()

    private(set) var isSignedIn = false
    private(set) var isWaitingForPhone = false

    private override init() {
        super.init()
        isSignedIn = Auth.auth().currentUser != nil
    }

    func start() {
        Auth.auth().addStateDidChangeListener { [weak self] _, user in
            self?.isSignedIn = user != nil
        }

        #if USE_FIREBASE_EMULATOR
        if Auth.auth().currentUser == nil {
            Task { try? await signInWithFakeEmulatorIdentity() }
        }
        #else
        guard WCSession.isSupported() else { return }
        WCSession.default.delegate = self
        WCSession.default.activate()
        isWaitingForPhone = Auth.auth().currentUser == nil
        #endif
    }

    #if USE_FIREBASE_EMULATOR
    /// Same fixed test identity as the phone app, so both land on the same emulator-mode user.
    private func signInWithFakeEmulatorIdentity() async throws {
        let fakeIdToken = #"{"sub":"emulator-pilot-user","email":"pilot@example.test","email_verified":true,"name":"Pilot Host"}"#
        let credential = GoogleAuthProvider.credential(withIDToken: fakeIdToken, accessToken: "")
        try await Auth.auth().signIn(with: credential)
    }
    #endif

    nonisolated func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {}

    nonisolated func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any] = [:]) {
        guard let customToken = userInfo["customToken"] as? String else { return }
        Task { @MainActor in
            try? await Auth.auth().signIn(withCustomToken: customToken)
            isWaitingForPhone = false
        }
    }
}

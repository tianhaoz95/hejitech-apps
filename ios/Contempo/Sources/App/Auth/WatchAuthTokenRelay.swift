import FirebaseAuth
import FirebaseFunctions
import Foundation
import WatchConnectivity

/// Sends the paired watch a Firebase custom token once this phone is signed
/// in, so the watch can bootstrap its own independent Firebase session (see
/// `mintWatchAuthToken` in backend/functions and the watch-side
/// `WatchAuthManager`). Uses `transferUserInfo`, which queues durably and
/// delivers next time the watch app is reachable — including across a phone
/// or watch relaunch — rather than requiring both apps to be foregrounded
/// at the same instant.
@MainActor
final class WatchAuthTokenRelay: NSObject, WCSessionDelegate {
    static let shared = WatchAuthTokenRelay()

    private override init() {
        super.init()
    }

    func start() {
        guard WCSession.isSupported() else { return }
        WCSession.default.delegate = self
        WCSession.default.activate()
    }

    func sendTokenIfSignedIn() {
        guard Auth.auth().currentUser != nil else { return }
        Task {
            do {
                let result = try await Functions.functions().httpsCallable("mintWatchAuthToken").call()
                guard let data = result.data as? [String: Any], let customToken = data["customToken"] as? String else {
                    return
                }
                guard WCSession.default.activationState == .activated else { return }
                WCSession.default.transferUserInfo(["customToken": customToken])
            } catch {
                // Best-effort — the watch keeps whatever session it already
                // has (or shows its own sign-in prompt) if this fails.
            }
        }
    }

    nonisolated func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        Task { @MainActor in
            sendTokenIfSignedIn()
        }
    }

    nonisolated func sessionDidBecomeInactive(_ session: WCSession) {}
    nonisolated func sessionDidDeactivate(_ session: WCSession) { session.activate() }
}

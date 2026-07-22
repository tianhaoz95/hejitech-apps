import FirebaseAuth
import FirebaseFunctions
import Foundation
import WatchConnectivity

/// Sends the paired watch a Firebase custom token once this phone is signed
/// in, so the watch can bootstrap its own independent Firebase session (see
/// `mintWatchAuthToken` in backend/functions and the watch-side
/// `WatchAuthManager`). Uses `transferUserInfo` + `updateApplicationContext`
/// and responds to interactive `sendMessage` requests from the watch.
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
            #if USE_FIREBASE_EMULATOR
            let payload: [String: Any] = ["isEmulator": true]
            _ = try? WCSession.default.updateApplicationContext(payload)
            WCSession.default.transferUserInfo(payload)
            #else
            do {
                let result = try await Functions.functions().httpsCallable("mintWatchAuthToken").call()
                guard let data = result.data as? [String: Any], let customToken = data["customToken"] as? String else {
                    return
                }
                guard WCSession.default.activationState == .activated else { return }
                let payload: [String: Any] = ["customToken": customToken]
                _ = try? WCSession.default.updateApplicationContext(payload)
                WCSession.default.transferUserInfo(payload)
            } catch {
                print("[WatchAuthTokenRelay] Error minting/transferring watch token: \(error)")
            }
            #endif
        }
    }

    nonisolated func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        Task { @MainActor in
            sendTokenIfSignedIn()
        }
    }

    nonisolated func session(_ session: WCSession, didReceiveMessage message: [String: Any], replyHandler: @escaping ([String: Any]) -> Void) {
        Task { @MainActor in
            guard let user = Auth.auth().currentUser else {
                replyHandler(["error": "Sign in on iPhone first"])
                return
            }
            #if USE_FIREBASE_EMULATOR
            replyHandler(["isEmulator": true])
            self.sendTokenIfSignedIn()
            #else
            do {
                _ = try? await user.getIDToken()
                let result = try await Functions.functions().httpsCallable("mintWatchAuthToken").call()
                if let data = result.data as? [String: Any], let customToken = data["customToken"] as? String {
                    replyHandler(["customToken": customToken])
                    let payload: [String: Any] = ["customToken": customToken]
                    _ = try? WCSession.default.updateApplicationContext(payload)
                    WCSession.default.transferUserInfo(payload)
                } else {
                    replyHandler(["error": "Mint failed — try again"])
                }
            } catch {
                print("[WatchAuthTokenRelay] mintWatchAuthToken error: \(error)")
                replyHandler(["error": error.localizedDescription])
            }
            #endif
        }
    }

    nonisolated func sessionDidBecomeInactive(_ session: WCSession) {}
    nonisolated func sessionDidDeactivate(_ session: WCSession) { session.activate() }
}

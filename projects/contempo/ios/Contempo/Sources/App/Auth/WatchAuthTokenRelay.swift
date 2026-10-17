import ContempoCore
import Foundation
import WatchConnectivity

/// Hands the paired Apple Watch a one-time pairing code (Contempo Worker POST /api/watch/pair) over
/// WatchConnectivity; the watch exchanges it for its own Supabase session (verifyOTP with the token
/// hash). Replaces the Firebase custom token.
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

    private func mintPairingCode() async throws -> String {
        let result = try await ContempoBackend.api("watch/pair")
        guard let tokenHash = result["tokenHash"] as? String else { throw ContempoBackendError.api("Pairing failed") }
        return tokenHash
    }

    func sendTokenIfSignedIn() {
        guard ContempoBackend.uid != nil else { return }
        Task {
            do {
                let tokenHash = try await mintPairingCode()
                guard WCSession.default.activationState == .activated else { return }
                let payload: [String: Any] = ["tokenHash": tokenHash]
                _ = try? WCSession.default.updateApplicationContext(payload)
                WCSession.default.transferUserInfo(payload)
            } catch {
                print("[WatchAuthTokenRelay] Error minting/transferring watch pairing code: \(error)")
            }
        }
    }

    nonisolated func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        Task { @MainActor in
            sendTokenIfSignedIn()
        }
    }

    nonisolated func session(_ session: WCSession, didReceiveMessage message: [String: Any], replyHandler: @escaping ([String: Any]) -> Void) {
        Task { @MainActor in
            guard ContempoBackend.uid != nil else {
                replyHandler(["error": "Sign in on iPhone first"])
                return
            }
            do {
                let tokenHash = try await self.mintPairingCode()
                replyHandler(["tokenHash": tokenHash])
            } catch {
                replyHandler(["error": error.localizedDescription])
            }
        }
    }

    nonisolated func sessionDidBecomeInactive(_ session: WCSession) {}
    nonisolated func sessionDidDeactivate(_ session: WCSession) { session.activate() }
}

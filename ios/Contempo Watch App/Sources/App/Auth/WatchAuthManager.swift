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
    private(set) var statusMessage: String? = nil

    private override init() {
        super.init()
        checkAuthStatus()
    }

    func start() {
        checkAuthStatus()

        Auth.auth().addStateDidChangeListener { [weak self] _, user in
            Task { @MainActor [weak self] in
                self?.isSignedIn = user != nil
                self?.isWaitingForPhone = user == nil
            }
        }

        if WCSession.isSupported() {
            WCSession.default.delegate = self
            WCSession.default.activate()
        }

        if !isSignedIn {
            requestTokenFromPhone()
        }
    }

    func checkAuthStatus() {
        let signedIn = Auth.auth().currentUser != nil
        isSignedIn = signedIn
        isWaitingForPhone = !signedIn
        if !signedIn {
            requestTokenFromPhone()
        }
    }

    func requestTokenFromPhone() {
        guard WCSession.isSupported(), WCSession.default.activationState == .activated else {
            statusMessage = "WatchConnectivity starting…"
            return
        }

        if let context = WCSession.default.receivedApplicationContext as [String: Any]?, !context.isEmpty {
            processAuthPayload(context)
            if isSignedIn { return }
        }

        statusMessage = "Contacting iPhone…"
        WCSession.default.sendMessage(["requestAuthToken": true]) { [weak self] reply in
            Task { @MainActor [weak self] in
                self?.processAuthPayload(reply)
            }
        } errorHandler: { [weak self] error in
            Task { @MainActor [weak self] in
                #if USE_FIREBASE_EMULATOR
                try? await self?.signInWithFakeEmulatorIdentity()
                #else
                self?.statusMessage = "iPhone unreachable — tap to retry"
                #endif
            }
        }
    }

    func signOut() {
        try? Auth.auth().signOut()
        checkAuthStatus()
    }

    #if USE_FIREBASE_EMULATOR
    /// Fixed test identity matching the phone app in emulator mode.
    func signInWithFakeEmulatorIdentity() async throws {
        let fakeIdToken = #"{"sub":"emulator-pilot-user","email":"pilot@example.test","email_verified":true,"name":"Pilot Host"}"#
        let credential = GoogleAuthProvider.credential(withIDToken: fakeIdToken, accessToken: "")
        try await Auth.auth().signIn(with: credential)
        statusMessage = nil
        checkAuthStatus()
    }
    #endif

    func processAuthPayload(_ payload: [String: Any]) {
        if let customToken = payload["customToken"] as? String {
            Task {
                do {
                    try await Auth.auth().signIn(withCustomToken: customToken)
                    statusMessage = nil
                    checkAuthStatus()
                } catch {
                    statusMessage = "Sign-in error: \(error.localizedDescription)"
                }
            }
        } else if payload["isEmulator"] as? Bool == true {
            #if USE_FIREBASE_EMULATOR
            Task {
                try? await signInWithFakeEmulatorIdentity()
                statusMessage = nil
            }
            #endif
        } else if let errorMsg = payload["error"] as? String {
            statusMessage = friendlyAuthErrorMessage(errorMsg)
        }
    }

    private func friendlyAuthErrorMessage(_ rawError: String) -> String {
        let lower = rawError.lowercased()
        if lower.contains("not_signed_in") || lower.contains("unauthenticated") || lower.contains("sign in") {
            return "Sign in on iPhone first"
        } else if lower.contains("not found") || lower.contains("error 5") {
            return "Pairing service unavailable"
        } else if lower.contains("network") || lower.contains("offline") || lower.contains("error 14") || lower.contains("timed out") || lower.contains("couldn’t be completed") {
            return "Network error — tap to retry"
        } else {
            return rawError
        }
    }

    nonisolated func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        Task { @MainActor in
            if activationState == .activated && !self.isSignedIn {
                self.requestTokenFromPhone()
                if let context = session.receivedApplicationContext as [String: Any]?, !context.isEmpty {
                    self.processAuthPayload(context)
                }
            }
        }
    }

    nonisolated func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any] = [:]) {
        Task { @MainActor in
            self.processAuthPayload(userInfo)
        }
    }

    nonisolated func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
        Task { @MainActor in
            self.processAuthPayload(applicationContext)
        }
    }
}

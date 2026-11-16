import HeadwayKit

/// What the shared Siri / Shortcuts intents (Intents/) need from the iPhone app: its signed-in client,
/// the Pro gate, and catching up after a change. Intents run in the app's process, even in the background.
@MainActor
enum IntentHost {
    static func signedInBackend() -> Backend? {
        let b = AppModel.shared.backend
        return b.session == nil ? nil : b
    }

    static func publicBackend() -> Backend { AppModel.shared.backend }

    /// The iPhone app needs Headway Pro (bought, or given by email), as its screens do.
    static func checkAccess() async throws {
        _ = AppModel.shared  // sets up ProStore's grant check
        let pro = ProStore.shared
        if !pro.checked { await pro.refresh() }
        if !pro.isPro, AppModel.shared.backend.session != nil { await pro.checkGrant() }
        guard pro.isPro else { throw HeadwayIntentError.pro }
    }

    /// The board, the watch and the Live Activity follow on the next refresh (now, if the app is running).
    static func didChange() async {
        if AppModel.shared.phase == .ready { await AppModel.shared.refresh() }
    }
}

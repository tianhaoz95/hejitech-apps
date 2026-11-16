import HeadwayKit

/// What the shared Siri / Shortcuts intents (Intents/) need from the watch app: the session the iPhone
/// shared with it (cached in WatchStore), so the watch asks the Worker itself. The watch isn't gated.
enum IntentHost {
    private static var config: BackendConfig {
        #if DEBUG
        .local
        #else
        .production
        #endif
    }

    static func signedInBackend() async -> Backend? {
        guard let session = WatchStore.loadCachedState()?.session else { return nil }
        return Backend(config: config, session: session)
    }

    static func publicBackend() async -> Backend { Backend(config: config) }

    static func checkAccess() async throws {}

    /// The watch app's model picks the change up on its next refresh.
    static func didChange() async {}
}

import FirebaseRemoteConfig
import Foundation
import Observation

private let cloudAiEnabledKey = "cloud_ai_enabled"
private let defaultCloudAiEnabled = true
private let minFetchIntervalSeconds: TimeInterval = 3_600

/// A remote kill switch for cloud AI usage — cloud calls (Genkit's
/// parseEntry/askAgent Cloud Functions) cost real money per request, unlike
/// on-device inference, so this exists to cut that cost off instantly (a
/// console change, not an App Store release) if it ever needs to happen.
/// Gated centrally in `ServiceLocator`'s `AgentClient` inference-preference
/// closure — every `AgentClient` call site benefits without each needing its
/// own check.
///
/// `cloudAiEnabled`'s in-process default (`true`) holds until `refresh()`
/// actually completes — deliberately not read from the Remote Config SDK's
/// own value before that, to avoid a cold-start window failing closed
/// instead of open.
@Observable
@MainActor
final class RemoteConfigStore {
    private let remoteConfig = RemoteConfig.remoteConfig()

    private(set) var cloudAiEnabled = defaultCloudAiEnabled

    init() {
        let settings = RemoteConfigSettings()
        settings.minimumFetchInterval = minFetchIntervalSeconds
        remoteConfig.configSettings = settings
    }

    /// Best-effort, called once from app launch — failures are silently swallowed.
    func refresh() async {
        remoteConfig.setDefaults([cloudAiEnabledKey: defaultCloudAiEnabled as NSObject])
        do {
            try await remoteConfig.fetchAndActivate()
            cloudAiEnabled = remoteConfig[cloudAiEnabledKey].boolValue
        } catch {
            // Keep the existing in-process default — see class doc.
        }
    }
}

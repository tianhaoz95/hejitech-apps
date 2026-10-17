import Foundation
import Observation

private let configURL = URL(string: "https://contempo.hejitech.workers.dev/app-config.json")!
private let defaultCloudAiEnabled = true

/// Remote kill switch for cloud AI spend (`cloud_ai_enabled`), read from the Contempo Worker's static
/// app-config.json (projects/contempo/services/web/public/app-config.json): edit and push to flip
/// it, no app release. Replaces Firebase Remote Config; stays on if unreachable.
@Observable
@MainActor
final class RemoteConfigStore {
    private(set) var cloudAiEnabled = defaultCloudAiEnabled

    func refresh() async {
        guard let (data, _) = try? await URLSession.shared.data(from: configURL),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return }
        cloudAiEnabled = json["cloud_ai_enabled"] as? Bool ?? defaultCloudAiEnabled
    }
}

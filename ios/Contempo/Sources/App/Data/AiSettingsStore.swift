import Foundation
import Observation

/// Plain `UserDefaults`, not a database — this is a single small enum value.
/// `@Observable` so `AgentClient`'s closure and `SettingsScreen` both read
/// live, not just at construction.
@Observable
@MainActor
final class AiSettingsStore {
    private static let key = "inference_preference"
    private let defaults: UserDefaults

    private(set) var preference: InferencePreference

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        if let stored = defaults.string(forKey: Self.key), let value = InferencePreference(rawValue: stored) {
            preference = value
        } else {
            preference = .onDeviceOnly
        }
    }

    func setPreference(_ value: InferencePreference) {
        defaults.set(value.rawValue, forKey: Self.key)
        preference = value
    }
}

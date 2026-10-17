import Foundation
import Observation

/// Persisted SharedPreferences/UserDefaults store for the Quick Capture toggle.
/// Quick Capture allows rapidly recording multiple voice notes without waiting
/// for on-device transcription or LLM parsing on the foreground thread.
@Observable
@MainActor
public final class QuickCaptureSettingsStore {
    private static let key = "quick_capture_enabled"
    private let defaults: UserDefaults

    public var enabled: Bool {
        didSet {
            defaults.set(enabled, forKey: Self.key)
        }
    }

    public init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        self.enabled = defaults.bool(forKey: Self.key)
    }

    public func setEnabled(_ value: Bool) {
        self.enabled = value
    }
}

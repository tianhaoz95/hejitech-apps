import Foundation
import Observation

/// Persisted UserDefaults store for the "Shake to report" toggle — mirrors
/// `QuickCaptureSettingsStore`. When on, shaking the device anywhere in the
/// app opens FeedbackKit's report flow (see `FeedbackReporting`).
@Observable
@MainActor
public final class ShakeToReportSettingsStore {
    private static let key = "shake_to_report_enabled"
    private let defaults: UserDefaults

    public var enabled: Bool {
        didSet {
            defaults.set(enabled, forKey: Self.key)
            FeedbackReporting.apply(enabled: enabled)
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

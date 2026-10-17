import Foundation
import Observation

/// Persisted UserDefaults store for the "Shake to report" toggle — mirrors
/// `QuickCaptureSettingsStore` exactly. When on, shaking the device anywhere
/// in the app captures a screenshot and opens the feedback annotation flow.
@Observable
@MainActor
public final class ShakeToReportSettingsStore {
    private static let key = "shake_to_report_enabled"
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

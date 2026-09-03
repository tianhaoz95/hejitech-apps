import Foundation
import Observation

/// Persisted UserDefaults store for whether this device has ever completed
/// (or skipped) the first-launch onboarding walkthrough — same plain-boolean
/// approach as ShakeToReportSettingsStore/QuickCaptureSettingsStore.
/// Deliberately device-scoped, not account-scoped: it lives in UserDefaults,
/// not Firestore, so a user signing into an existing account on a new device
/// still sees onboarding once here, matching the product ask ("regardless of
/// whether they already have an account or not").
@Observable
@MainActor
public final class OnboardingStore {
    private static let key = "has_completed_onboarding"
    private let defaults: UserDefaults

    public var hasCompleted: Bool {
        didSet {
            defaults.set(hasCompleted, forKey: Self.key)
        }
    }

    public init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        self.hasCompleted = defaults.bool(forKey: Self.key)
    }

    public func setCompleted(_ value: Bool) {
        self.hasCompleted = value
    }
}

import Foundation
import Observation

/// The persisted *default* capture mode, set from Settings — distinct from
/// CaptureViewModel's own in-session `captureMode`/`setCaptureMode`, which
/// reads this store's value once at construction and never writes back to
/// it (see CaptureViewModel's `captureMode` doc comment). Same plain
/// `UserDefaults` approach as `AiSettingsStore`.
@Observable
@MainActor
final class CaptureModeStore {
    private static let key = "default_capture_mode"
    private let defaults: UserDefaults

    private(set) var defaultMode: CaptureMode

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        if let stored = defaults.string(forKey: Self.key), let value = CaptureMode(rawValue: stored) {
            defaultMode = value
        } else {
            defaultMode = .audioFirst
        }
    }

    func setDefaultMode(_ value: CaptureMode) {
        defaults.set(value.rawValue, forKey: Self.key)
        defaultMode = value
    }
}

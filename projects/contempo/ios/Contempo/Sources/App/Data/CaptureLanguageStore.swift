import ContempoCore
import Foundation
import Observation

/// Plain `UserDefaults`-backed store for the app-level capture-language
/// preference, set from Settings (see `SettingsScreen`) — not a per-capture-
/// session choice on Capture itself. Default is `.english`, not `.auto`,
/// deliberately — cheaper and more predictable than auto-detection for the
/// common case.
@Observable
@MainActor
final class CaptureLanguageStore {
    private static let key = "selected_capture_language"
    private let defaults: UserDefaults

    private(set) var selected: CaptureLanguage

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        if let stored = defaults.string(forKey: Self.key), let value = CaptureLanguage(rawValue: stored) {
            selected = value
        } else {
            selected = .english
        }
    }

    func setSelected(_ value: CaptureLanguage) {
        defaults.set(value.rawValue, forKey: Self.key)
        selected = value
    }
}

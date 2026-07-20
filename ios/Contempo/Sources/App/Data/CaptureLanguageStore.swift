import ContempoCore
import Foundation
import Observation

/// Plain `UserDefaults`-backed store for the Capture tab's language selector
/// (hidden by default — see `AiSettingsStore`'s sibling `showLanguageSelector`
/// flag in `SettingsScreen`). Default is `.english`, not `.auto`, deliberately
/// — cheaper and more predictable than auto-detection for the common case.
@Observable
@MainActor
final class CaptureLanguageStore {
    private static let key = "selected_capture_language"
    private static let showSelectorKey = "show_capture_language_selector"
    private let defaults: UserDefaults

    private(set) var selected: CaptureLanguage
    /// Off by default — Capture just uses English until a host turns this on
    /// from Settings, so the common case never sees a language switcher.
    private(set) var showLanguageSelector: Bool

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        if let stored = defaults.string(forKey: Self.key), let value = CaptureLanguage(rawValue: stored) {
            selected = value
        } else {
            selected = .english
        }
        showLanguageSelector = defaults.bool(forKey: Self.showSelectorKey)
    }

    func setSelected(_ value: CaptureLanguage) {
        defaults.set(value.rawValue, forKey: Self.key)
        selected = value
    }

    func setShowLanguageSelector(_ value: Bool) {
        defaults.set(value, forKey: Self.showSelectorKey)
        showLanguageSelector = value
    }
}

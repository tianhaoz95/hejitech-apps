import SwiftUI
import UIKit

/// The app's colour scheme (Settings → Appearance). `.device` follows iOS.
enum AppTheme: String, CaseIterable, Identifiable {
    case device, light, dark

    static let storageKey = "appTheme"

    var id: String { rawValue }

    var label: String {
        switch self {
        case .device: "Device"
        case .light: "Light"
        case .dark: "Dark"
        }
    }

    var colorScheme: ColorScheme? {
        switch self {
        case .device: nil
        case .light: .light
        case .dark: .dark
        }
    }

    var interfaceStyle: UIUserInterfaceStyle {
        switch self {
        case .device: .unspecified
        case .light: .light
        case .dark: .dark
        }
    }

    /// Sets `overrideUserInterfaceStyle` on every app window so presented sheets, alerts and
    /// switching back to `.device` update immediately (SwiftUI's `.preferredColorScheme(nil)` can lag).
    @MainActor
    func apply() {
        for scene in UIApplication.shared.connectedScenes {
            guard let ws = scene as? UIWindowScene else { continue }
            for window in ws.windows {
                window.overrideUserInterfaceStyle = interfaceStyle
            }
        }
    }
}

// Folio's palette, from the Bauhaus app icon (projects/folio/brand/README.md): warm paper behind every
// screen, navy as the accent (AccentColor), coral and mustard as the icon's secondary colours.
extension Color {
    static let paper = Color("Paper")
    static let coral = Color(red: 0xF2 / 255, green: 0x5C / 255, blue: 0x3B / 255)
    static let mustard = Color(red: 0xF2 / 255, green: 0xB6 / 255, blue: 0x30 / 255)
    /// Mustard dark enough for text on paper in light mode (the icon's mustard in dark mode).
    static let mustardInk = Color(UIColor { $0.userInterfaceStyle == .dark
        ? UIColor(red: 0xF2 / 255, green: 0xB6 / 255, blue: 0x30 / 255, alpha: 1)
        : UIColor(red: 0xB0 / 255, green: 0x7A / 255, blue: 0x00 / 255, alpha: 1) })
}

extension View {
    /// Lists and forms on Folio's paper instead of the system's grey grouped background.
    func paperBackground() -> some View {
        scrollContentBackground(.hidden).background(Color.paper)
    }
}

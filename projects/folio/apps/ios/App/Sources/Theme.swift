import SwiftUI

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

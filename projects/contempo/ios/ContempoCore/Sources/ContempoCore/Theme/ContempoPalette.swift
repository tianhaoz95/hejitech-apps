import SwiftUI

/// Mirrors branding/landing_v0/site/assets/style.css tokens, same values the
/// Android app's ui/theme/Color.kt carries. Kept as a plain literal palette
/// (not a shared design-token pipeline) — see that CSS file's comment for why
/// a shared build-time token system would be over-engineering at this stage.
///
/// Shared across the iOS and watchOS targets (unlike Android, where the wear
/// module has its own separate Wear Material theming) since both need the
/// same brand identity and neither is complex enough to warrant divergence.
public struct ContempoPalette: Sendable, Equatable {
    public let paper: Color
    public let paperRaised: Color
    public let ink: Color
    public let inkSoft: Color
    public let inkFaint: Color
    public let pine: Color
    public let pineDeep: Color
    public let pineTint: Color
    public let navy: Color
    public let navyTint: Color
    public let brass: Color
    public let brassTint: Color
    public let brassDeep: Color
    public let hairline: Color
    public let hairlineStrong: Color
    public let danger: Color
    public let dangerTint: Color
    public let surfaceVariant: Color
    public let surfaceContainerLowest: Color
    public let surfaceContainerLow: Color
    public let surfaceContainer: Color
    public let surfaceContainerHigh: Color
    public let surfaceContainerHighest: Color
}

public enum ContempoTheme {
    public static let light = ContempoPalette(
        paper: Color(hex: 0xF5F6F2),
        paperRaised: Color(hex: 0xFFFFFF),
        ink: Color(hex: 0x14201B),
        inkSoft: Color(hex: 0x45524B),
        inkFaint: Color(hex: 0x7C8880),
        pine: Color(hex: 0x1F5C46),
        pineDeep: Color(hex: 0x163F31),
        pineTint: Color(hex: 0xE4EEE8),
        navy: Color(hex: 0x16273D),
        navyTint: Color(hex: 0xE7EBF1),
        brass: Color(hex: 0xA67C34),
        brassTint: Color(hex: 0xF3E9D6),
        brassDeep: Color(hex: 0x6B4E1F),
        hairline: Color(hex: 0xDBE1D8),
        hairlineStrong: Color(hex: 0xC3CCC3),
        danger: Color(hex: 0xA13F36),
        dangerTint: Color(hex: 0xFBECEB),
        surfaceVariant: Color(hex: 0xEEF1EC),
        surfaceContainerLowest: Color(hex: 0xFFFFFF),
        surfaceContainerLow: Color(hex: 0xF9FAF7),
        surfaceContainer: Color(hex: 0xF2F3EF),
        surfaceContainerHigh: Color(hex: 0xECEEE8),
        surfaceContainerHighest: Color(hex: 0xE6E8E2)
    )

    public static let dark = ContempoPalette(
        paper: Color(hex: 0x0E1613),
        paperRaised: Color(hex: 0x16201C),
        ink: Color(hex: 0xECEEE8),
        inkSoft: Color(hex: 0xA9B3AC),
        inkFaint: Color(hex: 0x71827A),
        pine: Color(hex: 0x45A67C),
        pineDeep: Color(hex: 0x327A5B),
        pineTint: Color(hex: 0x16261F),
        navy: Color(hex: 0x9FB2CF),
        navyTint: Color(hex: 0x17222F),
        brass: Color(hex: 0xCDA35C),
        brassTint: Color(hex: 0x2A2214),
        brassDeep: Color(hex: 0xCDA35C),
        hairline: Color(hex: 0x263029),
        hairlineStrong: Color(hex: 0x364039),
        danger: Color(hex: 0xD97A70),
        dangerTint: Color(hex: 0x2C1A18),
        surfaceVariant: Color(hex: 0x1B2420),
        surfaceContainerLowest: Color(hex: 0x0B100E),
        surfaceContainerLow: Color(hex: 0x121915),
        surfaceContainer: Color(hex: 0x16201C),
        surfaceContainerHigh: Color(hex: 0x1D2823),
        surfaceContainerHighest: Color(hex: 0x27332D)
    )

    public static func palette(for colorScheme: ColorScheme) -> ContempoPalette {
        colorScheme == .dark ? dark : light
    }
}

private struct ContempoPaletteKey: EnvironmentKey {
    static let defaultValue = ContempoTheme.light
}

public extension EnvironmentValues {
    var contempoPalette: ContempoPalette {
        get { self[ContempoPaletteKey.self] }
        set { self[ContempoPaletteKey.self] = newValue }
    }
}

private struct ContempoThemeModifier: ViewModifier {
    @Environment(\.colorScheme) private var colorScheme

    func body(content: Content) -> some View {
        content.environment(\.contempoPalette, ContempoTheme.palette(for: colorScheme))
    }
}

public extension View {
    /// Resolves `\.contempoPalette` from the current `colorScheme` — apply
    /// once near the app root (mirrors Android's `ContempoTheme` wrapper).
    func contempoTheme() -> some View {
        modifier(ContempoThemeModifier())
    }
}

public extension Color {
    init(hex: UInt32) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255,
            opacity: 1
        )
    }
}

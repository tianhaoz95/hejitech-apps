import SwiftUI

/// The landing page pairs a serif display face for headlines with a system
/// sans for body copy and a monospace for small uppercase "eyebrow" labels
/// and numeric/tabular values. `.serif`/`.monospaced` are built-in generic
/// font designs the platform resolves to a real system font — no font files
/// to bundle, matching Android's `FontFamily.Serif`/`.Monospace` choice for
/// the same reason.
///
/// SwiftUI applies letter-spacing via the separate `.tracking(_:)` view
/// modifier rather than as part of `Font` itself — the tracking values below
/// are the ones to pass alongside each font at call sites that need them.
public enum ContempoFont {
    public static func headlineLarge() -> Font { .system(size: 34, weight: .semibold, design: .serif) }
    public static let headlineLargeTracking: CGFloat = -0.3

    public static func headlineMedium() -> Font { .system(size: 26, weight: .semibold, design: .serif) }
    public static let headlineMediumTracking: CGFloat = -0.2

    public static func titleLarge() -> Font { .system(size: 20, weight: .semibold, design: .serif) }
    public static func titleMedium() -> Font { .system(size: 17, weight: .semibold, design: .serif) }

    public static func bodyLarge() -> Font { .system(size: 16, weight: .regular, design: .default) }

    public static func labelLarge() -> Font { .system(size: 14, weight: .medium, design: .default) }

    /// The "eyebrow" style: small uppercase mono labels above a screen/section
    /// title (see `Eyebrow`), reused wherever the landing page reaches for
    /// its mono/tabular-nums treatment (entry durations, timestamps).
    public static func labelSmall() -> Font { .system(size: 11, weight: .medium, design: .monospaced) }
    public static let labelSmallTracking: CGFloat = 1.3
}

/// Mirrors `--radius-sm/md/lg` from branding/landing_v0/site/assets/style.css
/// (4 / 8 / 14pt) — the brand's buttons and inputs are deliberately blockier
/// than the platform's default near-stadium shapes, which is most of what
/// makes buttons/fields/cards read as "the same product" as the landing page
/// mockups.
public enum ContempoRadius {
    public static let small: CGFloat = 4
    public static let medium: CGFloat = 8
    public static let large: CGFloat = 14
}

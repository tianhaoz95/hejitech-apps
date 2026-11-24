import SwiftUI

/// How much room the home screen's rows get (Settings → Home screen). Compact is the 0.2.7 design
/// and the default; the others only add space and make the tiles a little larger, fonts stay.
enum HomeSpacing: String, CaseIterable, Identifiable {
    case compact, comfortable, spacious

    static let storageKey = "homeSpacing"

    var id: String { rawValue }

    var label: String {
        switch self {
        case .compact: "Compact"
        case .comfortable: "Comfortable"
        case .spacious: "Spacious"
        }
    }

    /// Vertical inset above and below an artifact row.
    var rowPadding: CGFloat {
        switch self { case .compact: 5; case .comfortable: 9; case .spacious: 13 }
    }

    /// Vertical inset of a row in "To review" (its coral card already adds some).
    var reviewPadding: CGFloat {
        switch self { case .compact: 3; case .comfortable: 6; case .spacious: 9 }
    }

    /// Space above a section header ("To review", "Today", …).
    var headerTop: CGFloat {
        switch self { case .compact: 16; case .comfortable: 22; case .spacious: 28 }
    }

    /// The artifact tile in a row.
    var tileSize: CGFloat {
        switch self { case .compact: 34; case .comfortable: 38; case .spacious: 44 }
    }

    /// Between a row's title and its detail line.
    var lineSpacing: CGFloat {
        switch self { case .compact: 1; case .comfortable: 3; case .spacious: 5 }
    }

    /// Between favorite chips.
    var chipSpacing: CGFloat {
        switch self { case .compact: 6; case .comfortable: 8; case .spacious: 10 }
    }
}

extension EnvironmentValues {
    @Entry var homeSpacing: HomeSpacing = .compact
}

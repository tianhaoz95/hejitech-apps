/// Mirrors FlagRiskOutputSchema in backend/functions/src/schemas.ts.
public struct RiskFlags: Codable, Equatable, Sendable {
    public var isVague: Bool
    public var isBackfilled: Bool
    public var daysLate: Int
    public var reasons: [String]

    public init(isVague: Bool = false, isBackfilled: Bool = false, daysLate: Int = 0, reasons: [String] = []) {
        self.isVague = isVague
        self.isBackfilled = isBackfilled
        self.daysLate = daysLate
        self.reasons = reasons
    }

    public var hasWarning: Bool { isVague || isBackfilled }
}

/// MVP hardcodes the 100-hour STR test rather than exposing test selection in the
/// UI — the PRD's onboarding-interview feature (which picks the right test for the
/// host's situation) is fast-follow, not MVP scope. Shared by Dashboard and Chat
/// view models so the two can't drift apart.
public enum MaterialParticipationTest {
    public static let thresholdHours = 100
    public static let name = "STR"
}

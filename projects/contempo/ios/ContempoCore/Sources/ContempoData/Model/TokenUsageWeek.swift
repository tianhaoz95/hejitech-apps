import Foundation
import ContempoCore

/// Firestore document shape for `users/{uid}/deviceTokenUsage/{weekId}` and
/// `users/{uid}/cloudTokenUsage/{weekId}` (same shape, two separate
/// collections — see firestore.rules: device counters are client-written,
/// cloud counters are server-only). `weekId` is an ISO-8601 week string
/// ("GGGG-Www", e.g. "2026-W33"), Monday-start, computed in UTC so every
/// device and the backend agree on which week "now" falls in regardless of
/// local timezone.
public struct TokenUsageWeek: Codable, Equatable, Sendable {
    public var inputTokens: Int
    public var outputTokens: Int
    public var requestCount: Int
    public var weekStart: Timestamp?
    public var updatedAt: Timestamp?

    enum CodingKeys: String, CodingKey {
        case inputTokens = "input_tokens"
        case outputTokens = "output_tokens"
        case requestCount = "request_count"
        case weekStart = "week_start"
        case updatedAt = "updated_at"
    }

    public init(inputTokens: Int = 0, outputTokens: Int = 0, requestCount: Int = 0, weekStart: Timestamp? = nil, updatedAt: Timestamp? = nil) {
        self.inputTokens = inputTokens
        self.outputTokens = outputTokens
        self.requestCount = requestCount
        self.weekStart = weekStart
        self.updatedAt = updatedAt
    }

    /// Input tokens cost 1 credit/million, output tokens cost 6 credit/million
    /// (decode is the expensive side, on-device and cloud alike) — the single
    /// source of truth for turning a week's raw token counts into the
    /// "credits" unit shown in Settings' usage progress bars. Mirrors
    /// Android's `TokenUsageWeek.creditsUsed`.
    public var creditsUsed: Double {
        Double(inputTokens) / 1_000_000.0 * 1.0 + Double(outputTokens) / 1_000_000.0 * 6.0
    }
}

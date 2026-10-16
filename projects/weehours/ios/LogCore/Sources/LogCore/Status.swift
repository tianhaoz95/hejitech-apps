import Foundation

/// The one-line answer to "what's next", shown on every surface.
public struct StatusSnapshot: Codable, Hashable, Sendable {
    public var lastFeedAt: Date?
    public var lastFeedKind: String?        // bottle | breast | solids
    public var openFeedKind: String?        // bottle | breast while a feed session is open
    public var openFeedSince: Date?
    public var nextSide: String?            // left | right
    public var sleepingSince: Date?
    public var lastWakeAt: Date?
    public var lastDiaperAt: Date?
    public var lastDiaperKind: String?
    public var toReview: Int
    public var pendingCaptures: Int
    public var onDuty: UUID?
    public var computedAt: Date

    enum CodingKeys: String, CodingKey {
        case lastFeedAt = "last_feed_at", lastFeedKind = "last_feed_kind", openFeedKind = "open_feed_kind"
        case openFeedSince = "open_feed_since", nextSide = "next_side", sleepingSince = "sleeping_since"
        case lastWakeAt = "last_wake_at", lastDiaperAt = "last_diaper_at", lastDiaperKind = "last_diaper_kind"
        case toReview = "to_review", pendingCaptures = "pending_captures", onDuty = "on_duty", computedAt = "computed_at"
    }

    public init(log: DerivedLog, now: Date, pendingCaptures: Int = 0, pendingPicks: Int = 0) {
        let counted = log.counted
        let feedSessions = log.sessions.filter { $0.kind == .bottle || $0.kind == .breast }
        let solids = counted.last { $0.type == "feed.solids" }

        var lastFeed: (Date, String)? = feedSessions.max { $0.anchor < $1.anchor }.map { ($0.anchor, $0.kind.rawValue) }
        if let s = solids, s.occurredAt > (lastFeed?.0 ?? .distantPast) { lastFeed = (s.occurredAt, "solids") }
        lastFeedAt = lastFeed?.0
        lastFeedKind = lastFeed?.1

        if let open = log.openFeedSession() {
            openFeedKind = open.kind.rawValue
            openFeedSince = open.start
        }

        // next side: opposite of the last side used in a breast session
        let lastSide = log.sessions.filter { $0.kind == .breast }.flatMap(\.sides).last
        switch lastSide {
        case "left": nextSide = "right"
        case "right": nextSide = "left"
        default: nextSide = nil
        }

        if let sleep = log.openSession(.sleep) { sleepingSince = sleep.start }
        lastWakeAt = log.sessions.filter { $0.kind == .sleep }.compactMap(\.end).max()

        let diaper = counted.last { $0.type == "diaper" }
        lastDiaperAt = diaper?.occurredAt
        lastDiaperKind = diaper?.string("kind")

        toReview = log.duplicates.count + pendingPicks
        self.pendingCaptures = pendingCaptures
        onDuty = log.duty?.caregiver
        computedAt = now
    }

    /// e.g. `Fed 2h40m ago · left next · diaper 1h10m ago`
    public func line(now: Date) -> String {
        var parts: [String] = []
        if let since = sleepingSince {
            parts.append("Sleeping \(Self.duration(now.timeIntervalSince(since)))")
        } else if let since = openFeedSince {
            parts.append("Feeding \(Self.duration(now.timeIntervalSince(since)))")
        } else if let fed = lastFeedAt {
            parts.append("Fed \(Self.ago(now.timeIntervalSince(fed)))")
        } else {
            parts.append("No feeds yet")
        }
        if let side = nextSide { parts.append("\(side) next") }
        if let d = lastDiaperAt { parts.append("diaper \(Self.ago(now.timeIntervalSince(d)))") }
        if pendingCaptures > 0 { parts.append("\(pendingCaptures) pending") }
        if toReview > 0 { parts.append("\(toReview) to review") }
        return parts.joined(separator: " · ")
    }

    public static func ago(_ seconds: TimeInterval) -> String {
        seconds < 60 ? "just now" : "\(duration(seconds)) ago"
    }

    public static func duration(_ seconds: TimeInterval) -> String {
        let minutes = max(0, Int(seconds / 60))
        if minutes < 60 { return "\(minutes)m" }
        let hours = minutes / 60
        if hours < 24 { return minutes % 60 == 0 ? "\(hours)h" : "\(hours)h\(minutes % 60)m" }
        let days = hours / 24
        return hours % 24 == 0 ? "\(days)d" : "\(days)d\(hours % 24)h"
    }
}

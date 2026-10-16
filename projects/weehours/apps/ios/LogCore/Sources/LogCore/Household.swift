import Foundation

public struct Caregiver: Codable, Hashable, Sendable, Identifiable {
    public var id: UUID
    public var name: String
    /// Minutes after midnight; reminders are silent for this caregiver inside the window unless on duty.
    public var quietStart: Int?
    public var quietEnd: Int?

    public init(id: UUID, name: String, quietStart: Int? = nil, quietEnd: Int? = nil) {
        self.id = id
        self.name = name
        self.quietStart = quietStart
        self.quietEnd = quietEnd
    }

    enum CodingKeys: String, CodingKey {
        case id, name
        case quietStart = "quiet_start"
        case quietEnd = "quiet_end"
    }
}

public struct ReminderSettings: Codable, Hashable, Sendable {
    public var feedEveryMinutes: Int?
    public var diaperEveryMinutes: Int?
    public var overdueMarginMinutes: Int
    public var snoozeMinutes: Int
    public var adaptive: Bool

    public init(feedEveryMinutes: Int? = nil, diaperEveryMinutes: Int? = nil, overdueMarginMinutes: Int = 20,
                snoozeMinutes: Int = 10, adaptive: Bool = false) {
        self.feedEveryMinutes = feedEveryMinutes
        self.diaperEveryMinutes = diaperEveryMinutes
        self.overdueMarginMinutes = overdueMarginMinutes
        self.snoozeMinutes = snoozeMinutes
        self.adaptive = adaptive
    }

    enum CodingKeys: String, CodingKey {
        case adaptive
        case feedEveryMinutes = "feed_every_minutes"
        case diaperEveryMinutes = "diaper_every_minutes"
        case overdueMarginMinutes = "overdue_margin_minutes"
        case snoozeMinutes = "snooze_minutes"
    }
}

/// Household configuration (the Supabase `households.settings` column plus profile fields).
public struct Household: Codable, Hashable, Sendable {
    public var id: UUID
    public var name: String
    public var babyId: UUID
    public var babyName: String
    public var birthDate: Date?
    public var bottleMl: Double
    public var categories: [String]
    /// What a ring tap / generic "start feed" starts: bottle or breast.
    public var defaultFeed: String
    public var reminders: ReminderSettings
    public var caregivers: [Caregiver]
    public var nightStart: Int
    public var nightEnd: Int

    public init(id: UUID = UUID(), name: String = "Our family", babyId: UUID = UUID(), babyName: String = "Baby",
                birthDate: Date? = nil, bottleMl: Double = 120, categories: [String] = Array(EventRegistry.shared.defaultCategories).sorted(),
                defaultFeed: String = "bottle", reminders: ReminderSettings = .init(), caregivers: [Caregiver] = [],
                nightStart: Int = 21 * 60, nightEnd: Int = 7 * 60) {
        self.id = id
        self.name = name
        self.babyId = babyId
        self.babyName = babyName
        self.birthDate = birthDate
        self.bottleMl = bottleMl
        self.categories = categories
        self.defaultFeed = defaultFeed
        self.reminders = reminders
        self.caregivers = caregivers
        self.nightStart = nightStart
        self.nightEnd = nightEnd
    }

    enum CodingKeys: String, CodingKey {
        case id, name, categories, reminders, caregivers
        case babyId = "baby_id"
        case babyName = "baby_name"
        case birthDate = "birth_date"
        case bottleMl = "bottle_ml"
        case defaultFeed = "default_feed"
        case nightStart = "night_start"
        case nightEnd = "night_end"
    }

    public var enabled: Set<String> { Set(categories) }

    public func caregiverName(_ id: UUID?) -> String {
        guard let id else { return "nobody" }
        return caregivers.first { $0.id == id }?.name ?? "someone"
    }

    public func isNight(_ date: Date, calendar: Calendar = .current) -> Bool {
        let c = calendar.dateComponents([.hour, .minute], from: date)
        let m = (c.hour ?? 0) * 60 + (c.minute ?? 0)
        return nightStart > nightEnd ? (m >= nightStart || m < nightEnd) : (m >= nightStart && m < nightEnd)
    }

    /// Amount in ml for a bottle entry: explicit ml wins, else fraction × preset size.
    public func milliliters(_ e: LogEvent) -> Double? {
        if let ml = e.number("consumed_ml") { return ml }
        if let f = e.number("consumed_fraction") { return (f * bottleMl).rounded() }
        return nil
    }
}

// MARK: - Reminders

public struct PlannedReminder: Hashable, Sendable {
    public enum Kind: String, Sendable { case feed, diaper }
    public let kind: Kind
    public let fireAt: Date
    /// Second stage: phone sound after the overdue margin; the first stage is haptic / HUD only.
    public let escalated: Bool
    public let message: String
}

/// Pure reminder planning: given the log and settings, which reminders should this caregiver's
/// devices schedule? Logging the matching event changes the log and so cancels them.
public enum ReminderPlanner {
    public static func plan(log: DerivedLog, household: Household, me: UUID, now: Date,
                            snoozedUntil: [PlannedReminder.Kind: Date] = [:], calendar: Calendar = .current) -> [PlannedReminder] {
        if let duty = log.duty, let onDuty = duty.caregiver, onDuty != me { return [] }
        let status = StatusSnapshot(log: log, now: now)
        var out: [PlannedReminder] = []
        let settings = household.reminders

        func add(_ kind: PlannedReminder.Kind, due: Date, text: String) {
            var first = max(due, now)
            if let snooze = snoozedUntil[kind], snooze > first { first = snooze }
            let me = household.caregivers.first { $0.id == me }
            let onDuty = log.duty?.caregiver != nil
            if !onDuty, let me, inQuiet(first, me, calendar) { return }
            out.append(PlannedReminder(kind: kind, fireAt: first, escalated: false, message: text))
            out.append(PlannedReminder(kind: kind, fireAt: first.addingTimeInterval(TimeInterval(settings.overdueMarginMinutes * 60)),
                                       escalated: true, message: text + " (overdue)"))
        }

        if let every = settings.feedEveryMinutes, status.openFeedSince == nil, let last = status.lastFeedAt {
            add(.feed, due: last.addingTimeInterval(TimeInterval(every * 60)), text: "Feed due · \(status.nextSide.map { "\($0) next" } ?? "")")
        }
        if let every = settings.diaperEveryMinutes, let last = status.lastDiaperAt {
            add(.diaper, due: last.addingTimeInterval(TimeInterval(every * 60)), text: "Diaper check due")
        }
        return out
    }

    static func inQuiet(_ date: Date, _ c: Caregiver, _ calendar: Calendar) -> Bool {
        guard let s = c.quietStart, let e = c.quietEnd else { return false }
        let comps = calendar.dateComponents([.hour, .minute], from: date)
        let m = (comps.hour ?? 0) * 60 + (comps.minute ?? 0)
        return s > e ? (m >= s || m < e) : (m >= s && m < e)
    }

    /// Adaptive mode: median gap between feed starts over the last 3 days, rounded to 15 min.
    /// A suggestion only; parents accept or ignore it.
    public static func suggestedFeedInterval(log: DerivedLog, now: Date) -> Int? {
        let starts = log.sessions.filter { ($0.kind == .bottle || $0.kind == .breast) }
            .map(\.anchor).filter { now.timeIntervalSince($0) <= 3 * 86400 }.sorted()
        guard starts.count >= 4 else { return nil }
        let gaps = zip(starts.dropFirst(), starts).map { $0.timeIntervalSince($1) / 60 }.filter { $0 > 20 }.sorted()
        guard !gaps.isEmpty else { return nil }
        let median = gaps[gaps.count / 2]
        return Int((median / 15).rounded() * 15)
    }
}

// MARK: - Export

public enum CSVExport {
    public static func csv(log: DerivedLog, household: Household) -> String {
        var lines = ["occurred_at,type,details,ml,logged_by,surface,input,transcript,confidence_tier"]
        for e in log.effective where log.status[e.id] == .active {
            let ml = household.milliliters(e).map { String(Int($0)) } ?? ""
            let details = e.fields.keys.sorted().map { "\($0)=\(e.fields[$0]!)" }.joined(separator: " ")
            let cols = [LogCoding.isoString(e.occurredAt), e.type, details, ml, household.caregiverName(e.loggedBy),
                        e.provenance.surface.rawValue, e.provenance.input.rawValue, e.provenance.rawTranscript ?? "",
                        e.provenance.confidenceTier?.rawValue ?? ""]
            lines.append(cols.map(escape).joined(separator: ","))
        }
        return lines.joined(separator: "\n") + "\n"
    }

    static func escape(_ s: String) -> String {
        s.contains(",") || s.contains("\"") || s.contains("\n") ? "\"" + s.replacingOccurrences(of: "\"", with: "\"\"") + "\"" : s
    }
}

// MARK: - Billing (dummy store, real entitlement rules)

public enum Plan: String, Codable, Sendable, CaseIterable {
    case monthly, yearly, lifetime

    public var productId: String { "subscription.\(rawValue)" }
}

/// Entitlement rules: 14-day trial from household creation, then a subscription or a lifetime
/// purchase. One purchase covers the whole household.
public struct Entitlement: Codable, Hashable, Sendable {
    public var trialStartedAt: Date
    public var plan: Plan?
    public var expiresAt: Date?

    public static let trialDays = 14

    public init(trialStartedAt: Date, plan: Plan? = nil, expiresAt: Date? = nil) {
        self.trialStartedAt = trialStartedAt
        self.plan = plan
        self.expiresAt = expiresAt
    }

    enum CodingKeys: String, CodingKey {
        case plan
        case trialStartedAt = "trial_started_at"
        case expiresAt = "expires_at"
    }

    public enum Access: Equatable, Sendable {
        case trial(daysLeft: Int)
        case subscribed(Plan, until: Date?)
        case lifetime
        case expired
    }

    public func access(now: Date) -> Access {
        if plan == .lifetime { return .lifetime }
        if let plan, let expiresAt, expiresAt > now { return .subscribed(plan, until: expiresAt) }
        let trialEnd = trialStartedAt.addingTimeInterval(TimeInterval(Self.trialDays * 86400))
        if trialEnd > now {
            return .trial(daysLeft: Int(ceil(trialEnd.timeIntervalSince(now) / 86400)))
        }
        return .expired
    }

    /// Logging never stops working (data loss is worse than an unpaid feature); after the trial
    /// the paid surfaces lock: voice, watch, glasses, MCP, reminders.
    public func allows(_ feature: Feature, now: Date) -> Bool {
        if feature == .tapLogging { return true }
        return access(now: now) != .expired
    }

    public enum Feature: String, Sendable { case tapLogging, voice, watch, glasses, mcp, reminders, export }
}

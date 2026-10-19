import Foundation

public struct Caregiver: Codable, Hashable, Sendable, Identifiable {
    public var id: UUID
    public var name: String
    /// Optional: who they are to the children ("Mom", "Dad", "Nanny"…), shown next to the name.
    public var role: String?
    /// Minutes after midnight; reminders are silent for this caregiver inside the window unless on duty.
    public var quietStart: Int?
    public var quietEnd: Int?

    public init(id: UUID, name: String, role: String? = nil, quietStart: Int? = nil, quietEnd: Int? = nil) {
        self.id = id
        self.name = name
        self.role = role
        self.quietStart = quietStart
        self.quietEnd = quietEnd
    }

    enum CodingKeys: String, CodingKey {
        case id, name, role
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

/// One child in the household (a `weehours.babies` row). The name keeps the schema's word, `baby`.
public struct Baby: Codable, Hashable, Sendable, Identifiable {
    public var id: UUID
    public var name: String
    public var birthDate: Date?
    /// Key into the app's child palette (`Theme.childColor`); nil picks one by position.
    public var color: String?
    /// Overrides the household bottle size for this child.
    public var bottleMl: Double?
    /// Overrides what a quick "start feed" starts for this child: bottle or breast.
    public var defaultFeed: String?
    public var position: Int
    /// Archived children keep their log but leave Now, widgets and voice.
    public var archived: Bool

    public init(id: UUID = UUID(), name: String, birthDate: Date? = nil, color: String? = nil, bottleMl: Double? = nil,
                defaultFeed: String? = nil, position: Int = 0, archived: Bool = false) {
        self.id = id
        self.name = name.trimmingCharacters(in: .whitespacesAndNewlines)
        self.birthDate = birthDate
        self.color = color
        self.bottleMl = bottleMl
        self.defaultFeed = defaultFeed
        self.position = position
        self.archived = archived
    }

    enum CodingKeys: String, CodingKey {
        case id, name, color, position, archived
        case birthDate = "birth_date"
        case bottleMl = "bottle_ml"
        case defaultFeed = "default_feed"
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(UUID.self, forKey: .id)
        name = try c.decode(String.self, forKey: .name).trimmingCharacters(in: .whitespacesAndNewlines)
        birthDate = try c.decodeIfPresent(Date.self, forKey: .birthDate)
        color = try c.decodeIfPresent(String.self, forKey: .color)
        bottleMl = try c.decodeIfPresent(Double.self, forKey: .bottleMl)
        defaultFeed = try c.decodeIfPresent(String.self, forKey: .defaultFeed)
        position = try c.decodeIfPresent(Int.self, forKey: .position) ?? 0
        archived = try c.decodeIfPresent(Bool.self, forKey: .archived) ?? false
    }
}

/// Household configuration (the Supabase `households.settings` column plus profile fields).
/// People, duty, tracked categories, reminders and billing are household-wide; each child has a
/// few settings of their own (`Baby`).
public struct Household: Codable, Hashable, Sendable {
    public var id: UUID
    public var name: String
    /// Every child, archived ones included, in display order.
    public var babies: [Baby]
    public var bottleMl: Double
    public var categories: [String]
    /// What a ring tap / generic "start feed" starts: bottle or breast.
    public var defaultFeed: String
    public var reminders: ReminderSettings
    public var caregivers: [Caregiver]
    public var nightStart: Int
    public var nightEnd: Int

    public init(id: UUID = UUID(), name: String = "Our family", babyId: UUID = UUID(), babyName: String = "Baby",
                birthDate: Date? = nil, babies: [Baby]? = nil, bottleMl: Double = 120,
                categories: [String] = Array(EventRegistry.shared.defaultCategories).sorted(),
                defaultFeed: String = "bottle", reminders: ReminderSettings = .init(), caregivers: [Caregiver] = [],
                nightStart: Int = 21 * 60, nightEnd: Int = 7 * 60) {
        self.id = id
        self.name = name
        self.babies = babies ?? [Baby(id: babyId, name: babyName, birthDate: birthDate)]
        self.bottleMl = bottleMl
        self.categories = categories
        self.defaultFeed = defaultFeed
        self.reminders = reminders
        self.caregivers = caregivers
        self.nightStart = nightStart
        self.nightEnd = nightEnd
    }

    enum CodingKeys: String, CodingKey {
        case id, name, categories, reminders, caregivers, babies
        case babyId = "baby_id"
        case babyName = "baby_name"
        case birthDate = "birth_date"
        case bottleMl = "bottle_ml"
        case defaultFeed = "default_feed"
        case nightStart = "night_start"
        case nightEnd = "night_end"
    }

    /// Households saved before children were a list (and older servers) only have the first
    /// child's `baby_id`, `baby_name` and `birth_date`.
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(UUID.self, forKey: .id)
        name = try c.decode(String.self, forKey: .name)
        if let list = try c.decodeIfPresent([Baby].self, forKey: .babies), !list.isEmpty {
            babies = list.sorted { ($0.position, $0.name) < ($1.position, $1.name) }
        } else {
            babies = [Baby(id: try c.decode(UUID.self, forKey: .babyId), name: try c.decode(String.self, forKey: .babyName),
                           birthDate: try c.decodeIfPresent(Date.self, forKey: .birthDate))]
        }
        bottleMl = try c.decodeIfPresent(Double.self, forKey: .bottleMl) ?? 120
        categories = try c.decodeIfPresent([String].self, forKey: .categories) ?? Array(EventRegistry.shared.defaultCategories).sorted()
        defaultFeed = try c.decodeIfPresent(String.self, forKey: .defaultFeed) ?? "bottle"
        reminders = try c.decodeIfPresent(ReminderSettings.self, forKey: .reminders) ?? .init()
        caregivers = try c.decodeIfPresent([Caregiver].self, forKey: .caregivers) ?? []
        nightStart = try c.decodeIfPresent(Int.self, forKey: .nightStart) ?? 21 * 60
        nightEnd = try c.decodeIfPresent(Int.self, forKey: .nightEnd) ?? 7 * 60
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(id, forKey: .id)
        try c.encode(name, forKey: .name)
        try c.encode(babies, forKey: .babies)
        try c.encode(babyId, forKey: .babyId)
        try c.encode(babyName, forKey: .babyName)
        try c.encodeIfPresent(birthDate, forKey: .birthDate)
        try c.encode(bottleMl, forKey: .bottleMl)
        try c.encode(categories, forKey: .categories)
        try c.encode(defaultFeed, forKey: .defaultFeed)
        try c.encode(reminders, forKey: .reminders)
        try c.encode(caregivers, forKey: .caregivers)
        try c.encode(nightStart, forKey: .nightStart)
        try c.encode(nightEnd, forKey: .nightEnd)
    }

    /// Children that are not archived, in display order.
    public var active: [Baby] {
        let list = babies.filter { !$0.archived }
        return list.isEmpty ? Array(babies.prefix(1)) : list
    }

    /// The first child: what older surfaces and a log entry without a child default to.
    public var firstBaby: Baby { active[0] }
    public var babyId: UUID { firstBaby.id }
    public var babyName: String { firstBaby.name }
    public var birthDate: Date? { firstBaby.birthDate }

    public func baby(_ id: UUID?) -> Baby? { babies.first { $0.id == id } }
    public func babyName(_ id: UUID?) -> String { baby(id)?.name ?? babyName }
    public func bottleMl(for baby: UUID?) -> Double { self.baby(baby)?.bottleMl ?? bottleMl }
    public func defaultFeed(for baby: UUID?) -> String { self.baby(baby)?.defaultFeed ?? defaultFeed }

    /// "Mia", "Mia & Leo", "Mia, Leo & Ava".
    public static func names(_ babies: [Baby]) -> String {
        let n = babies.map(\.name)
        guard n.count > 1 else { return n.first ?? "" }
        return n.dropLast().joined(separator: ", ") + " & " + n.last!
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

    /// Amount in ml for a bottle entry: explicit ml wins, else fraction × the child's bottle size.
    public func milliliters(_ e: LogEvent) -> Double? {
        if let ml = e.number("consumed_ml") { return ml }
        if let f = e.number("consumed_fraction") { return (f * bottleMl(for: e.babyId)).rounded() }
        return nil
    }
}

// MARK: - Reminders

public struct PlannedReminder: Hashable, Sendable {
    public enum Kind: String, Sendable {
        case feed, diaper
        /// "Still going?": a session or timed activity open longer than its norm (forgot to stop).
        case stillFeeding, stillSleeping, stillActivity
    }
    public let kind: Kind
    public var baby: UUID? = nil
    public let fireAt: Date
    /// Second stage: phone sound after the overdue margin; the first stage is haptic / HUD only.
    public let escalated: Bool
    public let message: String
}

/// Pure reminder planning: given the log and settings, which reminders should this caregiver's
/// devices schedule? Logging the matching event changes the log and so cancels them.
public enum ReminderPlanner {
    /// One plan per child (`logs`: each child's derived log); duty is household-wide.
    public static func plan(logs: [(Baby, DerivedLog)], household: Household, me: UUID, now: Date,
                            snoozedUntil: [PlannedReminder.Kind: Date] = [:], calendar: Calendar = .current) -> [PlannedReminder] {
        logs.flatMap { baby, log in
            plan(log: log, household: household, me: me, now: now, snoozedUntil: snoozedUntil, calendar: calendar)
                .map { PlannedReminder(kind: $0.kind, baby: baby.id, fireAt: $0.fireAt, escalated: $0.escalated,
                                       message: logs.count > 1 ? "\(baby.name) · \($0.message)" : $0.message) }
        }
    }

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

        // "Still going?": one quiet nudge when something has run past its norm (spec sessionReminders,
        // a timed type's remindAfterMinutes), in case the parent forgot to end it. No escalation.
        func nudge(_ kind: PlannedReminder.Kind, since: Date, minutes: Int, text: String) {
            let due = since.addingTimeInterval(TimeInterval(minutes * 60))
            guard due > now.addingTimeInterval(-6 * 3600) else { return }   // long forgotten: don't nag on every refresh
            let first = max(due, now)
            if let snooze = snoozedUntil[kind], snooze > first { return }
            if log.duty?.caregiver == nil, let c = household.caregivers.first(where: { $0.id == me }), inQuiet(first, c, calendar) { return }
            out.append(PlannedReminder(kind: kind, fireAt: first, escalated: false, message: text))
        }
        let limits = EventRegistry.shared.sessionReminders
        if let s = log.openFeedSession(), let start = s.start, let m = limits[s.kind.rawValue] {
            let what = s.kind == .bottle ? "Still feeding? The bottle started" : "Still nursing? It started"
            nudge(.stillFeeding, since: start, minutes: m, text: "\(what) \(StatusSnapshot.duration(Double(m * 60))) ago. Finish it if it's over.")
        }
        if let s = log.openSession(.sleep), let start = s.start, let m = limits["sleep"], !household.isNight(start, calendar: calendar) {
            nudge(.stillSleeping, since: start, minutes: m,
                  text: "Still napping? \(StatusSnapshot.duration(Double(m * 60))) so far. Log the wake-up if they're up.")
        }
        for e in log.effective where e.fields["ongoing"] == .bool(true) {
            guard let t = EventRegistry.shared.type(e.type), let m = t.remindAfterMinutes else { continue }
            nudge(.stillActivity, since: e.occurredAt, minutes: m,
                  text: "\(t.label) has been going \(StatusSnapshot.duration(Double(m * 60))). Stop the timer if it's over.")
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
        var lines = ["occurred_at,child,type,details,ml,logged_by,surface,input,transcript,confidence_tier"]
        for e in log.effective where log.status[e.id] == .active {
            let ml = household.milliliters(e).map { String(Int($0)) } ?? ""
            let details = e.fields.keys.sorted().map { "\($0)=\(e.fields[$0]!)" }.joined(separator: " ")
            let cols = [LogCoding.isoString(e.occurredAt), household.babyName(e.babyId), e.type, details, ml, household.caregiverName(e.loggedBy),
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

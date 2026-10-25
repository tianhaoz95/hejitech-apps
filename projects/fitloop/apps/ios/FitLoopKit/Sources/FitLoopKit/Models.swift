import Foundation

// Swift mirrors of @fitloop/core's JSON (packages/core/src/types.ts and plan.ts). The agent writes
// plans, the Worker computes each day's state; the app shows them and sends check-ins.

public struct Macros: Codable, Hashable, Sendable {
    public var calories: Double?
    public var proteinG: Double?
    public var carbsG: Double?
    public var fatG: Double?

    enum CodingKeys: String, CodingKey {
        case calories
        case proteinG = "protein_g", carbsG = "carbs_g", fatG = "fat_g"
    }

    /// "680 kcal · 48 g protein".
    public var summary: String {
        [calories.map { "\(Int($0)) kcal" }, proteinG.map { "\(Int($0)) g protein" }, carbsG.map { "\(Int($0)) g carbs" }, fatG.map { "\(Int($0)) g fat" }]
            .compactMap { $0 }.joined(separator: " · ")
    }
}

/// reps are a number (10) or a range ("8-10").
public enum Reps: Codable, Hashable, Sendable {
    case count(Int)
    case range(String)

    public init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if let n = try? c.decode(Int.self) { self = .count(n) } else { self = .range(try c.decode(String.self)) }
    }
    public func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        switch self {
        case .count(let n): try c.encode(n)
        case .range(let s): try c.encode(s)
        }
    }
    public var text: String {
        switch self {
        case .count(let n): "\(n)"
        case .range(let s): s
        }
    }
    public var count: Int? { if case .count(let n) = self { n } else { nil } }
}

public struct Exercise: Codable, Hashable, Sendable, Identifiable {
    public var id: String
    public var name: String
    public var sets: Int
    public var reps: Reps?
    public var durationSec: Int?
    public var load: String?
    public var restSec: Int
    public var cues: [String]?
    public var instructions: String?
    public var alternative: String?
    public var videoUrl: String?

    enum CodingKeys: String, CodingKey {
        case id, name, sets, reps, load, cues, instructions, alternative
        case durationSec = "duration_sec", restSec = "rest_sec", videoUrl = "video_url"
    }

    /// "8-10 reps @ 24 kg", "45 s", "5 min @ easy" (same wording as core's setTarget).
    public var target: String {
        let amount: String? = reps.map { "\($0.text) reps" } ?? durationSec.map(Self.seconds)
        return [amount, load].compactMap { $0 }.joined(separator: " @ ")
    }

    public static func seconds(_ s: Int) -> String {
        if s < 60 { return "\(s) s" }
        return s % 60 == 0 ? "\(s / 60) min" : "\(s / 60):\(String(format: "%02d", s % 60))"
    }
}

public struct Workout: Codable, Hashable, Sendable, Identifiable {
    public var id: String
    public var title: String
    public var time: String?
    public var durationMin: Int
    public var kind: String
    public var exercises: [Exercise]
    public var notes: String?

    enum CodingKeys: String, CodingKey {
        case id, title, time, kind, exercises, notes
        case durationMin = "duration_min"
    }
}

public struct MealItem: Codable, Hashable, Sendable {
    public var name: String
    public var amount: String
}

public struct Meal: Codable, Hashable, Sendable, Identifiable {
    public var id: String
    public var name: String
    public var time: String?
    public var items: [MealItem]
    public var macros: Macros?
    public var prep: [String]?
    public var notes: String?
}

public struct DayPlan: Codable, Hashable, Sendable {
    public var title: String
    public var workouts: [Workout]
    public var meals: [Meal]
    public var notes: String?
}

public struct Goal: Codable, Hashable, Sendable, Identifiable {
    public var id: String
    public var text: String
    public var metric: String?
    public var target: Double?
    public var unit: String?
    public var by: String?
}

public struct Plan: Codable, Hashable, Sendable {
    public var title: String
    public var summary: String
    public var startsOn: String
    public var endsOn: String?
    public var goals: [Goal]
    public var constraints: [String]
    public var targets: Macros?
    public var week: [String: DayPlan]
    public var overrides: [String: DayPlan]?

    enum CodingKeys: String, CodingKey {
        case title, summary, goals, constraints, targets, week, overrides
        case startsOn = "starts_on", endsOn = "ends_on"
    }

    public static let weekdays = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
}

public struct PublishedPlan: Codable, Hashable, Sendable {
    public var version: Int
    public var plan: Plan
    public var changeNote: String
    public var publishedAt: String

    enum CodingKeys: String, CodingKey {
        case version, plan
        case changeNote = "change_note", publishedAt = "published_at"
    }
}

public struct PlanVersion: Codable, Hashable, Sendable, Identifiable {
    public var version: Int
    public var title: String
    public var changeNote: String
    public var startsOn: String
    public var id: Int { version }

    enum CodingKeys: String, CodingKey {
        case version, title
        case changeNote = "change_note", startsOn = "starts_on"
    }
}

public struct PlanResponse: Codable, Sendable {
    public var current: PublishedPlan?
    public var versions: [PlanVersion]
}

// MARK: - a day's state (computed by the Worker with core's dayState)

public struct ExerciseState: Codable, Hashable, Sendable, Identifiable {
    public var exercise: Exercise
    public var ref: String
    public var setsDone: Int
    /// todo, in_progress, done, skipped, swapped
    public var status: String
    public var id: String { ref }
}

public struct WorkoutState: Codable, Hashable, Sendable, Identifiable {
    public var workout: Workout
    public var ref: String
    public var exercises: [ExerciseState]
    /// todo, in_progress, done, skipped
    public var status: String
    public var setsDone: Int
    public var setsTotal: Int
    public var id: String { ref }

    /// Where to resume: the first exercise not done, and its next set (1-based).
    public var next: (exercise: Int, set: Int)? {
        for (i, e) in exercises.enumerated() where e.status == "todo" || e.status == "in_progress" { return (i, e.setsDone + 1) }
        return nil
    }
}

public struct MealState: Codable, Hashable, Sendable, Identifiable {
    public var meal: Meal
    public var ref: String
    /// todo, done, skipped, swapped
    public var status: String
    public var portion: String?
    public var id: String { ref }
}

public struct Nutrition: Codable, Hashable, Sendable {
    public var planned: Macros
    public var eaten: Macros
    public var targets: Macros
}

public struct DayState: Codable, Hashable, Sendable {
    public var date: String
    public var day: DayPlan?
    public var workouts: [WorkoutState]
    public var meals: [MealState]
    public var completion: Double
    public var nutrition: Nutrition
}

public struct PlanSummary: Codable, Hashable, Sendable {
    public var version: Int
    public var title: String
    public var changeNote: String

    enum CodingKeys: String, CodingKey {
        case version, title
        case changeNote = "change_note"
    }
}

public struct LiveHR: Codable, Hashable, Sendable {
    public var hr: Int?
}

public struct TodayResponse: Codable, Sendable {
    public var date: String
    public var plan: PlanSummary?
    public var state: DayState
    public var live: LiveHR?
}

// MARK: - check-ins, feedback, vitals

public struct CheckinData: Codable, Hashable, Sendable {
    public var reps: Int?
    public var load: String?
    public var durationSec: Int?
    public var rpe: Double?
    public var avgHr: Int?
    public var maxHr: Int?
    public var portion: String?
    public var swappedFor: String?
    public var movedTo: String?

    public init(reps: Int? = nil, load: String? = nil, durationSec: Int? = nil, rpe: Double? = nil, avgHr: Int? = nil, maxHr: Int? = nil, portion: String? = nil, swappedFor: String? = nil, movedTo: String? = nil) {
        self.reps = reps; self.load = load; self.durationSec = durationSec; self.rpe = rpe; self.avgHr = avgHr
        self.maxHr = maxHr; self.portion = portion; self.swappedFor = swappedFor; self.movedTo = movedTo
    }

    enum CodingKeys: String, CodingKey {
        case reps, load, rpe, portion
        case durationSec = "duration_sec", avgHr = "avg_hr", maxHr = "max_hr", swappedFor = "swapped_for", movedTo = "moved_to"
    }
}

public struct NewCheckin: Codable, Hashable, Sendable {
    public var date: String
    public var ref: String
    /// set, exercise, workout, meal
    public var kind: String
    /// done, partial, skipped, swapped
    public var status: String
    public var data: CheckinData?
    public var note: String?

    public init(date: String, ref: String, kind: String, status: String, data: CheckinData? = nil, note: String? = nil) {
        self.date = date; self.ref = ref; self.kind = kind; self.status = status; self.data = data; self.note = note
    }
}

public enum FeedbackTag: String, CaseIterable, Codable, Sendable, Identifiable {
    case tooEasy = "too_easy", tooHard = "too_hard", pain, noTime = "no_time", lovedIt = "loved_it", hungry, tooMuchFood = "too_much_food", other
    public var id: String { rawValue }
    public var label: String {
        switch self {
        case .tooEasy: "Too easy"
        case .tooHard: "Too hard"
        case .pain: "Pain or discomfort"
        case .noTime: "Not enough time"
        case .lovedIt: "Loved it"
        case .hungry: "Still hungry"
        case .tooMuchFood: "Too much food"
        case .other: "Other"
        }
    }
}

public struct Feedback: Codable, Hashable, Sendable, Identifiable {
    public var id: String
    public var date: String?
    public var ref: String?
    public var text: String
    public var tags: [String]
    public var status: String
    public var agentReply: String?
    public var createdAt: String
    public var source: String?

    enum CodingKeys: String, CodingKey {
        case id, date, ref, text, tags, status, source
        case agentReply = "agent_reply", createdAt = "created_at"
    }
}

public struct NewFeedback: Codable, Sendable {
    public var date: String?
    public var ref: String?
    public var text: String
    public var tags: [String]
    public init(date: String?, ref: String?, text: String, tags: [String]) { self.date = date; self.ref = ref; self.text = text; self.tags = tags }
}

public struct Vital: Codable, Hashable, Sendable {
    public var date: String
    public var metric: String
    public var value: Double
    /// health, manual, watch
    public var source: String
    public init(date: String, metric: String, value: Double, source: String) { self.date = date; self.metric = metric; self.value = value; self.source = source }
}

public struct AdherenceDay: Codable, Hashable, Sendable, Identifiable {
    public var date: String
    public var completion: Double
    public var workoutsDone: Int
    public var workoutsPlanned: Int
    public var mealsDone: Int
    public var mealsPlanned: Int
    public var id: String { date }

    enum CodingKeys: String, CodingKey {
        case date, completion
        case workoutsDone = "workouts_done", workoutsPlanned = "workouts_planned", mealsDone = "meals_done", mealsPlanned = "meals_planned"
    }
}

public struct Count: Codable, Hashable, Sendable { public var done: Int; public var planned: Int }

public struct Adherence: Codable, Hashable, Sendable {
    public var days: [AdherenceDay]
    public var average: Double
    public var workouts: Count
    public var meals: Count
    public var streak: Int
}

public struct ProgressResponse: Codable, Sendable {
    public var adherence: Adherence
    public var vitals: [Vital]
}

public struct Photo: Codable, Hashable, Sendable, Identifiable {
    public var id: String
    public var takenOn: String
    public var note: String?
    public var url: String?
    enum CodingKeys: String, CodingKey { case id, note, url; case takenOn = "taken_on" }
}

// MARK: - settings (every option is the user's switch)

public struct Settings: Codable, Hashable, Sendable {
    public struct Vitals: Codable, Hashable, Sendable {
        public var liveHr: Bool, healthDaily: Bool, manual: Bool, photos: Bool
        enum CodingKeys: String, CodingKey { case manual, photos; case liveHr = "live_hr", healthDaily = "health_daily" }
    }
    public struct AgentAccess: Codable, Hashable, Sendable { public var vitals: Bool, photos: Bool, feedback: Bool, checkins: Bool }
    public struct Reminders: Codable, Hashable, Sendable {
        public struct Workout: Codable, Hashable, Sendable {
            public var on: Bool, minutesBefore: Int
            enum CodingKeys: String, CodingKey { case on; case minutesBefore = "minutes_before" }
        }
        public struct Toggle: Codable, Hashable, Sendable { public var on: Bool }
        public struct Timed: Codable, Hashable, Sendable { public var on: Bool, time: String }
        public struct Weekly: Codable, Hashable, Sendable { public var on: Bool, weekday: String, time: String }
        public var workout: Workout, meals: Toggle, evening: Timed, weekly: Weekly
    }
    public struct Glasses: Codable, Hashable, Sendable {
        public var showHr: Bool, autoRestTimer: Bool
        enum CodingKeys: String, CodingKey { case showHr = "show_hr", autoRestTimer = "auto_rest_timer" }
    }
    public struct About: Codable, Hashable, Sendable { public var goals: String, restrictions: String, equipment: String, schedule: String, diet: String, notes: String }

    public var units: String
    public var timezone: String
    public var vitals: Vitals
    public var agentAccess: AgentAccess
    public var reminders: Reminders
    public var glasses: Glasses
    public var about: About

    enum CodingKeys: String, CodingKey {
        case units, timezone, vitals, reminders, glasses, about
        case agentAccess = "agent_access"
    }

    public static let defaults = Settings(
        units: "metric", timezone: TimeZone.current.identifier,
        vitals: Vitals(liveHr: true, healthDaily: true, manual: true, photos: false),
        agentAccess: AgentAccess(vitals: true, photos: false, feedback: true, checkins: true),
        reminders: Reminders(workout: .init(on: true, minutesBefore: 10), meals: .init(on: true), evening: .init(on: true, time: "21:00"), weekly: .init(on: true, weekday: "sun", time: "18:00")),
        glasses: Glasses(showHr: true, autoRestTimer: true),
        about: About(goals: "", restrictions: "", equipment: "", schedule: "", diet: "", notes: ""))
}

public struct SettingsResponse: Codable, Sendable {
    public var settings: Settings
    public var saved: Bool
    public var email: String?
}

public struct PairingCode: Codable, Sendable {
    public var code: String
    public var expiresAt: String
    enum CodingKeys: String, CodingKey { case code; case expiresAt = "expires_at" }
}

public struct PairedDevice: Codable, Identifiable, Hashable, Sendable {
    public var id: String
    public var label: String
    public var lastUsedAt: String?
    enum CodingKeys: String, CodingKey { case id, label; case lastUsedAt = "last_used_at" }
}

// MARK: - dates

public enum Day {
    /// The local date "YYYY-MM-DD".
    public static func string(_ date: Date = Date(), calendar: Calendar = .current) -> String {
        let c = calendar.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", c.year!, c.month!, c.day!)
    }

    public static func date(_ s: String, calendar: Calendar = .current) -> Date? {
        let p = s.split(separator: "-").compactMap { Int($0) }
        guard p.count == 3 else { return nil }
        return calendar.date(from: DateComponents(year: p[0], month: p[1], day: p[2], hour: 12))
    }

    public static func adding(_ days: Int, to s: String, calendar: Calendar = .current) -> String {
        guard let d = date(s, calendar: calendar), let n = calendar.date(byAdding: .day, value: days, to: d) else { return s }
        return string(n, calendar: calendar)
    }

    /// "HH:MM" → (hour, minute).
    public static func time(_ hhmm: String?) -> (Int, Int)? {
        guard let p = hhmm?.split(separator: ":").compactMap({ Int($0) }), p.count == 2, (0..<24).contains(p[0]), (0..<60).contains(p[1]) else { return nil }
        return (p[0], p[1])
    }

    /// mon … sun for a date.
    public static func weekday(_ s: String, calendar: Calendar = .current) -> String {
        guard let d = date(s, calendar: calendar) else { return "mon" }
        let w = calendar.component(.weekday, from: d) // 1 = Sunday
        return Plan.weekdays[(w + 5) % 7]
    }
}

import AppIntents
import FitLoopKit
import Foundation

// Siri, Shortcuts, Spotlight and the Action button: start today's workout, log a meal, leave the
// agent a note, hear what's left today. They run in the app with the signed-in account.
// No "Apple" anywhere in these strings (App Review rejects the build: ITMS-90626).

enum FitLoopIntentError: Error, CustomLocalizedStringResourceConvertible {
    case signedOut, notMember, nothingPlanned, noSuchMeal, failed(String)

    var localizedStringResource: LocalizedStringResource {
        switch self {
        case .signedOut: "Open FitLoop and sign in first."
        case .notMember: "This needs FitLoop Pro. Open FitLoop to start your free week."
        case .nothingPlanned: "There's nothing left to do on today's plan."
        case .noSuchMeal: "That meal isn't on today's plan."
        case .failed(let why): "FitLoop couldn't do that: \(why)"
        }
    }
}

@MainActor
enum IntentSupport {
    /// The app's model, signed in and showing today, or an error Siri can say.
    static func today() async throws -> AppModel {
        let m = AppModel.shared
        if m.phase == .launching { await m.start() }
        guard m.phase == .ready else { throw FitLoopIntentError.signedOut }
        if !Membership.shared.isMember {
            await Membership.shared.refresh()
            if !Membership.shared.isMember { await Membership.shared.lookUpAccount() }
            guard Membership.shared.isMember else { throw FitLoopIntentError.notMember }
        }
        if m.date != Day.string() || m.today?.state.date != Day.string() {
            m.date = Day.string()
            await m.refresh()
        }
        guard m.today != nil else { throw FitLoopIntentError.failed(m.error ?? "no connection") }
        return m
    }
}

// MARK: start today's workout

struct StartWorkoutIntent: AppIntent {
    static let title: LocalizedStringResource = "Start Today's Workout"
    static let description = IntentDescription("Opens the next workout on today's plan in the FitLoop player.")
    static let openAppWhenRun = true

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog {
        let m = try await IntentSupport.today()
        guard let w = m.today?.state.workouts.first(where: { $0.status == "todo" || $0.status == "in_progress" }) else {
            throw FitLoopIntentError.nothingPlanned
        }
        m.pendingWorkout = w.ref
        return .result(dialog: "Starting \(w.workout.title).")
    }
}

// MARK: log a meal

struct MealEntity: AppEntity {
    static let typeDisplayRepresentation: TypeDisplayRepresentation = "Meal"
    static let defaultQuery = MealQuery()

    let id: String
    let name: String
    let detail: String

    var displayRepresentation: DisplayRepresentation { DisplayRepresentation(title: "\(name)", subtitle: "\(detail)") }

    init(_ m: MealState) {
        id = m.ref
        name = m.meal.name
        detail = m.meal.time ?? (m.status == "todo" ? "To do" : m.status.capitalized)
    }
}

struct MealQuery: EntityQuery {
    @MainActor
    func entities(for identifiers: [String]) async throws -> [MealEntity] {
        let m = try await IntentSupport.today()
        return m.today?.state.meals.filter { identifiers.contains($0.ref) }.map(MealEntity.init) ?? []
    }

    @MainActor
    func suggestedEntities() async throws -> [MealEntity] {
        let m = try await IntentSupport.today()
        return m.today?.state.meals.map(MealEntity.init) ?? []
    }
}

enum MealPortion: String, AppEnum {
    case less, asPlanned = "as_planned", more
    static let typeDisplayRepresentation: TypeDisplayRepresentation = "Portion"
    static let caseDisplayRepresentations: [MealPortion: DisplayRepresentation] = [.less: "Less", .asPlanned: "As planned", .more: "More"]
}

struct LogMealIntent: AppIntent {
    static let title: LocalizedStringResource = "Log a Meal"
    static let description = IntentDescription("Checks off a meal on today's FitLoop plan, with how much you ate.")

    @Parameter(title: "Meal", description: "Leave it empty for the next meal still to do.")
    var meal: MealEntity?

    @Parameter(title: "Portion", default: .asPlanned)
    var portion: MealPortion

    static var parameterSummary: some ParameterSummary { Summary("Log \(\.$meal), \(\.$portion)") }

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog {
        let m = try await IntentSupport.today()
        let meals = m.today?.state.meals ?? []
        let target: MealState
        if let meal {
            guard let found = meals.first(where: { $0.ref == meal.id }) else { throw FitLoopIntentError.noSuchMeal }
            target = found
        } else {
            guard let next = meals.first(where: { $0.status == "todo" }) else { throw FitLoopIntentError.nothingPlanned }
            target = next
        }
        m.error = nil
        await m.checkin(NewCheckin(date: m.date, ref: target.ref, kind: "meal", status: "done", data: CheckinData(portion: portion.rawValue)))
        if let e = m.error { throw FitLoopIntentError.failed(e) }
        return .result(dialog: "Logged \(target.meal.name.lowercased()).")
    }
}

// MARK: a note for the agent

enum NoteTag: String, AppEnum {
    case tooEasy = "too_easy", tooHard = "too_hard", pain, noTime = "no_time", lovedIt = "loved_it", hungry, tooMuchFood = "too_much_food", other
    static let typeDisplayRepresentation: TypeDisplayRepresentation = "Tag"
    static let caseDisplayRepresentations: [NoteTag: DisplayRepresentation] = [
        .tooEasy: "Too easy", .tooHard: "Too hard", .pain: "Pain or discomfort", .noTime: "Not enough time",
        .lovedIt: "Loved it", .hungry: "Still hungry", .tooMuchFood: "Too much food", .other: "Other",
    ]
}

struct NoteForAgentIntent: AppIntent {
    static let title: LocalizedStringResource = "Leave a Note for My Coach"
    static let description = IntentDescription("Leaves a note for the AI agent that writes your FitLoop plan. It reads your notes before changing the plan.")

    @Parameter(title: "Note", requestValueDialog: "What should your coach know?")
    var text: String

    @Parameter(title: "Tag")
    var tag: NoteTag?

    static var parameterSummary: some ParameterSummary { Summary("Tell my coach \(\.$text)") { \.$tag } }

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog {
        let m = try await IntentSupport.today()
        let tags = [FeedbackTag(rawValue: (tag ?? .other).rawValue) ?? .other]
        guard await m.sendFeedback(ref: nil, text: text, tags: tags) else { throw FitLoopIntentError.failed(m.error ?? "not sent") }
        return .result(dialog: "Saved for your coach.")
    }
}

// MARK: what's left today

struct TodayStatusIntent: AppIntent {
    static let title: LocalizedStringResource = "What's Left Today"
    static let description = IntentDescription("Says how far along today's FitLoop plan you are and what's next.")

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog {
        let m = try await IntentSupport.today()
        guard let s = m.today?.state else { throw FitLoopIntentError.nothingPlanned }
        return .result(dialog: "\(Self.summary(s))")
    }

    static func summary(_ s: DayState) -> String {
        if s.workouts.isEmpty && s.meals.isEmpty { return "Nothing is planned today." }
        var parts = ["You're \(Int((s.completion * 100).rounded()))% through today."]
        let workoutsLeft = s.workouts.filter { $0.status == "todo" || $0.status == "in_progress" }
        let mealsLeft = s.meals.filter { $0.status == "todo" }
        if let w = workoutsLeft.first { parts.append("Next workout: \(w.workout.title)\(w.workout.time.map { " at \($0)" } ?? "").") }
        else if !s.workouts.isEmpty { parts.append("Workouts are done.") }
        if let meal = mealsLeft.first { parts.append("\(mealsLeft.count) meal\(mealsLeft.count == 1 ? "" : "s") left, next \(meal.meal.name.lowercased())\(meal.meal.time.map { " at \($0)" } ?? "").") }
        else if !s.meals.isEmpty { parts.append("Every meal is logged.") }
        return parts.joined(separator: " ")
    }
}

// MARK: shortcuts (Siri phrases, Spotlight, the Action button)

struct FitLoopShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(intent: StartWorkoutIntent(), phrases: [
            "Start my \(.applicationName) workout", "Start today's workout in \(.applicationName)",
        ], shortTitle: "Start Workout", systemImageName: "figure.strengthtraining.traditional")
        AppShortcut(intent: LogMealIntent(), phrases: [
            "Log a meal in \(.applicationName)", "Log my meal in \(.applicationName)",
        ], shortTitle: "Log Meal", systemImageName: "fork.knife")
        AppShortcut(intent: NoteForAgentIntent(), phrases: [
            "Tell my \(.applicationName) coach", "Leave a note in \(.applicationName)",
        ], shortTitle: "Note for Coach", systemImageName: "bubble.left")
        AppShortcut(intent: TodayStatusIntent(), phrases: [
            "What's left today in \(.applicationName)", "How's my day in \(.applicationName)",
        ], shortTitle: "What's Left", systemImageName: "checklist")
    }
}

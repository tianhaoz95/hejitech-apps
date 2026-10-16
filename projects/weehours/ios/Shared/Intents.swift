import AppIntents
import Foundation
import LogCore

// App Intents used by Siri, Shortcuts, the Action Button and interactive widget / Live Activity
// buttons. They write through the same LogService as the app (typed, validated, local-first).

enum DiaperKindOption: String, AppEnum {
    case wet, dirty, both, dry
    static let typeDisplayRepresentation: TypeDisplayRepresentation = "Diaper kind"
    static let caseDisplayRepresentations: [DiaperKindOption: DisplayRepresentation] = [
        .wet: "Wet", .dirty: "Dirty", .both: "Wet and dirty", .dry: "Dry",
    ]
}

enum AmountOption: String, AppEnum {
    case quarter, half, threeQuarters, full
    static let typeDisplayRepresentation: TypeDisplayRepresentation = "Amount drunk"
    static let caseDisplayRepresentations: [AmountOption: DisplayRepresentation] = [
        .quarter: "A quarter", .half: "Half", .threeQuarters: "Three quarters", .full: "All of it",
    ]
    var fraction: Double { [.quarter: 0.25, .half: 0.5, .threeQuarters: 0.75, .full: 1][self]! }
}

private func run(_ surface: Surface, _ body: (LogService) async throws -> LogEvent?) async throws -> String {
    let service = try SharedStore.service()
    let e = try await body(service)
    await SharedStore.publish(from: service)
    let line = SharedStore.snapshot?.line(now: Date()) ?? ""
    guard let e else { return line }
    return "\(VoiceInterpreter.label(type: e.type, fields: e.fields)). \(line)"
}

struct ToggleFeedIntent: AppIntent, LiveActivityIntent {
    static let title: LocalizedStringResource = "Start or finish a feed"
    static let description = IntentDescription("Finishes the open feed, or starts your default feed.")
    func perform() async throws -> some IntentResult & ProvidesDialog {
        .result(dialog: "\(try await run(.widget) { try await $0.toggleFeed(surface: .widget) })")
    }
}

struct FinishBottleIntent: AppIntent, LiveActivityIntent {
    static let title: LocalizedStringResource = "Finish bottle"
    @Parameter(title: "Amount drunk") var amount: AmountOption?
    init() {}
    init(amount: AmountOption) { self.amount = amount }
    func perform() async throws -> some IntentResult & ProvidesDialog {
        let fields: [String: FieldValue] = amount.map { ["consumed_fraction": .number($0.fraction)] } ?? [:]
        return .result(dialog: "\(try await run(.siri) { try await $0.log(type: "feed.bottle.finish", fields: fields, provenance: Provenance(surface: .siri, input: .voice)) })")
    }
}

struct LogDiaperIntent: AppIntent {
    static let title: LocalizedStringResource = "Log a diaper"
    @Parameter(title: "Kind") var kind: DiaperKindOption
    init() {}
    init(kind: DiaperKindOption) { self.kind = kind }
    func perform() async throws -> some IntentResult & ProvidesDialog {
        .result(dialog: "\(try await run(.widget) { try await $0.log(type: "diaper", fields: ["kind": .string(kind.rawValue)], provenance: Provenance(surface: .widget, input: .tap)) })")
    }
}

struct ToggleSleepIntent: AppIntent, LiveActivityIntent {
    static let title: LocalizedStringResource = "Baby fell asleep or woke up"
    func perform() async throws -> some IntentResult & ProvidesDialog {
        .result(dialog: "\(try await run(.widget) { try await $0.toggleSleep(surface: .widget) })")
    }
}

struct SwitchSideIntent: AppIntent, LiveActivityIntent {
    static let title: LocalizedStringResource = "Switch breast side"
    func perform() async throws -> some IntentResult & ProvidesDialog {
        .result(dialog: "\(try await run(.widget) { try await $0.switchSide(surface: .widget) })")
    }
}

struct StatusIntent: AppIntent {
    static let title: LocalizedStringResource = "What's next for the baby"
    static let description = IntentDescription("Time since the last feed, next side and last diaper.")
    func perform() async throws -> some IntentResult & ProvidesDialog & ReturnsValue<String> {
        let line = try await run(.siri) { _ in nil }
        return .result(value: line, dialog: "\(line)")
    }
}

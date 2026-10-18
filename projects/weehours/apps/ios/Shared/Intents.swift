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

/// A child in the household, for Siri ("Log a diaper for Leo"), Shortcuts and widget settings.
struct ChildEntity: AppEntity {
    static let typeDisplayRepresentation: TypeDisplayRepresentation = "Child"
    static let defaultQuery = ChildQuery()
    let id: UUID
    let name: String
    var displayRepresentation: DisplayRepresentation { DisplayRepresentation(title: "\(name)") }

    init(_ baby: Baby) {
        id = baby.id
        name = baby.name
    }
}

struct ChildQuery: EntityQuery {
    func entities(for identifiers: [UUID]) async throws -> [ChildEntity] {
        (SharedStore.household?.babies ?? []).filter { identifiers.contains($0.id) }.map(ChildEntity.init)
    }

    func suggestedEntities() async throws -> [ChildEntity] {
        SharedStore.household.map { SharedStore.shown($0).map(ChildEntity.init) } ?? []
    }
}

/// The child an intent acts on: the one given, else the only shown child; with several and none
/// given, Siri asks.
private func resolve(_ child: IntentParameter<ChildEntity?>) async throws -> UUID {
    if let c = child.wrappedValue { return c.id }
    guard let h = SharedStore.household else { throw SharedStore.SharedError.notSetUp }
    let shown = SharedStore.shown(h)
    if shown.count == 1 { return shown[0].id }
    throw child.needsValueError("Which child?")
}

private func run(_ surface: Surface, baby: UUID? = nil, _ body: (LogService) async throws -> LogEvent?) async throws -> String {
    let service = try SharedStore.service()
    let e = try await body(service)
    await SharedStore.publish(from: service)
    let status = baby.flatMap { SharedStore.snapshots[$0] } ?? SharedStore.snapshot
    let line = status?.line(now: Date()) ?? ""
    let h = await service.household
    let name = h.active.count > 1 ? h.babyName(baby) + ": " : ""
    guard let e else { return name + line }
    return "\(VoiceInterpreter.label(type: e.type, fields: e.fields)). \(name)\(line)"
}

struct ToggleFeedIntent: AppIntent, LiveActivityIntent {
    static let title: LocalizedStringResource = "Start or finish a feed"
    static let description = IntentDescription("Finishes the open feed, or starts your default feed.")
    @Parameter(title: "Child") var child: ChildEntity?
    init() {}
    init(child: ChildEntity?) { self.child = child }
    func perform() async throws -> some IntentResult & ProvidesDialog {
        let baby = try await resolve($child)
        return .result(dialog: "\(try await run(.widget, baby: baby) { try await $0.toggleFeed(baby: baby, surface: .widget) })")
    }
}

struct FinishBottleIntent: AppIntent, LiveActivityIntent {
    static let title: LocalizedStringResource = "Finish bottle"
    @Parameter(title: "Amount drunk") var amount: AmountOption?
    @Parameter(title: "Child") var child: ChildEntity?
    init() {}
    init(amount: AmountOption, child: ChildEntity? = nil) { self.amount = amount; self.child = child }
    func perform() async throws -> some IntentResult & ProvidesDialog {
        let baby = try await resolve($child)
        let fields: [String: FieldValue] = amount.map { ["consumed_fraction": .number($0.fraction)] } ?? [:]
        return .result(dialog: "\(try await run(.siri, baby: baby) { try await $0.log(type: "feed.bottle.finish", fields: fields, provenance: Provenance(surface: .siri, input: .voice), baby: baby) })")
    }
}

struct LogDiaperIntent: AppIntent {
    static let title: LocalizedStringResource = "Log a diaper"
    @Parameter(title: "Kind") var kind: DiaperKindOption
    @Parameter(title: "Child") var child: ChildEntity?
    init() {}
    init(kind: DiaperKindOption, child: ChildEntity? = nil) { self.kind = kind; self.child = child }
    func perform() async throws -> some IntentResult & ProvidesDialog {
        let baby = try await resolve($child)
        return .result(dialog: "\(try await run(.widget, baby: baby) { try await $0.log(type: "diaper", fields: ["kind": .string(kind.rawValue)], provenance: Provenance(surface: .widget, input: .tap), baby: baby) })")
    }
}

struct ToggleSleepIntent: AppIntent, LiveActivityIntent {
    static let title: LocalizedStringResource = "Baby fell asleep or woke up"
    @Parameter(title: "Child") var child: ChildEntity?
    init() {}
    init(child: ChildEntity?) { self.child = child }
    func perform() async throws -> some IntentResult & ProvidesDialog {
        let baby = try await resolve($child)
        return .result(dialog: "\(try await run(.widget, baby: baby) { try await $0.toggleSleep(baby: baby, surface: .widget) })")
    }
}

struct SwitchSideIntent: AppIntent, LiveActivityIntent {
    static let title: LocalizedStringResource = "Switch breast side"
    @Parameter(title: "Child") var child: ChildEntity?
    init() {}
    init(child: ChildEntity?) { self.child = child }
    func perform() async throws -> some IntentResult & ProvidesDialog {
        let baby = try await resolve($child)
        return .result(dialog: "\(try await run(.widget, baby: baby) { try await $0.switchSide(baby: baby, surface: .widget) })")
    }
}

struct StatusIntent: AppIntent {
    static let title: LocalizedStringResource = "What's next for the baby"
    static let description = IntentDescription("Time since the last feed, next side and last diaper.")
    @Parameter(title: "Child") var child: ChildEntity?
    func perform() async throws -> some IntentResult & ProvidesDialog & ReturnsValue<String> {
        if child == nil, let h = SharedStore.household, SharedStore.shown(h).count > 1 {
            // no child named: every shown child's line
            let line = SharedStore.shown(h).map { b in "\(b.name): \(SharedStore.snapshots[b.id]?.line(now: Date()) ?? "")" }.joined(separator: ". ")
            return .result(value: line, dialog: "\(line)")
        }
        let baby = try await resolve($child)
        let line = try await run(.siri, baby: baby) { _ in nil }
        return .result(value: line, dialog: "\(line)")
    }
}

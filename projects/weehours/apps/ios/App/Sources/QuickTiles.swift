import LogCore
import SwiftUI

/// Now's log buttons. Each is its own item on Now (`NowItem.tile`), placed anywhere among the cards
/// and two to a row (`NowFlow`). A key names a place, not a button: "bottle" is Start bottle or
/// Finish bottle, whichever applies, and with several children it can be both at once.
enum QuickTiles {
    /// The buttons this household can have, in their default order.
    static func available(_ h: Household) -> [String] {
        var keys: [String] = []
        if h.active.contains(where: \.isExpected) { keys += ["moved", "kicks"] }
        guard h.active.contains(where: { !$0.isExpected }) else { return keys }
        if h.enabled.contains("bottle") { keys.append("bottle") }
        if h.enabled.contains("breast") { keys += ["nursing", "switchSide"] }
        if h.enabled.contains("solids") { keys.append("solids") }
        if h.enabled.contains("diaper") { keys.append("diaper") }
        if h.enabled.contains("sleep") { keys.append("sleep") }
        if h.enabled.contains("pumping") { keys.append("pumping") }
        if h.enabled.contains("growth") { keys += Growth.types.map { "growth.\($0)" } }
        keys += care(h).map { "care.\($0.id)" }
        return keys
    }

    static func care(_ h: Household) -> [EventRegistry.EventType] {
        Care.types(enabled: h.enabled).filter { $0.category != Baby.movementCategory }
    }

    /// For arranging and VoiceOver, whatever the button says right now.
    static func title(_ key: String) -> String {
        switch key {
        case "moved": "Baby moved"
        case "kicks": "Count kicks"
        case "bottle": "Bottle"
        case "nursing": "Nursing"
        case "switchSide": "Switch side"
        case "solids": "Solids"
        case "diaper": "Diaper"
        case "sleep": "Sleep"
        case "pumping": "Pumped"
        default:
            if key.hasPrefix("growth.") { Growth.title(String(key.dropFirst(7))) }
            else if key.hasPrefix("care."), let t = EventRegistry.shared.type(String(key.dropFirst(5))) { t.label }
            else { key }
        }
    }

    static func icon(_ key: String) -> String {
        switch key {
        case "moved": "hand.point.up.left.fill"
        case "kicks": "timer"
        case "bottle": "waterbottle.fill"
        case "nursing": "heart.fill"
        case "switchSide": "arrow.left.arrow.right"
        case "solids": "fork.knife"
        case "diaper": "humidity.fill"
        case "sleep": "moon.zzz.fill"
        case "pumping": "drop.triangle.fill"
        default:
            if key.hasPrefix("growth.") { Growth.icon(String(key.dropFirst(7))) }
            else if key.hasPrefix("care.") { EventRegistry.shared.type(String(key.dropFirst(5)))?.icon ?? "circle.fill" }
            else { "circle.fill" }
        }
    }

    /// When the button is there at all, for the ones that come and go.
    static func note(_ key: String) -> String? {
        switch key {
        case "moved", "kicks": "When logging for a child not born yet"
        case "switchSide": "While nursing"
        default: "When logging for a child already born"
        }
    }
}

/// The children Now's buttons act on (the Log-for target), sorted by what each is doing.
struct QuickContext {
    let expecting: [UUID]
    let targets: [UUID]
    let logs: [(UUID, DerivedLog)]
    let bottles: [(UUID, Session)]
    let nursing: [(UUID, Session)]
    let idle: [UUID]
    let asleep: [UUID]
    let awake: [UUID]
    var many: Bool { targets.count > 1 }

    @MainActor init(_ model: AppModel) {
        let h = model.household
        // children not born yet get only the pregnancy tiles; the newborn buttons are for the rest
        expecting = model.target.filter { h.baby($0)?.isExpected == true }
        let targets = model.target.filter { h.baby($0)?.isExpected != true }
        self.targets = targets
        logs = targets.map { ($0, model.logs[$0] ?? DerivedLog(events: [])) }
        let feeding = logs.compactMap { id, log in log.openFeedSession().map { (id, $0) } }
        idle = logs.filter { $0.1.openFeedSession() == nil }.map(\.0)
        bottles = feeding.filter { $0.1.kind == .bottle }
        nursing = feeding.filter { $0.1.kind == .breast }
        let asleep = logs.filter { $0.1.openSession(.sleep) != nil }.map(\.0)
        self.asleep = asleep
        awake = targets.filter { !asleep.contains($0) }
    }
}

/// One of Now's log buttons, or two when children need different ones (Finish bottle for the one
/// feeding, Start bottle for the other). `single` keeps it to one while arranging. The buttons act
/// on the Log-for target: each applies to the children it makes sense for, one entry per child.
struct QuickTileView: View {
    @EnvironmentObject var model: AppModel
    let key: String
    var single = false
    @State private var sheet = false
    /// Start bottle tapped while another caregiver said they're making one.
    @State private var confirmingBottle: [UUID]?

    var body: some View {
        let c = QuickContext(model)
        let h = model.household
        Group {
            switch key {
            case "moved":
                if !c.expecting.isEmpty { BabyMovedTile(babies: c.expecting) }
            case "kicks":
                if !c.expecting.isEmpty { CountKicksTile(babies: c.expecting) }
            default:
                if !c.targets.isEmpty { newborn(key, c, h) }
            }
        }
        .nowTile()
    }

    @ViewBuilder private func newborn(_ key: String, _ c: QuickContext, _ h: Household) -> some View {
        switch key {
        case "bottle":
            if !c.bottles.isEmpty { finishBottle(c, h) }
            if !c.idle.isEmpty, !(single && !c.bottles.isEmpty) {
                ActionTile(title: c.idle.count > 1 ? "Start bottles" : "Start bottle", subtitle: bottleText(c.idle), icon: "waterbottle.fill", color: Theme.feed,
                           action: {
                    if model.partnerPrepping(for: c.idle) != nil { confirmingBottle = c.idle } else { model.log("feed.bottle.start", for: c.idle) }
                }, backdate: { at in model.log("feed.bottle.start", at: at, for: c.idle) },
                           announce: model.localOnly ? nil : { model.announcePreppingBottle(for: c.idle) })
                .confirmationDialog(confirmTitle, isPresented: Binding { confirmingBottle != nil } set: { if !$0 { confirmingBottle = nil } },
                                    titleVisibility: .visible) {
                    Button("Start my bottle anyway") { if let ids = confirmingBottle { model.log("feed.bottle.start", for: ids) } }
                    Button("Cancel", role: .cancel) {}
                }
            }
        case "nursing":
            if !c.nursing.isEmpty {
                let ids = c.nursing.map(\.0)
                ActionTile(title: "Finish nursing", subtitle: c.many ? names(ids) : c.nursing[0].1.sides.last.map { "on \($0)" } ?? "", icon: "heart.fill", color: Theme.feed,
                           action: { model.log("feed.breast.finish", for: ids) },
                           backdate: { at in model.log("feed.breast.finish", at: at, for: ids) })
            }
            if !c.idle.isEmpty, !(single && !c.nursing.isEmpty) { startNursing(c.idle) }
        case "switchSide":
            if !c.nursing.isEmpty {
                let ids = c.nursing.map(\.0)
                ActionTile(title: "Switch side", subtitle: c.many ? names(ids) : "to \(c.nursing[0].1.sides.last == "left" ? "right" : "left")",
                           icon: "arrow.left.arrow.right", color: Theme.feed) {
                    model.performEach(ids) { s, baby, group in try s.switchSide(baby: baby, surface: .phone, fields: group) }
                }
            }
        case "solids":
            let summary = (c.logs.first?.1 ?? model.log).solidsSummary()
            let triedAllergens = summary.allergenCounts.values.filter { $0 > 0 }.count
            Button { sheet = true } label: {
                Tile(title: "Solids", subtitle: summary.triedFoods.isEmpty ? "first foods & reactions" : "\(summary.triedFoods.count) foods · \(triedAllergens)/9 allergens",
                     icon: "fork.knife", color: Theme.feed)
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("solidsTile")
            .sheet(isPresented: $sheet) { SolidsSheet().presentationDetents([.medium, .large]) }
        case "diaper":
            Menu {
                ForEach(["wet", "dirty", "both", "dry"], id: \.self) { k in
                    Button(k.capitalized) { model.log("diaper", ["kind": .string(k)]) }
                }
                Divider()
                Menu("Changed earlier…") {
                    ForEach([5, 10, 15, 30], id: \.self) { mins in
                        Button("Wet · \(mins) min ago") { model.log("diaper", ["kind": .string("wet")], at: Date().addingTimeInterval(-Double(mins * 60))) }
                        Button("Dirty · \(mins) min ago") { model.log("diaper", ["kind": .string("dirty")], at: Date().addingTimeInterval(-Double(mins * 60))) }
                        Button("Both · \(mins) min ago") { model.log("diaper", ["kind": .string("both")], at: Date().addingTimeInterval(-Double(mins * 60))) }
                    }
                }
            } label: { Tile(title: c.many ? "Diapers" : "Diaper", subtitle: "wet · dirty · both", icon: "humidity.fill", color: Theme.diaper) }
        case "sleep":
            if !c.awake.isEmpty {
                ActionTile(title: "Fell asleep", subtitle: c.many ? names(c.awake) : "start sleep", icon: "moon.zzz.fill", color: Theme.sleep,
                           action: { model.log("sleep.start", for: c.awake) },
                           backdate: { at in model.log("sleep.start", at: at, for: c.awake) })
            }
            if !c.asleep.isEmpty, !(single && !c.awake.isEmpty) {
                ActionTile(title: "Woke up", subtitle: c.many ? names(c.asleep) : "end sleep", icon: "sun.max.fill", color: Theme.sleep,
                           action: { model.log("sleep.end", for: c.asleep) },
                           backdate: { at in model.log("sleep.end", at: at, for: c.asleep) })
            }
        case "pumping":
            // pumping is the parent's: one entry, filed under the first child logged for
            if h.trackMilkStash {
                Button { sheet = true } label: {
                    Tile(title: "Pumped", subtitle: "amount & stash", icon: "drop.triangle.fill", color: Theme.other)
                }
                .buttonStyle(.plain)
                .sheet(isPresented: $sheet) { PumpSheet().presentationDetents([.medium]) }
            } else {
                ActionTile(title: "Pumped", subtitle: "both sides", icon: "drop.triangle.fill", color: Theme.other,
                           action: { model.log("pump", ["side": .string("both")], for: Array(c.targets.prefix(1))) },
                           backdate: { at in model.log("pump", ["side": .string("both")], at: at, for: Array(c.targets.prefix(1))) })
            }
        default:
            if key.hasPrefix("growth.") {
                let type = String(key.dropFirst(7))
                Button { sheet = true } label: {
                    Tile(title: Growth.title(type), subtitle: growthText(type, c.logs) ?? "tap to log",
                         icon: Growth.icon(type), color: Theme.growth)
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("growthTile-\(type)")
                .sheet(isPresented: $sheet) { GrowthSheet(type: type, babies: model.targetBabies).presentationDetents([.medium, .large]) }
                .onAppear {   // automation: `-screen growth` opens the weight sheet (screenshots)
                    if type == "weight", model.screen == "growth" { model.screen = "home"; sheet = true }
                }
            } else if key.hasPrefix("care."), let type = QuickTiles.care(h).first(where: { "care.\($0.id)" == key }) {
                CareTile(type: type)
            }
        }
    }

    private func finishBottle(_ c: QuickContext, _ h: Household) -> some View {
        let ids = c.bottles.map(\.0)
        return Menu {
            ForEach([(0.25, "A quarter"), (0.5, "Half"), (0.75, "Three quarters"), (1.0, "All of it")], id: \.0) { f, label in
                Button(label) { model.log("feed.bottle.finish", ["consumed_fraction": .number(f)], for: ids) }
            }
            if h.trackMilkStash {
                Divider()
                Menu("Used breast milk from fridge") {
                    ForEach([(0.5, "Half"), (0.75, "Three quarters"), (1.0, "All of it")], id: \.0) { f, label in
                        Button(label) { model.log("feed.bottle.finish", ["consumed_fraction": .number(f), "contents": .string("breast_milk")], for: ids) }
                    }
                }
            }
            Divider()
            Menu("Ended earlier…") {
                ForEach([5, 10, 15, 30], id: \.self) { mins in
                    Button("\(mins) min ago (All)") {
                        model.log("feed.bottle.finish", ["consumed_fraction": .number(1.0)], at: Date().addingTimeInterval(-Double(mins * 60)), for: ids)
                    }
                }
            }
            Button("Not sure") { model.log("feed.bottle.finish", for: ids) }
        } label: {
            Tile(title: ids.count > 1 ? "Finish bottles" : "Finish bottle",
                 subtitle: c.many ? names(ids) : "since \(c.bottles[0].1.start?.formatted(date: .omitted, time: .shortened) ?? "")",
                 icon: "waterbottle.fill", color: Theme.feed)
        }
    }

    private func startNursing(_ idle: [UUID]) -> some View {
        ActionTile(title: "Start nursing", subtitle: sideText(idle), icon: "heart.fill", color: Theme.feed,
                   action: {
            model.performEach(idle) { s, baby, group in
                let side = StatusSnapshot(log: try s.derived(baby: baby), now: Date()).nextSide ?? "left"
                return try s.log(type: "feed.breast.start", fields: ["side": .string(side)].merging(group) { $1 },
                                 provenance: Provenance(surface: .phone, input: .tap), baby: baby)
            }
        }, backdate: { at in
            model.performEach(idle) { s, baby, group in
                let side = StatusSnapshot(log: try s.derived(baby: baby), now: Date()).nextSide ?? "left"
                return try s.log(type: "feed.breast.start", fields: ["side": .string(side)].merging(group) { $1 },
                                 occurredAt: at, provenance: Provenance(surface: .phone, input: .tap), baby: baby)
            }
        })
    }

    private func names(_ ids: [UUID]) -> String { Household.names(ids.compactMap { model.household.baby($0) }) }

    private var confirmTitle: String {
        let who = confirmingBottle.flatMap { model.partnerPrepping(for: $0) }.map { model.household.caregiverName($0.caregiver) } ?? "Someone"
        return "\(who) is making a bottle"
    }

    /// "120 ml", or each child's size when they differ ("Mia 90 · Leo 110 ml").
    private func bottleText(_ ids: [UUID]) -> String {
        let h = model.household
        let sizes = ids.map { Int(h.bottleMl(for: $0)) }
        if Set(sizes).count <= 1 { return "\(sizes.first ?? Int(h.bottleMl)) ml" }
        return zip(ids, sizes).map { "\(h.babyName($0)) \($1)" }.joined(separator: " · ") + " ml"
    }

    private func sideText(_ ids: [UUID]) -> String {
        let sides = ids.map { model.statuses[$0]?.nextSide ?? "left" }
        if ids.count == 1 { return "\(sides[0]) side" }
        return zip(ids, sides).map { "\(model.household.babyName($0)) \($1)" }.joined(separator: " · ")
    }

    private func growthText(_ type: String, _ logs: [(UUID, DerivedLog)]) -> String? {
        if logs.count == 1 { return Growth.latestText(type, in: logs[0].1) }
        let parts = logs.compactMap { id, log in Growth.latestText(type, in: log).map { "\(model.household.babyName(id)) \($0)" } }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }
}

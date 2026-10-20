import LogCore
import SwiftUI

// MARK: - Night mode (Settings → Night mode, per phone)

/// The dim night screen: off, always on, or on a schedule (23:00–06:00 by default), like the
/// system's warm-screen schedules. Per phone: each caregiver chooses their own.
enum NightMode: String, CaseIterable, Identifiable {
    case off, on, scheduled
    static let key = "nightMode"
    static let fromKey = "nightFrom"     // minutes after midnight
    static let toKey = "nightTo"
    static let tintKey = "nightTint"
    static let defaultFrom = 23 * 60
    static let defaultTo = 6 * 60
    var id: String { rawValue }
    var title: String { [.off: "Off", .on: "Always", .scheduled: "Scheduled"][self]! }

    static func isActive(_ mode: NightMode, from: Int, to: Int, now: Date = Date()) -> Bool {
        switch mode {
        case .off: return false
        case .on: return true
        case .scheduled:
            let c = Calendar.current.dateComponents([.hour, .minute], from: now)
            let m = (c.hour ?? 0) * 60 + (c.minute ?? 0)
            return from <= to ? (m >= from && m < to) : (m >= from || m < to)   // usually wraps midnight
        }
    }
}

/// Warm amber, or a deep red that disturbs night vision least.
enum NightTint: String, CaseIterable, Identifiable {
    case amber, red
    var id: String { rawValue }
    var title: String { rawValue.capitalized }
    var color: Color { self == .amber ? Color(red: 1.0, green: 0.62, blue: 0.17) : Color(red: 0.86, green: 0.16, blue: 0.13) }
}

/// Minutes after midnight as a Date today, for DatePickers.
extension Binding where Value == Int {
    var asTime: Binding<Date> {
        Binding<Date>(get: {
            Calendar.current.date(bySettingHour: wrappedValue / 60, minute: wrappedValue % 60, second: 0, of: Date()) ?? Date()
        }, set: { d in
            let c = Calendar.current.dateComponents([.hour, .minute], from: d)
            wrappedValue = (c.hour ?? 0) * 60 + (c.minute ?? 0)
        })
    }
}

// MARK: - What the quick buttons can do right now (Night HUD, thumb dock)

/// The Log-for target's state, as the quick buttons on Now see it.
struct QuickState {
    let bottles: [UUID]      // children with an open bottle
    let nursing: [UUID]      // … an open nursing session
    let idle: [UUID]         // … no open feed
    let asleep: [UUID]
    let awake: [UUID]
    let nursingSide: String? // the side being nursed on (one child)
    let since: Date?         // the open feed or sleep, for a timer

    @MainActor init(_ model: AppModel) {
        let logs = model.target.map { ($0, model.logs[$0] ?? DerivedLog(events: [])) }
        let feeding = logs.compactMap { id, log in log.openFeedSession().map { (id, $0) } }
        bottles = feeding.filter { $0.1.kind == .bottle }.map(\.0)
        nursing = feeding.filter { $0.1.kind == .breast }.map(\.0)
        idle = logs.filter { $0.1.openFeedSession() == nil }.map(\.0)
        let sleeping = logs.filter { $0.1.openSession(.sleep) != nil }.map(\.0)
        asleep = sleeping
        awake = model.target.filter { !sleeping.contains($0) }
        nursingSide = feeding.first { $0.1.kind == .breast }?.1.sides.last
        since = feeding.first?.1.start ?? logs.compactMap { $0.1.openSession(.sleep)?.start }.first
    }
}

extension AppModel {
    func startNursing(_ ids: [UUID]) {
        performEach(ids) { s, baby, group in
            let side = StatusSnapshot(log: try s.derived(baby: baby), now: Date()).nextSide ?? "left"
            return try s.log(type: "feed.breast.start", fields: ["side": .string(side)].merging(group) { $1 },
                             provenance: Provenance(surface: .phone, input: .tap), baby: baby)
        }
    }

    func switchSide(_ ids: [UUID]) {
        performEach(ids) { s, baby, group in try s.switchSide(baby: baby, surface: .phone, fields: group) }
    }

    /// The default feed for these children (each child's own override, else the household's).
    func startDefaultFeed(_ ids: [UUID]) {
        let breast = ids.filter { (household.baby($0)?.defaultFeed ?? household.defaultFeed) == "breast" && household.enabled.contains("breast") }
        let bottle = ids.filter { !breast.contains($0) }
        if !bottle.isEmpty { log("feed.bottle.start", for: bottle) }
        if !breast.isEmpty { startNursing(breast) }
    }
}

// MARK: - Night HUD

/// The night screen: true black, warm amber or red text, and four big buttons for the things
/// done at 3 AM. Swipe down or tap "Full app" to get the normal screens back.
struct NightHUD: View {
    @EnvironmentObject var model: AppModel
    let tint: NightTint
    let dismiss: () -> Void
    @State private var now = Date()
    @State private var drag: CGFloat = 0
    private let tick = Timer.publish(every: 30, on: .main, in: .common).autoconnect()

    var body: some View {
        let color = tint.color
        let q = QuickState(model)
        let h = model.household
        VStack(spacing: 18) {
            HStack {
                Text(Household.names(model.targetBabies)).font(.headline).foregroundStyle(color.opacity(0.7))
                Spacer()
                Button(action: dismiss) {
                    Label("Full app", systemImage: "chevron.down").font(.subheadline.weight(.semibold))
                        .padding(.horizontal, 14).padding(.vertical, 8)
                        .overlay(Capsule().strokeBorder(color.opacity(0.4)))
                }
                .accessibilityIdentifier("nightExit")
            }
            VStack(alignment: .leading, spacing: 6) {
                Text(statusLine).font(.title2.weight(.semibold)).fixedSize(horizontal: false, vertical: true)
                    .accessibilityIdentifier("nightStatus")
                if let since = q.since {
                    Text(since, style: .timer).font(.system(size: 44, weight: .bold, design: .rounded).monospacedDigit())
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            LazyVGrid(columns: [GridItem(.flexible(), spacing: 14), GridItem(.flexible(), spacing: 14)], spacing: 14) {
                feedButton(q, h)
                secondButton(q, h)
                Menu {
                    ForEach(["wet", "dirty", "both"], id: \.self) { k in Button(k.capitalized) { model.log("diaper", ["kind": .string(k)]) } }
                } label: { tile("Diaper", "wet · dirty · both", "humidity.fill") }
                .accessibilityIdentifier("nightDiaper")
                if !q.asleep.isEmpty {
                    Button { model.log("sleep.end", for: q.asleep) } label: { tile("Woke up", "end sleep", "sun.max.fill") }
                } else {
                    Button { model.log("sleep.start", for: q.awake.isEmpty ? model.target : q.awake) } label: { tile("Asleep", "start sleep", "moon.zzz.fill") }
                }
            }
            .buttonStyle(.plain)
            Spacer(minLength: 0)
            Button { model.startVoice() } label: {
                Image(systemName: "mic.fill").font(.system(size: 30)).frame(width: 76, height: 76)
                    .overlay(Circle().strokeBorder(color.opacity(0.55), lineWidth: 2))
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Speak a log entry")
            Text("Swipe down for the full app").font(.caption).foregroundStyle(color.opacity(0.45))
        }
        .padding(20)
        .foregroundStyle(color)
        .background(Color(red: 0.02, green: 0.02, blue: 0.02).ignoresSafeArea())
        .offset(y: max(0, drag))
        .gesture(DragGesture().onChanged { drag = $0.translation.height }.onEnded { v in
            if v.translation.height > 120 { dismiss() }
            withAnimation(.snappy) { drag = 0 }
        })
        .sensoryFeedback(.success, trigger: model.toast?.id)
        .onReceive(tick) { now = $0 }
        .accessibilityIdentifier("nightHUD")
    }

    private var statusLine: String {
        let babies = model.targetBabies
        if babies.count == 1 { return model.statuses[babies[0].id]?.line(now: now) ?? "…" }
        return babies.map { "\($0.name): \(model.statuses[$0.id]?.line(now: now).components(separatedBy: " · ").first ?? "")" }.joined(separator: "\n")
    }

    @ViewBuilder private func feedButton(_ q: QuickState, _ h: Household) -> some View {
        if !q.bottles.isEmpty {
            Menu {
                ForEach([(1.0, "All of it"), (0.75, "Three quarters"), (0.5, "Half"), (0.25, "A quarter")], id: \.0) { f, label in
                    Button(label) { model.log("feed.bottle.finish", ["consumed_fraction": .number(f)], for: q.bottles) }
                }
                Button("Not sure") { model.log("feed.bottle.finish", for: q.bottles) }
            } label: { tile("Finish bottle", "how much?", "waterbottle.fill") }
        } else if !q.nursing.isEmpty {
            Button { model.log("feed.breast.finish", for: q.nursing) } label: { tile("Finish nursing", q.nursingSide.map { "on \($0)" } ?? "", "heart.fill") }
        } else if h.enabled.contains("bottle") {
            Button { model.log("feed.bottle.start", for: q.idle) } label: { tile("Bottle", "start", "waterbottle.fill") }
                .accessibilityIdentifier("nightBottle")
        } else {
            Button { model.startNursing(q.idle) } label: { tile("Nurse", sideText, "heart.fill") }
        }
    }

    @ViewBuilder private func secondButton(_ q: QuickState, _ h: Household) -> some View {
        if !q.nursing.isEmpty {
            Button { model.switchSide(q.nursing) } label: {
                tile("Switch", q.nursingSide.map { "to \($0 == "left" ? "right" : "left")" } ?? "side", "arrow.left.arrow.right")
            }
        } else if q.bottles.isEmpty, h.enabled.contains("breast"), h.enabled.contains("bottle") {
            Button { model.startNursing(q.idle) } label: { tile("Nurse", sideText, "heart.fill") }
        } else {
            Menu {
                Button("Wet · 5 min ago") { model.log("diaper", ["kind": .string("wet")], at: Date().addingTimeInterval(-300)) }
                Button("Dirty · 5 min ago") { model.log("diaper", ["kind": .string("dirty")], at: Date().addingTimeInterval(-300)) }
            } label: { tile("Earlier", "diaper 5 min ago", "clock.arrow.circlepath") }
        }
    }

    private var sideText: String {
        model.target.count == 1 ? "\(model.statuses[model.target[0]]?.nextSide ?? "left") side" : "next sides"
    }

    private func tile(_ title: String, _ subtitle: String, _ icon: String) -> some View {
        VStack(spacing: 8) {
            Image(systemName: icon).font(.system(size: 34))
            Text(title).font(.title3.weight(.bold))
            Text(subtitle).font(.footnote).opacity(0.6).lineLimit(1)
        }
        .frame(maxWidth: .infinity, minHeight: 150)
        .background(tint.color.opacity(0.10), in: RoundedRectangle(cornerRadius: 24))
        .overlay(RoundedRectangle(cornerRadius: 24).strokeBorder(tint.color.opacity(0.28), lineWidth: 1))
        .contentShape(RoundedRectangle(cornerRadius: 24))
    }
}

// MARK: - One-handed thumb dock (Settings → One-handed dock, per phone)

enum ThumbDock: String, CaseIterable, Identifiable {
    case off, right, left
    static let key = "thumbDock"
    var id: String { rawValue }
    var title: String { [.off: "Off", .right: "Right hand", .left: "Left hand"][self]! }
    var placement: VoiceButtonPlacement { self == .left ? .left : .right }
    /// How much of the bottom of Now the dock covers.
    static let clearance: CGFloat = 190
}

/// Four buttons on an arc around the mic, where the thumb rests while the other arm holds the baby.
struct ThumbDockView: View {
    @EnvironmentObject var model: AppModel
    let side: ThumbDock
    @State private var taps = 0
    private let radius: CGFloat = 128

    var body: some View {
        let q = QuickState(model)
        ZStack {
            item(0) { feed(q) }
            item(1) {
                if !q.nursing.isEmpty {
                    circle("arrow.left.arrow.right", "Switch") { model.switchSide(q.nursing) }
                } else {
                    Menu {
                        ForEach([5, 10, 15, 30], id: \.self) { m in
                            Button("Fed \(m) min ago") {
                                taps += 1
                                let at = Date().addingTimeInterval(-Double(m * 60))
                                model.log(model.household.defaultFeed == "breast" ? "feed.breast.start" : "feed.bottle.start", at: at, for: q.idle)
                            }
                        }
                    } label: { face("clock.arrow.circlepath", "Earlier") }
                }
            }
            item(2) {
                Menu {
                    ForEach(["wet", "dirty", "both", "dry"], id: \.self) { k in
                        Button(k.capitalized) { taps += 1; model.log("diaper", ["kind": .string(k)]) }
                    }
                } label: { face("humidity.fill", "Diaper", color: Theme.diaper) }
            }
            item(3) {
                if !q.asleep.isEmpty {
                    circle("sun.max.fill", "Woke", color: Theme.sleep) { model.log("sleep.end", for: q.asleep) }
                } else {
                    circle("moon.zzz.fill", "Asleep", color: Theme.sleep) { model.log("sleep.start", for: q.awake.isEmpty ? model.target : q.awake) }
                }
            }
        }
        .frame(width: VoiceButton.size, height: VoiceButton.size)
        .sensoryFeedback(.impact(weight: .medium), trigger: taps)
        .accessibilityIdentifier("thumbDock")
    }

    /// Button `i` of four, from straight up (0) to straight across (3), around the mic.
    private func item<Content: View>(_ i: Int, @ViewBuilder _ content: () -> Content) -> some View {
        let angle = Double.pi / 2 + Double(i) * Double.pi / 6
        let dx = CGFloat(cos(angle)) * radius * (side == .left ? -1 : 1)
        return content().offset(x: dx, y: -CGFloat(sin(angle)) * radius)
    }

    @ViewBuilder private func feed(_ q: QuickState) -> some View {
        if !q.bottles.isEmpty {
            Menu {
                ForEach([(1.0, "All of it"), (0.75, "Three quarters"), (0.5, "Half"), (0.25, "A quarter")], id: \.0) { f, label in
                    Button(label) { taps += 1; model.log("feed.bottle.finish", ["consumed_fraction": .number(f)], for: q.bottles) }
                }
            } label: { face("waterbottle.fill", "Finish", color: Theme.feed) }
        } else if !q.nursing.isEmpty {
            circle("heart.fill", "Finish", color: Theme.feed) { model.log("feed.breast.finish", for: q.nursing) }
        } else {
            circle(model.household.defaultFeed == "breast" ? "heart.fill" : "waterbottle.fill", "Feed", color: Theme.feed) { model.startDefaultFeed(q.idle) }
        }
    }

    private func circle(_ icon: String, _ label: String, color: Color = Theme.accent, action: @escaping () -> Void) -> some View {
        Button { taps += 1; action() } label: { face(icon, label, color: color) }
            .buttonStyle(.plain)
    }

    private func face(_ icon: String, _ label: String, color: Color = Theme.accent) -> some View {
        VStack(spacing: 2) {
            Image(systemName: icon).font(.system(size: 20, weight: .semibold))
            Text(label).font(.system(size: 10, weight: .semibold)).lineLimit(1)
        }
        .foregroundStyle(color)
        .frame(width: 60, height: 60)
        .background(.regularMaterial, in: Circle())
        .overlay(Circle().strokeBorder(color.opacity(0.5), lineWidth: 1.5))
        .shadow(color: .black.opacity(0.15), radius: 6, y: 3)
        .contentShape(Circle())
        .accessibilityLabel(label)
    }
}

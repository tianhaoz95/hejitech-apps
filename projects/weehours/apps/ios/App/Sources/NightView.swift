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
}

/// The mic with four actions behind it, where the thumb rests while the other arm holds the baby.
/// A tap speaks as always. Press and hold and the actions fan out on an arc around the mic; slide
/// onto one and let go to log it. One with choices (diaper kind, how much of the bottle, how long
/// ago) asks with a short list after you let go. Hidden the rest of the time, so they don't cover Now.
struct ThumbDockView: View {
    @EnvironmentObject var model: AppModel
    let side: ThumbDock
    @State private var open = false
    @State private var hover: Int?
    @State private var pressed: Date?
    @State private var choices: Choices?
    @State private var taps = 0
    private let radius: CGFloat = 128
    private static let holdToOpen: Duration = .milliseconds(300)

    struct Choices: Identifiable {
        let id = UUID()
        let title: String
        let options: [(label: String, run: () -> Void)]
    }

    /// An action on the arc: logged right away, or a list to pick from.
    struct Action {
        let icon: String
        let label: String
        var color: Color = Theme.accent
        var run: (() -> Void)?
        var choices: Choices?
    }

    var body: some View {
        let actions = self.actions(QuickState(model))
        ZStack {
            if open {
                ForEach(actions.indices, id: \.self) { i in
                    face(actions[i].icon, actions[i].label, color: actions[i].color)
                        .scaleEffect(hover == i ? 1.18 : 1)
                        .offset(offset(i))
                        .transition(.scale(scale: 0.3, anchor: .center).combined(with: .opacity))
                        .accessibilityHidden(true)
                }
            }
            VoiceButton().allowsHitTesting(false)
            Circle().fill(.clear).frame(width: VoiceButton.size, height: VoiceButton.size)
                .contentShape(Circle())
                .gesture(press(actions))
        }
        .frame(width: VoiceButton.size, height: VoiceButton.size)
        .animation(.snappy(duration: 0.2), value: open)
        .animation(.snappy(duration: 0.12), value: hover)
        .sensoryFeedback(.impact(weight: .medium), trigger: taps)
        .sensoryFeedback(.selection, trigger: hover) { _, new in new != nil }
        .sensoryFeedback(.impact(weight: .light), trigger: open) { _, new in new }
        .confirmationDialog(choices?.title ?? "", isPresented: Binding(get: { choices != nil }, set: { if !$0 { choices = nil } }),
                            titleVisibility: .visible, presenting: choices) { c in
            ForEach(c.options.indices, id: \.self) { i in Button(c.options[i].label) { taps += 1; c.options[i].run() } }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Speak a log entry")
        .accessibilityHint("Actions has feed, diaper and sleep.")
        .accessibilityAddTraits(.isButton)
        .accessibilityAction { model.startVoice() }
        .accessibilityActions {
            ForEach(actions.indices, id: \.self) { i in
                Button(actions[i].label) { perform(actions[i]) }
            }
        }
        .accessibilityIdentifier("voiceButton")
    }

    /// One drag from the first touch: let go before the hold opens the arc and it's a tap (speak);
    /// after, it logs the action under the thumb, or nothing when let go elsewhere.
    private func press(_ actions: [Action]) -> some Gesture {
        DragGesture(minimumDistance: 0)
            .onChanged { v in
                guard !model.thinking else { return }
                if pressed == nil {
                    let started = Date()
                    pressed = started
                    Task {
                        try? await Task.sleep(for: Self.holdToOpen)
                        if pressed == started { open = true }
                    }
                }
                if open { hover = target(v.translation, count: actions.count) }
            }
            .onEnded { v in
                defer { pressed = nil; open = false; hover = nil }
                guard !model.thinking else { return }
                if !open {
                    if hypot(v.translation.width, v.translation.height) < 20 { model.startVoice() }
                } else if let i = target(v.translation, count: actions.count) {
                    perform(actions[i])
                }
            }
    }

    private func perform(_ a: Action) {
        if let run = a.run { taps += 1; run() } else { choices = a.choices }
    }

    /// The action whose button is nearest the thumb, within reach of it.
    private func target(_ t: CGSize, count: Int) -> Int? {
        let near = (0..<count).map { i -> (Int, CGFloat) in
            let o = offset(i)
            return (i, hypot(t.width - o.width, t.height - o.height))
        }.min { $0.1 < $1.1 }
        return near.flatMap { $0.1 < 48 ? $0.0 : nil }
    }

    /// Button `i` of four, from straight up (0) to straight across (3), around the mic.
    private func offset(_ i: Int) -> CGSize {
        let angle = Double.pi / 2 + Double(i) * Double.pi / 6
        return CGSize(width: CGFloat(cos(angle)) * radius * (side == .left ? -1 : 1), height: -CGFloat(sin(angle)) * radius)
    }

    private func actions(_ q: QuickState) -> [Action] {
        let model = self.model
        let breast = model.household.defaultFeed == "breast"
        let feed: Action
        if !q.bottles.isEmpty {
            feed = Action(icon: "waterbottle.fill", label: "Finish", color: Theme.feed, choices: Choices(title: "How much did they drink?", options:
                [(1.0, "All of it"), (0.75, "Three quarters"), (0.5, "Half"), (0.25, "A quarter")].map { f, label in
                    (label, { model.log("feed.bottle.finish", ["consumed_fraction": .number(f)], for: q.bottles) })
                }))
        } else if !q.nursing.isEmpty {
            feed = Action(icon: "heart.fill", label: "Finish", color: Theme.feed) { model.log("feed.breast.finish", for: q.nursing) }
        } else {
            feed = Action(icon: breast ? "heart.fill" : "waterbottle.fill", label: "Feed", color: Theme.feed) { model.startDefaultFeed(q.idle) }
        }
        let earlier = !q.nursing.isEmpty
            ? Action(icon: "arrow.left.arrow.right", label: "Switch") { model.switchSide(q.nursing) }
            : Action(icon: "clock.arrow.circlepath", label: "Earlier", choices: Choices(title: "Fed how long ago?", options:
                [5, 10, 15, 30].map { m in
                    ("Fed \(m) min ago", { model.log(breast ? "feed.breast.start" : "feed.bottle.start", at: Date().addingTimeInterval(-Double(m * 60)), for: q.idle) })
                }))
        let diaper = Action(icon: "humidity.fill", label: "Diaper", color: Theme.diaper, choices: Choices(title: "Diaper", options:
            ["wet", "dirty", "both", "dry"].map { k in (k.capitalized, { model.log("diaper", ["kind": .string(k)]) }) }))
        let sleep = !q.asleep.isEmpty
            ? Action(icon: "sun.max.fill", label: "Woke", color: Theme.sleep) { model.log("sleep.end", for: q.asleep) }
            : Action(icon: "moon.zzz.fill", label: "Asleep", color: Theme.sleep) { model.log("sleep.start", for: q.awake.isEmpty ? model.target : q.awake) }
        return [feed, earlier, diaper, sleep]
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

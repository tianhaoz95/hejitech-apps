import FeedbackKit
import LogCore
import SwiftUI

struct MainView: View {
    @EnvironmentObject var model: AppModel
    @AppStorage(VoiceButtonPlacement.key) private var placement = VoiceButtonPlacement.right
    @State private var showingWhatsNew = WhatsNewView.shouldShowAutomatically

    var body: some View {
        TabView(selection: $model.screen) {
            HomeView().fabClearance().tabItem { Label("Now", systemImage: "moon.stars.fill") }.tag("home")
            TimelineView().fabClearance().tabItem { Label("Timeline", systemImage: "list.bullet.rectangle") }.tag("timeline")
            SettingsView().fabClearance().tabItem { Label("Settings", systemImage: "gearshape.fill") }.tag("settings")
            if model.screen == "paywall" || model.screen == "agents" {
                NavigationStack { if model.screen == "paywall" { PaywallView() } else { AgentsView() } }
                    .tabItem { Label("More", systemImage: "ellipsis") }.tag(model.screen)
            }
        }
        .sheet(item: $model.reviewing) { capture in
            ReviewSheet(capture: capture).presentationDetents([.medium, .large])
        }
        .sheet(isPresented: $showingWhatsNew) { WhatsNewView() }
        .overlay(alignment: placement.alignment) { if !model.recording { VoiceButton().padding(.horizontal, 20).padding(.bottom, 64) } }
        .overlay(alignment: .bottom) { ToastView().padding(placement.toastClearance).padding(.bottom, 64) }
        .overlay { if model.recording { ListeningView().transition(.opacity) } }
        .animation(.easeInOut(duration: 0.25), value: model.recording)
        .onChange(of: model.screen, initial: true) { _, screen in FeedbackKit.currentScreen = screen }
        .task { if model.screen == "listening" { model.screen = "home"; model.startVoice() } }
        .onChange(of: model.reviews) { _, reviews in
            if model.screen == "review", model.reviewing == nil, let first = reviews.first {
                model.reviewing = first
                model.screen = "home"
            }
        }
    }
}

struct HomeView: View {
    @EnvironmentObject var model: AppModel
    @State private var now = Date()
    private let tick = Timer.publish(every: 30, on: .main, in: .common).autoconnect()

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    // one shown child: today's single status card; several: the Log-for panel
                    if model.shown.count > 1 { ChildrenPanel(now: now) } else { StatusCard(now: now) }
                    if !model.reviews.isEmpty || !model.log.duplicates.isEmpty { ReviewBanner() }
                    QuickActions()
                }
                .padding()
            }
            .navigationTitle(title)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    if let birth { Text(Self.age(birth)).font(.subheadline).foregroundStyle(.secondary) }
                }
            }
            .refreshable { await model.syncNow() }
            .onReceive(tick) { now = $0 }
        }
    }

    /// The shown children's names; folded, the ones being logged for. Four or more: the household.
    private var title: String {
        let babies = model.shown.count > 1 && model.collapsed ? model.targetBabies : model.shown
        return babies.count > 3 ? model.household.name : Household.names(babies)
    }

    /// The age shown next to the title, when every child in it shares a birthday (one child, twins).
    private var birth: Date? {
        let babies = model.shown.count > 1 && model.collapsed ? model.targetBabies : model.shown
        let days = Set(babies.compactMap { $0.birthDate.map { Calendar.current.startOfDay(for: $0) } })
        return days.count == 1 && babies.allSatisfy { $0.birthDate != nil } ? days.first : nil
    }

    static func age(_ birth: Date) -> String {
        let days = Calendar.current.dateComponents([.day], from: birth, to: Date()).day ?? 0
        return days == 1 ? "1 day" : days < 14 ? "\(days) days" : days < 120 ? "\(days / 7) weeks" : "\(days / 30) months"
    }
}

struct StatusCard: View {
    @EnvironmentObject var model: AppModel
    let now: Date

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(model.status?.line(now: now) ?? "…")
                .font(.title3.weight(.semibold))
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityIdentifier("statusLine")
            DutyRow()
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.card, in: RoundedRectangle(cornerRadius: 18))
    }
}

/// Who is on duty (household-wide, for every child) and the hand-off button.
struct DutyRow: View {
    @EnvironmentObject var model: AppModel

    var body: some View {
        HStack(spacing: 8) {
            let onDuty = model.log.duty?.caregiver
            Image(systemName: onDuty == nil ? "person.2" : "person.fill.checkmark")
            Text(onDuty == nil ? "Nobody on duty · reminders go to everyone" : "\(model.household.caregiverName(onDuty)) is on duty")
            Spacer()
            Button(onDuty == model.me ? "Hand off" : "I've got it") { model.setOnDuty(onDuty != model.me) }
                .buttonStyle(.bordered).controlSize(.small)
        }
        .font(.footnote)
        .foregroundStyle(.secondary)
    }
}

// MARK: - Several children: status per child and the Log-for bar

/// Every shown child's status side by side, and "Log for" choosing who the buttons below log
/// for. Folds to one line for a long stretch with one child.
struct ChildrenPanel: View {
    @EnvironmentObject var model: AppModel
    let now: Date
    private let columns = [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)]

    var body: some View {
        if model.collapsed {
            Button { withAnimation(.snappy) { model.collapsed = false } } label: { folded }
                .buttonStyle(.plain)
                .accessibilityIdentifier("logForFolded")
        } else {
            VStack(alignment: .leading, spacing: 12) {
                LazyVGrid(columns: columns, spacing: 10) {
                    ForEach(model.shown) { b in
                        ChildCard(baby: b, status: model.statuses[b.id], selected: model.target.contains(b.id), now: now)
                            .onTapGesture { withAnimation(.snappy) { model.setTarget([b.id]) } }
                    }
                }
                DutyRow().padding(.horizontal, 4)
                LogForBar()
            }
        }
    }

    private var folded: some View {
        let targets = model.targetBabies
        let line = targets.count == 1
            ? model.statuses[targets[0].id]?.line(now: now) ?? ""
            : targets.map { "\($0.name): \(model.statuses[$0.id]?.line(now: now).components(separatedBy: " · ").first ?? "")" }.joined(separator: " · ")
        return HStack(spacing: 12) {
            HStack(spacing: -4) {
                ForEach(targets) { b in Circle().fill(Theme.color(for: b, in: model.household)).frame(width: 14, height: 14).overlay(Circle().stroke(Color(.systemBackground), lineWidth: 2)) }
            }
            VStack(alignment: .leading, spacing: 2) {
                Text("Logging for \(Household.names(targets))").font(.subheadline.weight(.semibold))
                Text(line).font(.caption).foregroundStyle(.secondary).lineLimit(2)
            }
            Spacer()
            Image(systemName: "chevron.down").font(.footnote.weight(.semibold)).foregroundStyle(.secondary)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.card, in: RoundedRectangle(cornerRadius: 18))
    }
}

struct ChildCard: View {
    @EnvironmentObject var model: AppModel
    let baby: Baby
    let status: StatusSnapshot?
    let selected: Bool
    let now: Date

    var body: some View {
        let color = Theme.color(for: baby, in: model.household)
        let parts = (status?.line(now: now) ?? "…").components(separatedBy: " · ")
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 6) {
                Circle().fill(color).frame(width: 9, height: 9)
                Text(baby.name).font(.subheadline.weight(.semibold)).lineLimit(1)
                Spacer(minLength: 0)
            }
            Text(parts[0]).font(.headline).lineLimit(2).fixedSize(horizontal: false, vertical: true)
            if parts.count > 1 {
                Text(parts.dropFirst().joined(separator: " · ")).font(.caption).foregroundStyle(.secondary).lineLimit(2)
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, minHeight: 96, alignment: .topLeading)
        .background(selected ? color.opacity(0.14) : Theme.card, in: RoundedRectangle(cornerRadius: 18))
        .overlay(RoundedRectangle(cornerRadius: 18).strokeBorder(selected ? color : .clear, lineWidth: 2))
        .contentShape(RoundedRectangle(cornerRadius: 18))
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(selected ? [.isButton, .isSelected] : .isButton)
        .accessibilityIdentifier("child-\(baby.name)")
    }
}

/// "Log for  Mia | Leo | Both": any number of children, plus everyone at once.
struct LogForBar: View {
    @EnvironmentObject var model: AppModel

    var body: some View {
        let all = model.shown.map(\.id)
        HStack(spacing: 8) {
            Text("Log for").font(.footnote.weight(.semibold)).foregroundStyle(.secondary).padding(.leading, 6)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 4) {
                    ForEach(model.shown) { b in
                        chip(b.name, color: Theme.color(for: b, in: model.household), on: model.target == [b.id]) { model.setTarget([b.id]) }
                    }
                    chip(all.count == 2 ? "Both" : "All", color: Theme.accent, on: Set(model.target) == Set(all) && all.count > 1) { model.setTarget(all) }
                }
            }
            Button { withAnimation(.snappy) { model.collapsed = true } } label: {
                Image(systemName: "chevron.up").font(.footnote.weight(.semibold)).frame(width: 32, height: 32)
            }
            .buttonStyle(.plain)
            .foregroundStyle(.secondary)
            .accessibilityLabel("Fold")
        }
        .padding(4)
        .background(Theme.card, in: Capsule())
    }

    private func chip(_ title: String, color: Color, on: Bool, action: @escaping () -> Void) -> some View {
        Button { withAnimation(.snappy) { action() } } label: {
            HStack(spacing: 5) {
                if title != "Both" && title != "All" { Circle().fill(on ? .white : color).frame(width: 7, height: 7) }
                Text(title).font(.subheadline.weight(.semibold))
            }
            .padding(.horizontal, 12).padding(.vertical, 7)
            .foregroundStyle(on ? .white : .primary)
            .background(on ? color : .clear, in: Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("logFor-\(title)")
        .accessibilityAddTraits(on ? .isSelected : [])
    }
}

struct ReviewBanner: View {
    @EnvironmentObject var model: AppModel

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            ForEach(model.reviews.prefix(3)) { c in
                Button { model.reviewing = c } label: {
                    HStack {
                        Image(systemName: "questionmark.bubble.fill").foregroundStyle(Theme.accent)
                        VStack(alignment: .leading) {
                            Text("“\(c.transcript ?? "")”").lineLimit(1)
                            Text("\(c.surface.rawValue) · \(c.capturedAt.formatted(date: .omitted, time: .shortened)) · tap to choose")
                                .font(.caption).foregroundStyle(.secondary)
                        }
                        Spacer()
                    }
                }
                .buttonStyle(.plain)
            }
            ForEach(model.log.duplicates, id: \.duplicate) { flag in
                DuplicateRow(flag: flag)
            }
        }
        .padding()
        .background(Theme.accent.opacity(0.12), in: RoundedRectangle(cornerRadius: 18))
    }
}

struct DuplicateRow: View {
    @EnvironmentObject var model: AppModel
    let flag: DuplicateFlag

    var body: some View {
        let a = model.log.all.first { $0.id == flag.original }
        let b = model.log.all.first { $0.id == flag.duplicate }
        VStack(alignment: .leading, spacing: 6) {
            Label(model.household.active.count > 1 && a != nil ? "Possible duplicate · \(model.household.babyName(a!.babyId))" : "Possible duplicate",
                  systemImage: "square.on.square").font(.subheadline.weight(.semibold))
            ForEach([a, b].compactMap { $0 }, id: \.id) { e in
                Text("\(VoiceInterpreter.label(type: e.type, fields: e.fields)) · \(e.occurredAt.formatted(date: .omitted, time: .shortened)) · \(model.household.caregiverName(e.loggedBy)) on \(e.provenance.surface.rawValue)")
                    .font(.caption).foregroundStyle(.secondary)
            }
            HStack {
                Button("Merge") { model.resolveDuplicate(flag, merge: true) }.buttonStyle(.borderedProminent)
                Button("Keep both") { model.resolveDuplicate(flag, merge: false) }.buttonStyle(.bordered)
            }
            .controlSize(.small)
        }
    }
}

struct QuickActions: View {
    @EnvironmentObject var model: AppModel
    @State private var measuring: String?   // the growth type whose sheet is open
    private let columns = [GridItem(.flexible()), GridItem(.flexible())]

    /// The buttons act on the Log-for target: each applies to the children it makes sense for
    /// (finish for those feeding, start for the others), one entry per child.
    var body: some View {
        let h = model.household
        let targets = model.target
        let logs = targets.map { ($0, model.logs[$0] ?? DerivedLog(events: [])) }
        let feeding = logs.compactMap { id, log in log.openFeedSession().map { (id, $0) } }
        let idle = logs.filter { $0.1.openFeedSession() == nil }.map(\.0)
        let bottles = feeding.filter { $0.1.kind == .bottle }
        let nursing = feeding.filter { $0.1.kind == .breast }
        let asleep = logs.filter { $0.1.openSession(.sleep) != nil }.map(\.0)
        let awake = targets.filter { !asleep.contains($0) }
        let many = targets.count > 1
        LazyVGrid(columns: columns, spacing: 12) {
            if !bottles.isEmpty {
                let ids = bottles.map(\.0)
                Menu {
                    ForEach([(0.25, "A quarter"), (0.5, "Half"), (0.75, "Three quarters"), (1.0, "All of it")], id: \.0) { f, label in
                        Button(label) { model.log("feed.bottle.finish", ["consumed_fraction": .number(f)], for: ids) }
                    }
                    Button("Not sure") { model.log("feed.bottle.finish", for: ids) }
                } label: {
                    Tile(title: ids.count > 1 ? "Finish bottles" : "Finish bottle",
                         subtitle: many ? names(ids) : "since \(bottles[0].1.start?.formatted(date: .omitted, time: .shortened) ?? "")",
                         icon: "waterbottle.fill", color: Theme.feed)
                }
            }
            if !nursing.isEmpty {
                let ids = nursing.map(\.0)
                ActionTile(title: "Finish nursing", subtitle: many ? names(ids) : nursing[0].1.sides.last.map { "on \($0)" } ?? "", icon: "heart.fill", color: Theme.feed) {
                    model.log("feed.breast.finish", for: ids)
                }
                ActionTile(title: "Switch side", subtitle: many ? names(ids) : "to \(nursing[0].1.sides.last == "left" ? "right" : "left")",
                           icon: "arrow.left.arrow.right", color: Theme.feed) {
                    model.performEach(ids) { s, baby, group in try s.switchSide(baby: baby, surface: .phone, fields: group) }
                }
            }
            if !idle.isEmpty {
                if h.enabled.contains("bottle") {
                    ActionTile(title: idle.count > 1 ? "Start bottles" : "Start bottle", subtitle: bottleText(idle), icon: "waterbottle.fill", color: Theme.feed) {
                        model.log("feed.bottle.start", for: idle)
                    }
                }
                if h.enabled.contains("breast") {
                    ActionTile(title: "Start nursing", subtitle: sideText(idle), icon: "heart.fill", color: Theme.feed) {
                        model.performEach(idle) { s, baby, group in
                            let side = StatusSnapshot(log: try s.derived(baby: baby), now: Date()).nextSide ?? "left"
                            return try s.log(type: "feed.breast.start", fields: ["side": .string(side)].merging(group) { $1 },
                                             provenance: Provenance(surface: .phone, input: .tap), baby: baby)
                        }
                    }
                }
            }
            if h.enabled.contains("diaper") {
                Menu {
                    ForEach(["wet", "dirty", "both", "dry"], id: \.self) { k in
                        Button(k.capitalized) { model.log("diaper", ["kind": .string(k)]) }
                    }
                } label: { Tile(title: many ? "Diapers" : "Diaper", subtitle: "wet · dirty · both", icon: "humidity.fill", color: Theme.diaper) }
            }
            if h.enabled.contains("sleep") {
                if !awake.isEmpty {
                    ActionTile(title: "Fell asleep", subtitle: many ? names(awake) : "start sleep", icon: "moon.zzz.fill", color: Theme.sleep) {
                        model.log("sleep.start", for: awake)
                    }
                }
                if !asleep.isEmpty {
                    ActionTile(title: "Woke up", subtitle: many ? names(asleep) : "end sleep", icon: "sun.max.fill", color: Theme.sleep) {
                        model.log("sleep.end", for: asleep)
                    }
                }
            }
            if h.enabled.contains("pumping") {
                // pumping is the parent's: one entry, filed under the first child logged for
                ActionTile(title: "Pumped", subtitle: "both sides", icon: "drop.triangle.fill", color: Theme.other) {
                    model.log("pump", ["side": .string("both")], for: Array(targets.prefix(1)))
                }
            }
            if h.enabled.contains("growth") {
                ForEach(Growth.types, id: \.self) { type in
                    Button { measuring = type } label: {
                        Tile(title: Growth.title(type), subtitle: growthText(type, logs) ?? "tap to log",
                             icon: Growth.icon(type), color: Theme.growth)
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("growthTile-\(type)")
                }
            }
            ForEach(Care.types(enabled: h.enabled), id: \.id) { CareTile(type: $0) }
        }
        .sheet(isPresented: Binding { measuring != nil } set: { if !$0 { measuring = nil } }) {
            if let measuring { GrowthSheet(type: measuring, babies: model.targetBabies).presentationDetents([.medium, .large]) }
        }
        .onAppear {   // automation: `-screen growth` opens the sheet (screenshots)
            if model.screen == "growth" { model.screen = "home"; measuring = "weight" }
        }
    }

    private func names(_ ids: [UUID]) -> String { Household.names(ids.compactMap { model.household.baby($0) }) }

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

struct Tile: View {
    let title: String
    let subtitle: String
    let icon: String
    let color: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Image(systemName: icon).font(.title2).foregroundStyle(color)
            Text(title).font(.headline).foregroundStyle(.primary)
            Text(subtitle).font(.caption).foregroundStyle(.secondary)
        }
        .padding()
        .frame(maxWidth: .infinity, minHeight: 96, alignment: .leading)
        .background(color.opacity(0.14), in: RoundedRectangle(cornerRadius: 18))
    }
}

struct ActionTile: View {
    let title: String
    let subtitle: String
    let icon: String
    let color: Color
    let action: () -> Void

    var body: some View {
        Button(action: action) { Tile(title: title, subtitle: subtitle, icon: icon, color: color) }
            .buttonStyle(.plain)
            .sensoryFeedback(.success, trigger: title)
    }
}

extension View {
    /// Keeps the last rows of a tab's scroll content clear of the floating voice button.
    func fabClearance() -> some View { contentMargins(.bottom, VoiceButton.size + 16, for: .scrollContent) }
}

/// Where the floating voice button sits, chosen per phone in Settings.
enum VoiceButtonPlacement: String, CaseIterable, Identifiable {
    case left, middle, right
    static let key = "voiceButtonPlacement"
    var id: String { rawValue }
    var title: String { rawValue.capitalized }
    var alignment: Alignment { [.left: .bottomLeading, .middle: .bottom, .right: .bottomTrailing][self]! }

    /// Keeps the toast beside the button, or above it when the button is in the middle.
    var toastClearance: EdgeInsets {
        let side = VoiceButton.size + 20
        switch self {
        case .left: return EdgeInsets(top: 0, leading: side, bottom: 0, trailing: 0)
        case .middle: return EdgeInsets(top: 0, leading: 0, bottom: VoiceButton.size + 12, trailing: 0)
        case .right: return EdgeInsets(top: 0, leading: 0, bottom: 0, trailing: side)
        }
    }
}

/// Floating mic button, on every tab: one tap opens ListeningView. The models start loading the
/// moment it's tapped.
/// Settings → Voice → Quick capture (this phone only, off by default): log the top guess instead
/// of asking (LogService.processVoice `quickCapture`).
enum QuickCapture {
    static let key = "quickCapture"
}

struct VoiceButton: View {
    static let size: CGFloat = 68
    @EnvironmentObject var model: AppModel

    var body: some View {
        Button { model.startVoice() } label: {
            ZStack {
                face
                if model.thinking {
                    ProgressView().tint(.white)
                } else {
                    Image(systemName: "mic.fill").font(.system(size: 28)).foregroundStyle(.white)
                }
            }
            .contentShape(Circle())
        }
        .buttonStyle(.plain)
        .disabled(model.thinking)
        .sensoryFeedback(.start, trigger: model.recording) { _, new in new }
        .accessibilityLabel("Speak a log entry")
        .accessibilityIdentifier("voiceButton")
    }

    /// Liquid Glass tinted with the accent on iOS 26 and later; a solid accent circle before.
    @ViewBuilder private var face: some View {
        if #available(iOS 26.0, *) {
            Circle().fill(.clear).frame(width: Self.size, height: Self.size)
                .glassEffect(.regular.tint(Theme.accent.opacity(model.recording ? 0.95 : 0.75)).interactive(), in: .circle)
        } else {
            Circle().fill(Theme.accent).frame(width: Self.size, height: Self.size)
                .shadow(color: .black.opacity(0.25), radius: 8, y: 4)
        }
    }
}

struct ToastView: View {
    @EnvironmentObject var model: AppModel

    var body: some View {
        if let toast = model.toast {
            HStack {
                if toast.reopen?.action == "Log it" {
                    Image(systemName: "note.text").foregroundStyle(.secondary)
                } else {
                    Image(systemName: "checkmark.circle.fill").foregroundStyle(.green)
                }
                Text(toast.text).lineLimit(2)
                Spacer()
                if let id = toast.undo { Button(toast.together ? "Undo all" : "Undo") { model.undo(id, together: toast.together) }.bold() }
                if let reopen = toast.reopen { Button(reopen.action) { model.reopen(reopen) }.bold() }
            }
            .padding()
            .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 16))
            .padding(.horizontal)
            .transition(.move(edge: .bottom).combined(with: .opacity))
            .task(id: toast.id) {
                try? await Task.sleep(for: .seconds(10))     // undo window
                if model.toast?.id == toast.id { withAnimation { model.toast = nil } }
            }
            .accessibilityIdentifier("toast")
        }
    }
}

/// Pick mode (top two) or the full list for an uncertain voice entry.
struct ReviewSheet: View {
    @EnvironmentObject var model: AppModel
    let capture: Capture

    var body: some View {
        let interp = capture.interpretation
        NavigationStack {
            List {
                Section {
                    Text("“\(capture.transcript ?? "")”").font(.title3)
                    Text("\(capture.surface.rawValue) · \(capture.capturedAt.formatted(date: .omitted, time: .shortened))" + (interp.map { " · \($0.modelVersion)" } ?? ""))
                        .font(.caption).foregroundStyle(.secondary)
                }
                Section(interp?.tier == .pick ? "Did you mean" : "Choose what to log") {
                    ForEach(Array((interp?.candidates ?? []).enumerated()), id: \.offset) { i, c in
                        Button { model.choose(capture, candidate: i) } label: {
                            HStack {
                                Image(systemName: Theme.icon(for: c.type)).foregroundStyle(Theme.color(for: c.type)).frame(width: 28)
                                VStack(alignment: .leading) {
                                    Text(c.label).foregroundStyle(.primary)
                                    Text(c.occurredAt.formatted(date: .omitted, time: .shortened)).font(.caption).foregroundStyle(.secondary)
                                }
                                Spacer()
                                Text("\(Int(c.probability * 100))%").font(.caption.monospacedDigit()).foregroundStyle(.secondary)
                            }
                        }
                    }
                }
                Section {
                    Button("None of these · keep as a note", role: .destructive) { model.dismiss(capture) }
                }
            }
            .navigationTitle("Check this entry")
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}

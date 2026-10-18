import FeedbackKit
import LogCore
import SwiftUI

struct MainView: View {
    @EnvironmentObject var model: AppModel

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
        .overlay(alignment: .bottomTrailing) { VoiceButton().padding(.trailing, 20).padding(.bottom, 64) }
        .overlay(alignment: .bottom) { ToastView().padding(.trailing, VoiceButton.size + 20).padding(.bottom, 64) }
        .onChange(of: model.screen, initial: true) { _, screen in FeedbackKit.currentScreen = screen }
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
                    StatusCard(now: now)
                    if !model.reviews.isEmpty || !model.log.duplicates.isEmpty { ReviewBanner() }
                    QuickActions()
                }
                .padding()
            }
            .navigationTitle(model.household.babyName)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    if let birth = model.household.birthDate {
                        Text(Self.age(birth)).font(.subheadline).foregroundStyle(.secondary)
                    }
                }
            }
            .refreshable { await model.syncNow() }
            .onReceive(tick) { now = $0 }
        }
    }

    static func age(_ birth: Date) -> String {
        let days = Calendar.current.dateComponents([.day], from: birth, to: Date()).day ?? 0
        return days < 14 ? "\(days) days" : days < 120 ? "\(days / 7) weeks" : "\(days / 30) months"
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
            HStack(spacing: 8) {
                let onDuty = model.status?.onDuty
                Image(systemName: onDuty == nil ? "person.2" : "person.fill.checkmark")
                Text(onDuty == nil ? "Nobody on duty · reminders go to everyone" : "\(model.household.caregiverName(onDuty)) is on duty")
                Spacer()
                Button(onDuty == model.me ? "Hand off" : "I've got it") { model.setOnDuty(onDuty != model.me) }
                    .buttonStyle(.bordered).controlSize(.small)
            }
            .font(.footnote)
            .foregroundStyle(.secondary)
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.card, in: RoundedRectangle(cornerRadius: 18))
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
            Label("Possible duplicate", systemImage: "square.on.square").font(.subheadline.weight(.semibold))
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

    var body: some View {
        let h = model.household
        let open = model.log.openFeedSession()
        let sleeping = model.log.openSession(.sleep) != nil
        LazyVGrid(columns: columns, spacing: 12) {
            if let open {
                if open.kind == .bottle {
                    Menu {
                        ForEach([(0.25, "A quarter"), (0.5, "Half"), (0.75, "Three quarters"), (1.0, "All of it")], id: \.0) { f, label in
                            Button(label) { model.log("feed.bottle.finish", ["consumed_fraction": .number(f)]) }
                        }
                        Button("Not sure") { model.log("feed.bottle.finish") }
                    } label: { Tile(title: "Finish bottle", subtitle: "since \(open.start?.formatted(date: .omitted, time: .shortened) ?? "")", icon: "waterbottle.fill", color: Theme.feed) }
                } else {
                    ActionTile(title: "Finish nursing", subtitle: open.sides.last.map { "on \($0)" } ?? "", icon: "heart.fill", color: Theme.feed) {
                        model.log("feed.breast.finish")
                    }
                    ActionTile(title: "Switch side", subtitle: "to \(open.sides.last == "left" ? "right" : "left")", icon: "arrow.left.arrow.right", color: Theme.feed) {
                        model.perform { try await $0.switchSide(surface: .phone) }
                    }
                }
            } else {
                if h.enabled.contains("bottle") {
                    ActionTile(title: "Start bottle", subtitle: "\(Int(h.bottleMl)) ml", icon: "waterbottle.fill", color: Theme.feed) { model.log("feed.bottle.start") }
                }
                if h.enabled.contains("breast") {
                    let side = model.status?.nextSide ?? "left"
                    ActionTile(title: "Start nursing", subtitle: "\(side) side", icon: "heart.fill", color: Theme.feed) {
                        model.log("feed.breast.start", ["side": .string(side)])
                    }
                }
            }
            if h.enabled.contains("diaper") {
                Menu {
                    ForEach(["wet", "dirty", "both", "dry"], id: \.self) { k in
                        Button(k.capitalized) { model.log("diaper", ["kind": .string(k)]) }
                    }
                } label: { Tile(title: "Diaper", subtitle: "wet · dirty · both", icon: "humidity.fill", color: Theme.diaper) }
            }
            if h.enabled.contains("sleep") {
                ActionTile(title: sleeping ? "Woke up" : "Fell asleep", subtitle: sleeping ? "end sleep" : "start sleep",
                           icon: sleeping ? "sun.max.fill" : "moon.zzz.fill", color: Theme.sleep) {
                    model.log(sleeping ? "sleep.end" : "sleep.start")
                }
            }
            if h.enabled.contains("pumping") {
                ActionTile(title: "Pumped", subtitle: "both sides", icon: "drop.triangle.fill", color: Theme.other) {
                    model.log("pump", ["side": .string("both")])
                }
            }
            if h.enabled.contains("growth") {
                ForEach(Growth.types, id: \.self) { type in
                    Button { measuring = type } label: {
                        Tile(title: Growth.title(type), subtitle: Growth.latestText(type, in: model.log) ?? "tap to log",
                             icon: Growth.icon(type), color: Theme.growth)
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("growthTile-\(type)")
                }
            }
        }
        .sheet(isPresented: Binding { measuring != nil } set: { if !$0 { measuring = nil } }) {
            if let measuring { GrowthSheet(type: measuring).presentationDetents([.medium, .large]) }
        }
        .onAppear {   // automation: `-screen growth` opens the sheet (screenshots)
            if model.screen == "growth" { model.screen = "home"; measuring = "weight" }
        }
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

/// Floating hold-to-speak button, on every tab. Release to log. The models start loading the
/// moment the press begins.
struct VoiceButton: View {
    static let size: CGFloat = 68
    @EnvironmentObject var model: AppModel

    var body: some View {
        HStack(spacing: 10) {
            if model.recording {
                Text("Listening… release to log")
                    .font(.footnote.weight(.medium))
                    .padding(.horizontal, 12).padding(.vertical, 8)
                    .background(.thinMaterial, in: Capsule())
                    .transition(.move(edge: .trailing).combined(with: .opacity))
            }
            ZStack {
                face
                    .scaleEffect(model.recording ? 1.15 : 1)
                    .animation(model.recording ? .easeInOut(duration: 0.6).repeatForever(autoreverses: true) : .default, value: model.recording)
                if model.thinking {
                    ProgressView().tint(.white)
                } else {
                    Image(systemName: "mic.fill").font(.system(size: 28)).foregroundStyle(.white)
                }
            }
            .contentShape(Circle())
            .gesture(DragGesture(minimumDistance: 0)
                .onChanged { _ in if !model.recording { model.startVoice() } }
                .onEnded { _ in model.stopVoice() })
            .sensoryFeedback(.start, trigger: model.recording) { _, new in new }
            .accessibilityLabel("Hold to speak")
            .accessibilityIdentifier("voiceButton")
        }
        .animation(.snappy, value: model.recording)
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
                Image(systemName: "checkmark.circle.fill").foregroundStyle(.green)
                Text(toast.text).lineLimit(2)
                Spacer()
                if let id = toast.undo { Button("Undo") { model.undo(id) }.bold() }
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

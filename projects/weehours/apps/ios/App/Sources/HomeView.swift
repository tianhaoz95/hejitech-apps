import FeedbackKit
import LogCore
import SwiftUI

struct MainView: View {
    @EnvironmentObject var model: AppModel
    @AppStorage(VoiceButtonPlacement.key) private var savedPlacement = VoiceButtonPlacement.right
    @AppStorage(ThumbDock.key) private var dock = ThumbDock.off
    @AppStorage(NightMode.key) private var nightMode = NightMode.off
    @AppStorage(NightMode.fromKey) private var nightFrom = NightMode.defaultFrom
    @AppStorage(NightMode.toKey) private var nightTo = NightMode.defaultTo
    @AppStorage(NightMode.tintKey) private var nightTint = NightTint.amber
    @Environment(\.scenePhase) private var scenePhase
    @State private var showingWhatsNew = WhatsNewView.shouldShowAutomatically
    @State private var clock = Date()
    private let minute = Timer.publish(every: 60, on: .main, in: .common).autoconnect()

    /// The thumb dock puts the mic in its corner.
    private var placement: VoiceButtonPlacement { dock == .off ? savedPlacement : dock.placement }
    private var nightOn: Bool { NightMode.isActive(nightMode, from: nightFrom, to: nightTo, now: clock) }
    private var showingHUD: Bool { nightMode != .off && (model.nightOpened || (nightOn && !model.nightDismissed)) }

    var body: some View {
        TabView(selection: $model.screen) {
            HomeView().fabClearance().tabItem { Label("Now", systemImage: "moon.stars.fill") }.tag("home")
            TimelineView().fabClearance().tabItem { Label("Timeline", systemImage: "list.bullet.rectangle") }.tag("timeline")
            SettingsView().fabClearance().tabItem { Label("Settings", systemImage: "gearshape.fill") }.tag("settings")
            if ["paywall", "agents", "watch"].contains(model.screen) {
                NavigationStack {
                    switch model.screen {
                    case "paywall": PaywallView()
                    case "watch": WatchSettingsView()
                    default: AgentsView()
                    }
                }
                    .tabItem { Label("More", systemImage: "ellipsis") }.tag(model.screen)
            }
        }
        .sheet(item: $model.reviewing) { capture in
            ReviewSheet(capture: capture).presentationDetents([.medium, .large])
        }
        .sheet(isPresented: $showingWhatsNew) { WhatsNewView() }
        .overlay { if showingHUD { NightHUD(tint: nightTint) { withAnimation(.snappy) { model.closeNightScreen() } }.transition(.opacity) } }
        .overlay(alignment: placement.alignment) {
            if !model.recording, !showingHUD {
                // the one-handed dock: the same mic, with feed, diaper and sleep behind a press and hold
                Group { if dock != .off, model.screen == "home" { ThumbDockView(side: dock) } else { VoiceButton() } }
                    .padding(.horizontal, 20).padding(.bottom, 64)
            }
        }
        .overlay(alignment: .bottom) { ToastView().padding(placement.toastClearance).padding(.bottom, 64) }
        .overlay { if model.recording { ListeningView().transition(.opacity) } }
        .animation(.easeInOut(duration: 0.25), value: model.recording)
        .preferredColorScheme(nightOn || showingHUD ? .dark : nil)
        .onReceive(minute) { clock = $0 }
        .onChange(of: scenePhase) { _, phase in
            clock = Date()
            if phase == .background { model.nightDismissed = false; model.nightOpened = false }   // night screen again next time
        }
        .onChange(of: nightOn) { _, on in if !on { model.nightDismissed = false } }
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
    @AppStorage(NightMode.key) private var nightMode = NightMode.off
    @State private var showingSync = false
    @State private var now = Date()
    /// The sync badge, the one toolbar item that comes and goes. A pull to refresh syncs, and the
    /// badge appearing or leaving while the refresh control settles left the large title stuck
    /// low with a blank band above it, so it changes only once the refresh is over.
    @State private var badge = false
    @State private var refreshing = false
    private let tick = Timer.publish(every: 30, on: .main, in: .common).autoconnect()

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    // one shown child: today's single status card; several: the Log-for panel
                    if let note = model.shiftNote { ShiftNoteCard(note: note, now: now) }
                    if model.shown.count > 1 { ChildrenPanel(now: now) } else { StatusCard(now: now) }
                    PartnerPulse(now: now)
                    if model.showingShiftDigest, let shift = model.log.shiftSummary(household: model.household, now: now, includeCurrent: true) {
                        ShiftDigestCard(shift: shift, now: now)
                    }
                    if model.household.enabled.contains("pumping"), model.household.trackMilkStash {
                        MilkStashCard(now: now)
                    }
                    if !model.reviews.isEmpty || !model.log.duplicates.isEmpty { ReviewBanner() }
                    let shownIds = Set(model.shown.map(\.id))
                    let blind = model.log.effective.filter { $0.needsDetails && shownIds.contains($0.babyId) }
                    if !blind.isEmpty { NeedsDetailsCard(entries: blind.sorted { $0.occurredAt > $1.occurredAt }) }
                    QuickActions()
                }
                .padding()
            }
            .navigationTitle(title)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    SyncBadge(visible: badge) { showingSync = true }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    HStack(spacing: 10) {
                        // whenever the night screen is on in Settings, here to open it, at any hour
                        if nightMode != .off {
                            Button { withAnimation(.snappy) { model.openNightScreen() } } label: { Image(systemName: "moon.fill") }
                                .accessibilityLabel("Night screen")
                                .accessibilityIdentifier("openNightScreen")
                        }
                        if let birth { Text(Self.age(birth)).font(.subheadline).foregroundStyle(.secondary) }
                    }
                }
            }
            .sheet(isPresented: $showingSync) { SyncSheet().presentationDetents([.medium, .large]) }
            .refreshable {
                refreshing = true
                await model.syncNow()
                Task {   // the list springs back once this returns; change the badge after that
                    try? await Task.sleep(for: .milliseconds(600))
                    refreshing = false
                }
            }
            .onChange(of: SyncBadge.wanted(model, now: now), initial: true) { _, wanted in if !refreshing { badge = wanted } }
            .onChange(of: refreshing) { _, r in if !r { badge = SyncBadge.wanted(model, now: now) } }
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

/// Who is on duty (household-wide, for every child), the hand-off button and an optional note for
/// the next shift.
struct DutyRow: View {
    @EnvironmentObject var model: AppModel
    @State private var showingNote = false

    var body: some View {
        HStack(spacing: 8) {
            let onDuty = model.log.duty?.caregiver
            Image(systemName: onDuty == nil ? "person.2" : "person.fill.checkmark")
            Text(onDuty == nil ? "Nobody on duty · reminders go to everyone" : "\(model.household.caregiverName(onDuty)) is on duty")
            Spacer()
            Button { showingNote = true } label: { Image(systemName: "square.and.pencil") }
                .buttonStyle(.bordered).controlSize(.small)
                .accessibilityLabel("Leave a note for the next shift")
                .accessibilityIdentifier("shiftNoteButton")
            if model.log.shiftSummary(household: model.household, includeCurrent: true) != nil {
                Button {
                    withAnimation(.snappy) { model.showingShiftDigest.toggle() }
                } label: {
                    Image(systemName: "list.clipboard")
                }
                .buttonStyle(.bordered).controlSize(.small)
                .accessibilityLabel("Shift summary")
            }
            Button(onDuty == model.me ? "Hand off" : "I've got it") { model.setOnDuty(onDuty != model.me) }
                .buttonStyle(.bordered).controlSize(.small)
        }
        .font(.footnote)
        .foregroundStyle(.secondary)
        .sheet(isPresented: $showingNote) { ShiftNoteSheet().presentationDetents([.medium]) }
    }
}

/// Factual summary of the previous (or current) duty shift on hand-off.
struct ShiftDigestCard: View {
    @EnvironmentObject var model: AppModel
    let shift: ShiftSummary
    let now: Date

    var body: some View {
        let name = model.household.caregiverName(shift.caregiver)
        let dur = StatusSnapshot.duration(shift.endedAt.timeIntervalSince(shift.startedAt))
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Label("\(name)'s shift · \(dur)", systemImage: "arrow.triangle.2.circlepath.circle.fill")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Theme.accent)
                Spacer()
                Text("\(shift.startedAt.formatted(date: .omitted, time: .shortened))–\(shift.endedAt.formatted(date: .omitted, time: .shortened))")
                    .font(.caption).foregroundStyle(.secondary)
                Button {
                    withAnimation(.snappy) { model.showingShiftDigest = false }
                } label: {
                    Image(systemName: "xmark.circle.fill").foregroundStyle(.secondary)
                }
                .buttonStyle(.plain)
            }
            HStack(spacing: 12) {
                statChip(icon: "waterbottle.fill", color: Theme.feed,
                         label: shift.bottleMl > 0 ? "\(shift.feedCount) feed\(shift.feedCount == 1 ? "" : "s") · \(Int(shift.bottleMl)) ml" : "\(shift.feedCount) feed\(shift.feedCount == 1 ? "" : "s")")
                statChip(icon: "humidity.fill", color: Theme.diaper,
                         label: "\(shift.wetDiapers) wet · \(shift.dirtyDiapers) dirty")
                statChip(icon: "moon.zzz.fill", color: Theme.sleep,
                         label: shift.sleepSeconds > 0 ? StatusSnapshot.duration(shift.sleepSeconds) : "0m sleep")
            }
            if !shift.medications.isEmpty {
                let medLabels = shift.medications.map { m in m.dose.map { "\(m.medicine) \($0)" } ?? m.medicine }
                Label("Meds: " + medLabels.joined(separator: " · "), systemImage: "pills.fill")
                    .font(.caption).foregroundStyle(.secondary)
            }
            if !shift.notes.isEmpty {
                ForEach(shift.notes.prefix(2)) { n in
                    Label("“\(n.text)”", systemImage: "note.text")
                        .font(.caption).foregroundStyle(.secondary).lineLimit(1)
                }
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.accent.opacity(0.10), in: RoundedRectangle(cornerRadius: 18))
        .overlay(RoundedRectangle(cornerRadius: 18).strokeBorder(Theme.accent.opacity(0.25), lineWidth: 1))
        .accessibilityIdentifier("shiftDigestCard")
    }

    private func statChip(icon: String, color: Color, label: String) -> some View {
        HStack(spacing: 5) {
            Image(systemName: icon).font(.caption2).foregroundStyle(color)
            Text(label).font(.caption.weight(.medium)).lineLimit(1)
        }
        .padding(.horizontal, 8).padding(.vertical, 5)
        .background(Color(.systemBackground).opacity(0.7), in: Capsule())
    }
}

/// Optional Milk Stash card (Settings → Tracking → Track milk stash): FIFO fridge & freezer inventory.
struct MilkStashCard: View {
    @EnvironmentObject var model: AppModel
    let now: Date
    @State private var showingPumpSheet = false

    var body: some View {
        let stash = model.log.milkStash(household: model.household)
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Label("Milk stash", systemImage: "drop.triangle.fill")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Theme.other)
                Spacer()
                Button { showingPumpSheet = true } label: {
                    Label("Log pump", systemImage: "plus.circle.fill").font(.caption.weight(.semibold))
                }
                .buttonStyle(.bordered).controlSize(.small)
            }
            HStack(spacing: 10) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("FRIDGE").font(.system(size: 10, weight: .bold)).foregroundStyle(.secondary)
                    Text("\(Int(stash.fridgeMl)) ml").font(.headline)
                    Text(stash.oldestFridgeAt.map { "Oldest · \(StatusSnapshot.duration(now.timeIntervalSince($0))) ago" } ?? "Empty")
                        .font(.caption2).foregroundStyle(.secondary)
                }
                .padding(10)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color(.systemBackground).opacity(0.6), in: RoundedRectangle(cornerRadius: 12))

                VStack(alignment: .leading, spacing: 2) {
                    Text("FREEZER").font(.system(size: 10, weight: .bold)).foregroundStyle(.secondary)
                    Text("\(Int(stash.freezerMl)) ml").font(.headline)
                    Text("\(stash.freezerBags) bag\(stash.freezerBags == 1 ? "" : "s")")
                        .font(.caption2).foregroundStyle(.secondary)
                }
                .padding(10)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color(.systemBackground).opacity(0.6), in: RoundedRectangle(cornerRadius: 12))
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.card, in: RoundedRectangle(cornerRadius: 18))
        .sheet(isPresented: $showingPumpSheet) {
            PumpSheet().presentationDetents([.medium])
        }
        .accessibilityIdentifier("milkStashCard")
    }
}

struct PumpSheet: View {
    @EnvironmentObject var model: AppModel
    @Environment(\.dismiss) private var dismiss
    @State private var ml: Double = 120
    @State private var side = "both"
    @State private var storage = "fridge"
    @State private var at = Date()

    var body: some View {
        NavigationStack {
            Form {
                Section("Amount") {
                    Stepper("\(Int(ml)) ml", value: $ml, in: 10...500, step: 10)
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack {
                            ForEach([60, 90, 120, 150, 180, 240], id: \.self) { preset in
                                Button("\(preset) ml") { ml = Double(preset) }
                                    .buttonStyle(.bordered).controlSize(.small)
                                    .tint(Int(ml) == preset ? Theme.other : .secondary)
                            }
                        }
                    }
                }
                Section("Details") {
                    Picker("Side", selection: $side) {
                        Text("Both").tag("both")
                        Text("Left").tag("left")
                        Text("Right").tag("right")
                    }
                    .pickerStyle(.segmented)
                    if model.household.trackMilkStash {
                        Picker("Storage", selection: $storage) {
                            Text("Fridge").tag("fridge")
                            Text("Freezer").tag("freezer")
                            Text("Fed right away").tag("fed")
                        }
                        .pickerStyle(.segmented)
                    }
                    DatePicker("When", selection: $at, in: ...Date())
                }
            }
            .navigationTitle("Log pumping")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Log") {
                        var fields: [String: FieldValue] = ["side": .string(side), "amount_ml": .number(ml)]
                        if model.household.trackMilkStash { fields["storage"] = .string(storage) }
                        model.log("pump", fields, at: at, for: Array(model.target.prefix(1)))
                        dismiss()
                    }
                }
            }
        }
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
    @State private var showingSolids = false
    @State private var showingPump = false
    /// Start bottle tapped while another caregiver said they're making one.
    @State private var confirmingBottle: [UUID]?
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
                         subtitle: many ? names(ids) : "since \(bottles[0].1.start?.formatted(date: .omitted, time: .shortened) ?? "")",
                         icon: "waterbottle.fill", color: Theme.feed)
                }
            }
            if !nursing.isEmpty {
                let ids = nursing.map(\.0)
                ActionTile(title: "Finish nursing", subtitle: many ? names(ids) : nursing[0].1.sides.last.map { "on \($0)" } ?? "", icon: "heart.fill", color: Theme.feed,
                           action: { model.log("feed.breast.finish", for: ids) },
                           backdate: { at in model.log("feed.breast.finish", at: at, for: ids) })
                ActionTile(title: "Switch side", subtitle: many ? names(ids) : "to \(nursing[0].1.sides.last == "left" ? "right" : "left")",
                           icon: "arrow.left.arrow.right", color: Theme.feed) {
                    model.performEach(ids) { s, baby, group in try s.switchSide(baby: baby, surface: .phone, fields: group) }
                }
            }
            if !idle.isEmpty {
                if h.enabled.contains("bottle") {
                    ActionTile(title: idle.count > 1 ? "Start bottles" : "Start bottle", subtitle: bottleText(idle), icon: "waterbottle.fill", color: Theme.feed,
                               action: {
                        if model.partnerPrepping(for: idle) != nil { confirmingBottle = idle } else { model.log("feed.bottle.start", for: idle) }
                    }, backdate: { at in model.log("feed.bottle.start", at: at, for: idle) },
                               announce: model.localOnly ? nil : { model.announcePreppingBottle(for: idle) })
                }
                if h.enabled.contains("breast") {
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
            }
            if h.enabled.contains("solids") {
                let summary = (logs.first?.1 ?? model.log).solidsSummary()
                let triedAllergens = summary.allergenCounts.values.filter { $0 > 0 }.count
                Button { showingSolids = true } label: {
                    Tile(title: "Solids", subtitle: summary.triedFoods.isEmpty ? "first foods & reactions" : "\(summary.triedFoods.count) foods · \(triedAllergens)/9 allergens",
                         icon: "fork.knife", color: Theme.feed)
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("solidsTile")
            }
            if h.enabled.contains("diaper") {
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
                } label: { Tile(title: many ? "Diapers" : "Diaper", subtitle: "wet · dirty · both", icon: "humidity.fill", color: Theme.diaper) }
            }
            if h.enabled.contains("sleep") {
                if !awake.isEmpty {
                    ActionTile(title: "Fell asleep", subtitle: many ? names(awake) : "start sleep", icon: "moon.zzz.fill", color: Theme.sleep,
                               action: { model.log("sleep.start", for: awake) },
                               backdate: { at in model.log("sleep.start", at: at, for: awake) })
                }
                if !asleep.isEmpty {
                    ActionTile(title: "Woke up", subtitle: many ? names(asleep) : "end sleep", icon: "sun.max.fill", color: Theme.sleep,
                               action: { model.log("sleep.end", for: asleep) },
                               backdate: { at in model.log("sleep.end", at: at, for: asleep) })
                }
            }
            if h.enabled.contains("pumping") {
                // pumping is the parent's: one entry, filed under the first child logged for
                if h.trackMilkStash {
                    Button { showingPump = true } label: {
                        Tile(title: "Pumped", subtitle: "amount & stash", icon: "drop.triangle.fill", color: Theme.other)
                    }
                    .buttonStyle(.plain)
                } else {
                    ActionTile(title: "Pumped", subtitle: "both sides", icon: "drop.triangle.fill", color: Theme.other,
                               action: { model.log("pump", ["side": .string("both")], for: Array(targets.prefix(1))) },
                               backdate: { at in model.log("pump", ["side": .string("both")], at: at, for: Array(targets.prefix(1))) })
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
        .sheet(isPresented: $showingSolids) {
            SolidsSheet().presentationDetents([.medium, .large])
        }
        .sheet(isPresented: $showingPump) {
            PumpSheet().presentationDetents([.medium])
        }
        .confirmationDialog(confirmTitle, isPresented: Binding { confirmingBottle != nil } set: { if !$0 { confirmingBottle = nil } },
                            titleVisibility: .visible) {
            Button("Start my bottle anyway") { if let ids = confirmingBottle { model.log("feed.bottle.start", for: ids) } }
            Button("Cancel", role: .cancel) {}
        }
        .onAppear {   // automation: `-screen growth` opens the sheet (screenshots)
            if model.screen == "growth" { model.screen = "home"; measuring = "weight" }
        }
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
    var backdate: ((Date) -> Void)? = nil
    /// "Making it now": tells the other caregivers' phones (Start bottle).
    var announce: (() -> Void)? = nil
    @State private var pickingTime = false
    @State private var customTime = Date()

    var body: some View {
        Button(action: action) { Tile(title: title, subtitle: subtitle, icon: icon, color: color) }
            .buttonStyle(.plain)
            .sensoryFeedback(.success, trigger: title)
            .contextMenu {
                if let announce {
                    Button { announce() } label: { Label("I'm making it · tell the household", systemImage: "person.wave.2") }
                    Divider()
                }
                if let backdate {
                    Button { action() } label: { Label("Just now", systemImage: "clock") }
                    ForEach([5, 10, 15, 30], id: \.self) { mins in
                        Button {
                            backdate(Date().addingTimeInterval(-Double(mins * 60)))
                        } label: {
                            Label("\(mins) min ago", systemImage: "clock.arrow.circlepath")
                        }
                    }
                    Button {
                        customTime = Date().addingTimeInterval(-15 * 60)
                        pickingTime = true
                    } label: {
                        Label("Pick a time…", systemImage: "calendar.badge.clock")
                    }
                }
            }
            .sheet(isPresented: $pickingTime) {
                NavigationStack {
                    Form {
                        DatePicker("When", selection: $customTime, in: ...Date())
                    }
                    .navigationTitle(title)
                    .navigationBarTitleDisplayMode(.inline)
                    .toolbar {
                        ToolbarItem(placement: .cancellationAction) { Button("Cancel") { pickingTime = false } }
                        ToolbarItem(placement: .confirmationAction) {
                            Button("Log") {
                                backdate?(customTime)
                                pickingTime = false
                            }
                        }
                    }
                }
                .presentationDetents([.height(240)])
            }
    }
}

/// First-foods & reactions sheet for `feed.solids`: food chips, Top-9 allergens, amount and reaction.
struct SolidsSheet: View {
    @EnvironmentObject var model: AppModel
    @Environment(\.dismiss) private var dismiss
    @State private var selectedFoods: Set<String> = []
    @State private var customFood = ""
    @State private var amount = "some"
    @State private var reaction = "none"
    @State private var at = Date()

    static let commonFoods = [
        "avocado", "banana", "sweet potato", "oatmeal", "apple", "pear", "carrot", "peas",
        "egg", "peanut", "yogurt", "salmon", "wheat", "tofu", "strawberries", "blueberries", "chicken"
    ]
    static let reactions: [(key: String, label: String)] = [
        ("none", "No reaction"),
        ("rash", "Rash"),
        ("hives", "Hives"),
        ("spit_up", "Spit-up"),
        ("gas", "Gas"),
        ("vomiting", "Vomiting"),
        ("diarrhea", "Diarrhea"),
    ]

    var body: some View {
        let log = model.target.first.flatMap { model.logs[$0] } ?? model.log
        let summary = log.solidsSummary()
        NavigationStack {
            Form {
                Section("Foods") {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 6) {
                            ForEach(Self.commonFoods, id: \.self) { food in
                                let on = selectedFoods.contains(food)
                                let isAllergen = SolidsSummary.topAllergens.contains { $0.keywords.contains(where: { food.contains($0) }) }
                                Button {
                                    if on { selectedFoods.remove(food) } else { selectedFoods.insert(food) }
                                } label: {
                                    HStack(spacing: 4) {
                                        if isAllergen { Image(systemName: "allergens").font(.caption2) }
                                        Text(food.capitalized)
                                    }
                                    .font(.subheadline.weight(.medium))
                                    .padding(.horizontal, 10).padding(.vertical, 6)
                                    .foregroundStyle(on ? .white : .primary)
                                    .background(on ? Theme.feed : Color(.tertiarySystemFill), in: Capsule())
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                    HStack {
                        TextField("Add another food…", text: $customFood)
                        if !customFood.trimmingCharacters(in: .whitespaces).isEmpty {
                            Button("Add") {
                                let clean = customFood.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
                                if !clean.isEmpty { selectedFoods.insert(clean); customFood = "" }
                            }
                        }
                    }
                }
                Section("How much & reaction") {
                    Picker("Amount", selection: $amount) {
                        Text("Taste").tag("taste")
                        Text("Some").tag("some")
                        Text("Most").tag("most")
                        Text("All").tag("all")
                    }
                    .pickerStyle(.segmented)
                    Picker("Reaction", selection: $reaction) {
                        ForEach(Self.reactions, id: \.key) { r in Text(r.label).tag(r.key) }
                    }
                    DatePicker("When", selection: $at, in: ...Date())
                }
                Section("Top-9 allergens & foods tried (\(summary.triedFoods.count))") {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 6) {
                            ForEach(SolidsSummary.topAllergens, id: \.key) { allergen in
                                let count = summary.allergenCounts[allergen.key] ?? 0
                                HStack(spacing: 4) {
                                    Image(systemName: count > 0 ? "checkmark.circle.fill" : "circle.dashed")
                                        .foregroundStyle(count > 0 ? .green : .secondary)
                                    Text("\(allergen.label) (\(count)×)")
                                }
                                .font(.caption)
                                .padding(.horizontal, 8).padding(.vertical, 4)
                                .background(Color(.tertiarySystemFill), in: Capsule())
                            }
                        }
                    }
                    if !summary.reactions.isEmpty {
                        ForEach(summary.reactions.prefix(3)) { r in
                            Label("\(r.foods.capitalized): \(r.reaction.replacingOccurrences(of: "_", with: " ")) (\(r.occurredAt.formatted(date: .abbreviated, time: .omitted)))",
                                  systemImage: "exclamationmark.triangle.fill")
                                .font(.caption).foregroundStyle(.orange)
                        }
                    }
                }
            }
            .navigationTitle("Solids")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Log") {
                        var fields: [String: FieldValue] = ["amount": .string(amount)]
                        var allFoods = Array(selectedFoods).sorted()
                        let extra = customFood.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
                        if !extra.isEmpty, !allFoods.contains(extra) { allFoods.append(extra) }
                        if !allFoods.isEmpty { fields["foods"] = .string(allFoods.joined(separator: ",")) }
                        if reaction != "none" { fields["reaction"] = .string(reaction) }
                        model.log("feed.solids", fields, at: at)
                        dismiss()
                    }
                    .accessibilityIdentifier("solidsLog")
                }
            }
        }
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

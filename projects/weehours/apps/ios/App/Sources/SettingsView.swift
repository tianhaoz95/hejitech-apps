import CoreImage.CIFilterBuiltins
import LogCore
import StoreKit
import SwiftUI
import Translation

struct SettingsView: View {
    @EnvironmentObject var model: AppModel
    @State private var draft = Household()
    @State private var invite: String?
    @State private var confirmDelete = false
    @State private var editingChild: UUID?
    @State private var newChild: Baby?
    @State private var loaded = false
    @State private var showingWhatsNew = false
    @AppStorage(Feedback.key) private var shakeToReport = true
    @AppStorage(VoiceButtonPlacement.key) private var voicePlacement = VoiceButtonPlacement.right
    @AppStorage(QuickCapture.key) private var quickCapture = false
    @AppStorage(VoiceLanguage.key) private var voiceLanguage = VoiceLanguage.english
    @AppStorage(AutoStopVoice.key) private var autoStopVoice = false
    @AppStorage(NightMode.key) private var nightMode = NightMode.off
    @AppStorage(NightMode.fromKey) private var nightFrom = NightMode.defaultFrom
    @AppStorage(NightMode.toKey) private var nightTo = NightMode.defaultTo
    @AppStorage(NightMode.tintKey) private var nightTint = NightTint.amber
    @AppStorage(ThumbDock.key) private var thumbDock = ThumbDock.off

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    NavigationLink { PaywallView() } label: {
                        HStack {
                            Label("Subscription", systemImage: "star.circle.fill")
                            Spacer()
                            Text(Self.describe(model.entitlement?.access(now: Date()))).foregroundStyle(.secondary)
                        }
                    }
                }
                Section {
                    ForEach(draft.babies) { b in
                        Button { editingChild = b.id } label: {
                            HStack(spacing: 10) {
                                Circle().fill(Theme.color(for: b, in: draft)).frame(width: 12, height: 12)
                                Text(b.name.isEmpty ? "New child" : b.name).foregroundStyle(.primary)
                                Spacer()
                                if b.archived {
                                    Text("Archived").foregroundStyle(.secondary)
                                } else if model.hidden.contains(b.id) {
                                    Text("Hidden here").foregroundStyle(.secondary)
                                }
                                Image(systemName: "chevron.right").font(.footnote.weight(.semibold)).foregroundStyle(.tertiary)
                            }
                        }
                        .tint(.primary)
                        .accessibilityIdentifier("settings-child-\(b.name)")
                    }
                    Button {
                        newChild = Baby(name: "", birthDate: draft.babies.last?.birthDate, position: (draft.babies.map(\.position).max() ?? 0) + 1)
                    } label: { Label("Add a child", systemImage: "plus") }
                } header: { Text("Children") } footer: {
                    Text("A child you add is shared with everyone in the household. Hiding a child only changes this iPhone.")
                }
                Section("Tracking") {
                    categoryToggles(group: nil)
                    if draft.categories.contains("pumping") {
                        Toggle(isOn: $draft.trackMilkStash) {
                            Label {
                                Text("Track milk stash (fridge & freezer)")
                            } icon: {
                                Image(systemName: "refrigerator.fill")
                                    .font(.system(size: 14, weight: .semibold))
                                    .foregroundStyle(.white)
                                    .frame(width: 28, height: 28)
                                    .background(Theme.color(for: "pump"), in: RoundedRectangle(cornerRadius: 7, style: .continuous))
                            }
                        }
                        .accessibilityIdentifier("trackMilkStash")
                    }
                    Picker("Quick feed starts", selection: $draft.defaultFeed) {
                        Text("Bottle").tag("bottle")
                        Text("Breastfeeding").tag("breast")
                    }
                    Stepper("Bottle size \(Int(draft.bottleMl)) ml", value: $draft.bottleMl, in: 30...360, step: 10)
                }
                ForEach(Care.groups.dropFirst(), id: \.title) { group in
                    Section {
                        categoryToggles(group: group.id)
                    } header: { Text(group.title) } footer: {
                        if group.id == "activity" {
                            Text("What's on is tracked for the household and gets a button on Now, and can be logged by voice.")
                        }
                    }
                }
                Section {
                    IntervalPicker(title: "Feed every", minutes: $draft.reminders.feedEveryMinutes)
                    Toggle("Adapt feed interval to last 3 days", isOn: $draft.reminders.adaptive)
                    IntervalPicker(title: "Diaper check every", minutes: $draft.reminders.diaperEveryMinutes)
                    Stepper("Sound after \(draft.reminders.overdueMarginMinutes) min overdue", value: $draft.reminders.overdueMarginMinutes, in: 5...90, step: 5)
                    if let suggestion = ReminderPlanner.suggestedFeedInterval(log: model.log, now: Date()) {
                        Button("Use your last 3 days: every \(StatusSnapshot.duration(Double(suggestion) * 60))") {
                            draft.reminders.feedEveryMinutes = suggestion
                        }
                    }
                    if let until = model.activeSnoozeUntil, until > Date() {
                        HStack {
                            Text("Snoozed until \(until.formatted(date: .omitted, time: .shortened))").foregroundStyle(.secondary)
                            Spacer()
                            Button("Resume") { model.snoozeReminders(minutes: 0) }
                        }
                    } else {
                        Menu("Snooze reminders…") {
                            Button("15 minutes") { model.snoozeReminders(minutes: 15) }
                            Button("30 minutes") { model.snoozeReminders(minutes: 30) }
                            Button("1 hour") { model.snoozeReminders(minutes: 60) }
                        }
                    }
                } header: { Text("Reminders") } footer: {
                    Text("Use your pediatrician's guidance. Reminders go to whoever is on duty, as a tap on the wrist first and a sound only when overdue.")
                }
                Section {
                    Button("Save changes") { save() }
                        .disabled(draft == model.household)
                }
                Section("Household") {
                    ForEach(model.household.caregivers) { c in
                        if c.id == model.me {
                            NavigationLink { ProfileEditor(caregiver: c) } label: {
                                LabeledContent { Text("You").foregroundStyle(.secondary) } label: { CaregiverLabel(caregiver: c, me: true) }
                            }
                            .accessibilityIdentifier("settings-me")
                        } else {
                            CaregiverLabel(caregiver: c, me: false)
                        }
                    }
                    if model.localOnly {
                        Text("Sign in to invite your partner.").font(.footnote).foregroundStyle(.secondary)
                    } else {
                        Button("Invite a caregiver") { Task { invite = await model.invite() } }
                        if let invite {
                            VStack(spacing: 8) {
                                QRCode(text: "weehours://join/\(invite)").frame(width: 160, height: 160)
                                Text(invite).font(.title2.monospaced().bold())
                                Text("Enter this code in the app on their phone. Valid for 7 days.").font(.caption).foregroundStyle(.secondary)
                            }
                            .frame(maxWidth: .infinity)
                        }
                        NavigationLink { CaregiverPassView() } label: {
                            Label("Temporary caregiver pass", systemImage: "qrcode.viewfinder")
                        }
                    }
                }
                Section {
                    Picker("Night screen", selection: $nightMode) {
                        ForEach(NightMode.allCases) { Text($0.title).tag($0) }
                    }
                    .accessibilityIdentifier("nightMode")
                    if nightMode == .scheduled {
                        DatePicker("From", selection: $nightFrom.asTime, displayedComponents: .hourAndMinute)
                        DatePicker("Until", selection: $nightTo.asTime, displayedComponents: .hourAndMinute)
                    }
                    if nightMode != .off {
                        Picker("Night colour", selection: $nightTint) {
                            ForEach(NightTint.allCases) { Text($0.title).tag($0) }
                        }
                        .pickerStyle(.segmented)
                    }
                    Picker("One-handed dock", selection: $thumbDock) {
                        ForEach(ThumbDock.allCases) { Text($0.title).tag($0) }
                    }
                    .accessibilityIdentifier("thumbDock")
                } header: { Text("Night & one-handed") } footer: {
                    Text("The night screen is true black with big amber or red buttons, so it won't light up the nursery. Swipe down on it for the full app. The one-handed dock puts feed, diaper and sleep on an arc around the mic, within reach of your thumb. Both are for this iPhone only.")
                }
                Section {
                    NavigationLink { WatchSettingsView() } label: { Label("Apple Watch", systemImage: "applewatch") }
                        .accessibilityIdentifier("settings-watch")
                }
                Section {
                    if thumbDock == .off {
                        Picker("Mic button", selection: $voicePlacement) {
                            ForEach(VoiceButtonPlacement.allCases) { Text($0.title).tag($0) }
                        }
                        .accessibilityIdentifier("voicePlacement")
                    }
                    Picker("Language", selection: $voiceLanguage) {
                        ForEach(VoiceLanguage.allCases) { Text($0.title).tag($0) }
                    }
                    .accessibilityIdentifier("voiceLanguage")
                    .onChange(of: voiceLanguage) { Task { await model.prepareVoiceLanguage() } }
                    if voiceLanguage.translates {
                        SpeechModelRow()
                        if #available(iOS 26.0, *) { TranslationPackRow(language: voiceLanguage).id(voiceLanguage) }
                    }
                    Toggle("Quick capture", isOn: $quickCapture).accessibilityIdentifier("quickCapture")
                    Toggle("Auto-log when you stop speaking", isOn: $autoStopVoice).accessibilityIdentifier("autoStopVoice")
                    Picker("Decision model", selection: Binding(get: { model.decisionBackend }, set: { model.decisionBackend = $0 })) {
                        ForEach(DecisionBackend.allCases) { Text($0.rawValue).tag($0) }
                    }
                    ModelDownloadRow()
                    if model.decisionBackend == .devServer {
                        TextField("llama-server URL", text: $model.devServer).textInputAutocapitalization(.never)
                    }
                } header: { Text("Voice") } footer: {
                    Text("Speak in English, Spanish or Chinese: for Spanish and Chinese, this iPhone translates what you say into English before logging it, and dictated notes stay in the language you spoke. Quick capture logs the most likely entry instead of asking when Wee Hours isn't sure. Auto-log stops listening automatically after a brief pause in speech.")
                }
                Section {
                    if !model.localOnly {
                        NavigationLink { AgentsView() } label: { Label("AI agents (MCP)", systemImage: "sparkles") }
                    }
                    if let url = model.exportCSV() {
                        ShareLink(item: url) { Label("Export CSV", systemImage: "square.and.arrow.up") }
                    }
                } footer: {
                    Text("The app records facts. Ask the assistant you already use to analyze them through MCP.")
                }
                Section {
                    Toggle("Shake to report a problem", isOn: $shakeToReport)
                        .onChange(of: shakeToReport) { _, on in Feedback.apply(enabled: on) }
                } footer: {
                    Text("Shake your iPhone to send the developer a screenshot and a note.")
                }
                Section("About") {
                    Button { showingWhatsNew = true } label: { Label("What's New in Wee Hours", systemImage: "sparkles") }
                    LabeledContent("Version", value: Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? WhatsNewView.currentVersion)
                }
                if model.localOnly {
                    Section {
                        LabeledContent("Account", value: "This iPhone only")
                        NavigationLink { AttachAccountView() } label: { Label("Sign in to sync and share", systemImage: "person.crop.circle.badge.plus") }
                        Button("Erase this phone's log", role: .destructive) { confirmDelete = true }
                    } header: { Text("Account") } footer: {
                        Text("Your partner's phone, the glasses and AI agents need an account. Signing in uploads everything logged here.")
                    }
                } else {
                Section("Account") {
                    if let email = model.email { LabeledContent("Signed in", value: email) }
                    if let last = model.lastSync { LabeledContent("Last sync", value: last.formatted(date: .omitted, time: .standard)) }
                    if let e = model.syncError { Text("Offline: \(e)").font(.caption).foregroundStyle(.orange) }
                    Button("Sync now") { Task { await model.syncNow() } }
                    Button("Sign out") { model.signOut() }
                    Button("Delete all household data", role: .destructive) { confirmDelete = true }
                }
                }
            }
            .navigationTitle("Settings")
            // a child's edits save when you go back, as adding one does
            .onChange(of: editingChild) { old, new in if old != nil, new == nil { save() } }
            .navigationDestination(item: $editingChild) { id in
                // bound by id, not position: the list can change while the editor is on screen
                ChildEditor(baby: Binding(get: { draft.baby(id) ?? Baby(id: id, name: "") },
                                          set: { b in if let i = draft.babies.firstIndex(where: { $0.id == id }) { draft.babies[i] = b } }),
                            household: draft)
            }
            .sheet(item: $newChild) { child in
                AddChildSheet(child: child, household: draft) { added in
                    // Add saves right away (with any other edits on this screen)
                    var h = draft
                    h.babies.append(added)
                    Task { await model.save(h) }
                }
            }
            // the draft keeps unsaved edits across the child editor and tab switches; a save (or
            // a change from another phone) brings it back in line
            .sheet(isPresented: $showingWhatsNew) { WhatsNewView() }
            .onAppear { if !loaded { draft = model.household; loaded = true } }
            .onChange(of: model.household) { _, h in draft = h }
            .confirmationDialog("Delete every entry, capture and token for this household? This cannot be undone.", isPresented: $confirmDelete, titleVisibility: .visible) {
                Button("Delete everything", role: .destructive) { Task { await model.deleteAllData() } }
            }
        }
    }

    private func save() {
        for i in draft.babies.indices {
            draft.babies[i].name = draft.babies[i].name.trimmingCharacters(in: .whitespacesAndNewlines)
            if draft.babies[i].name.isEmpty { draft.babies[i].name = "Baby" }
        }
        guard draft != model.household else { return }
        Task { await model.save(draft) }
    }

    /// One toggle per category in a Settings → Tracking group (household-wide, Save to apply).
    @ViewBuilder private func categoryToggles(group: String?) -> some View {
        ForEach(EventRegistry.shared.categories.filter { $0.group == group }, id: \.id) { c in
            Toggle(isOn: Binding(get: { draft.categories.contains(c.id) }, set: { on in
                draft.categories.removeAll { $0 == c.id }
                if on { draft.categories.append(c.id) }
            })) {
                // the icon and colour of the category's first type, as on its Now tile
                let type = EventRegistry.shared.types.first { $0.category == c.id }?.id ?? ""
                Label {
                    Text(c.label)
                } icon: {
                    Image(systemName: Theme.icon(for: type))
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(.white)
                        .frame(width: 28, height: 28)
                        .background(Theme.color(for: type), in: RoundedRectangle(cornerRadius: 7, style: .continuous))
                }
            }
            .accessibilityIdentifier("category-\(c.id)")
        }
    }

    static func describe(_ access: Entitlement.Access?) -> String {
        switch access {
        case .trial(let d): return "Trial · \(d) days left"
        case .subscribed(let p, _): return p.rawValue.capitalized
        case .lifetime: return "Lifetime"
        case .expired: return "Expired"
        case nil: return "…"
        }
    }
}

/// A new child, in a sheet: Cancel, or Add once it has a name.
struct AddChildSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State var child: Baby
    let household: Household
    let add: (Baby) -> Void

    private var name: String { child.name.trimmingCharacters(in: .whitespacesAndNewlines) }

    var body: some View {
        NavigationStack {
            ChildEditor(baby: $child, household: household, isNew: true)
                .navigationTitle("New child")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Add") {
                            var b = child
                            b.name = name
                            add(b)
                            dismiss()
                        }
                        .disabled(name.isEmpty)
                        .accessibilityIdentifier("addChild")
                    }
                }
        }
    }
}

/// One child's settings. Name, birthday, colour and feeding apply household-wide, saved on the way
/// back to Settings; "Show on this iPhone" changes only this phone, right away.
struct ChildEditor: View {
    @EnvironmentObject var model: AppModel
    @Binding var baby: Baby
    let household: Household
    var isNew = false

    var body: some View {
        Form {
            Section {
                TextField("Name", text: $baby.name).accessibilityIdentifier("childName")
                DatePicker("Born", selection: Binding(get: { baby.birthDate ?? Date() }, set: { baby.birthDate = $0 }), in: ...Date(), displayedComponents: .date)
            }
            Section("Colour") {
                HStack(spacing: 14) {
                    ForEach(Theme.childPalette, id: \.key) { c in
                        let on = Theme.colorKey(for: baby, in: household) == c.key
                        Button { baby.color = c.key } label: {
                            Circle().fill(c.color).frame(width: 30, height: 30)
                                .overlay(Circle().strokeBorder(.primary.opacity(on ? 0.8 : 0), lineWidth: 2).padding(-4))
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel(c.key)
                    }
                }
                .padding(.vertical, 4)
            }
            Section {
                Toggle("Own bottle size", isOn: Binding(get: { baby.bottleMl != nil }, set: { baby.bottleMl = $0 ? household.bottleMl : nil }))
                if let ml = baby.bottleMl {
                    Stepper("Bottle size \(Int(ml)) ml", value: Binding(get: { ml }, set: { baby.bottleMl = $0 }), in: 30...360, step: 10)
                }
                Picker("Quick feed starts", selection: $baby.defaultFeed) {
                    Text("Household setting").tag(String?.none)
                    Text("Bottle").tag(String?.some("bottle"))
                    Text("Breastfeeding").tag(String?.some("breast"))
                }
            } header: { Text("Feeding") } footer: {
                Text("Without its own, this child uses the household's bottle size (\(Int(household.bottleMl)) ml).")
            }
            Section {
                Toggle("Show on this iPhone", isOn: Binding(get: { !model.hidden.contains(baby.id) }, set: { show in
                    if show { model.hidden.remove(baby.id) } else { model.hidden.insert(baby.id) }
                }))
                .disabled(baby.archived)
            } footer: {
                Text("Hidden children stay in the log and on your partner's phone; Now, widgets and the watch here leave them out.")
            }
            if !isNew {
                Section {
                    if baby.archived {
                        Button("Restore") { baby.archived = false }
                    } else if household.babies.filter({ !$0.archived }).count > 1 {
                        Button("Archive", role: .destructive) { baby.archived = true }
                    }
                } footer: {
                    Text("Archiving keeps the child's log and export, and removes them from every phone's Now.")
                }
            }
        }
        .navigationTitle(baby.name.isEmpty ? "New child" : baby.name)
    }
}

/// A caregiver's name, with their role when they gave one ("Sam · Dad").
struct CaregiverLabel: View {
    let caregiver: Caregiver
    let me: Bool

    var body: some View {
        Label {
            Text(caregiver.name) + Text(caregiver.role.map { " · \($0)" } ?? "").foregroundStyle(.secondary)
        } icon: { Image(systemName: me ? "person.fill" : "person") }
    }
}

/// Your own name, role and quiet hours as the household sees them; saved on the way back, like a child's.
struct ProfileEditor: View {
    @EnvironmentObject var model: AppModel
    @State private var name: String
    @State private var role: String
    @State private var hasQuietHours: Bool
    @State private var quietStartHour: Int
    @State private var quietEndHour: Int

    static let roles = ["Mom", "Dad", "Parent", "Grandma", "Grandpa", "Nanny", "Babysitter"]

    init(caregiver: Caregiver) {
        _name = State(initialValue: caregiver.name)
        _role = State(initialValue: caregiver.role ?? "")
        _hasQuietHours = State(initialValue: caregiver.quietStart != nil && caregiver.quietEnd != nil)
        _quietStartHour = State(initialValue: (caregiver.quietStart ?? 22 * 60) / 60)
        _quietEndHour = State(initialValue: (caregiver.quietEnd ?? 7 * 60) / 60)
    }

    var body: some View {
        Form {
            Section {
                TextField("Your name", text: $name).accessibilityIdentifier("profileName")
            } header: { Text("Name") } footer: {
                Text("How you appear to the rest of the household, on entries you log and in reminders.")
            }
            Section {
                TextField("Optional, e.g. Mom, Dad, Nanny", text: $role).accessibilityIdentifier("profileRole")
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack {
                        ForEach(Self.roles, id: \.self) { r in
                            Button(r) { role = r }
                                .buttonStyle(.bordered).controlSize(.small)
                                .tint(role == r ? Theme.accent : .secondary)
                        }
                    }
                }
            } header: { Text("Role") }
            Section {
                Toggle("Quiet hours", isOn: $hasQuietHours)
                if hasQuietHours {
                    Picker("Starts", selection: $quietStartHour) {
                        ForEach(0..<24, id: \.self) { h in Text(Self.hourLabel(h)).tag(h) }
                    }
                    Picker("Ends", selection: $quietEndHour) {
                        ForEach(0..<24, id: \.self) { h in Text(Self.hourLabel(h)).tag(h) }
                    }
                }
            } header: { Text("Quiet hours") } footer: {
                Text("During your quiet hours, reminders are held unless you are explicitly on duty.")
            }
        }
        .navigationTitle("You")
        .onDisappear {
            Task {
                await model.saveProfile(
                    name: name,
                    role: role,
                    quietStart: hasQuietHours ? quietStartHour * 60 : nil,
                    quietEnd: hasQuietHours ? quietEndHour * 60 : nil
                )
            }
        }
    }

    private static func hourLabel(_ h: Int) -> String {
        let hour12 = h % 12 == 0 ? 12 : h % 12
        let ampm = h < 12 ? "AM" : "PM"
        return "\(hour12):00 \(ampm)"
    }
}

/// Share a time-limited web pass with a babysitter, grandparent or nanny — no app install needed.
struct CaregiverPassView: View {
    @EnvironmentObject var model: AppModel
    @State private var name = "Grandma"
    @State private var hours = 8
    @State private var note = ""
    @State private var createdURL: String?

    private var passes: [AccessToken] {
        model.tokens.filter { $0.name.hasPrefix("pass:") && $0.revokedAt == nil }
    }

    private func passTitle(_ raw: String) -> String {
        let stripped = raw.replacingOccurrences(of: "pass:", with: "")
        return stripped.components(separatedBy: "|").first ?? stripped
    }

    var body: some View {
        Form {
            Section {
                TextField("Caregiver name (e.g. Grandma, Nanny)", text: $name)
                Picker("Expires in", selection: $hours) {
                    Text("4 hours").tag(4)
                    Text("8 hours").tag(8)
                    Text("24 hours").tag(24)
                    Text("48 hours").tag(48)
                }
                TextField("Pinned note (optional, e.g. 120 ml bottle in fridge)", text: $note, axis: .vertical)
                    .lineLimit(2...4)
                Button("Create caregiver pass") {
                    Task { createdURL = await model.createCaregiverPass(name: name, hours: hours, note: note) }
                }
                .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty)
            } header: { Text("New pass") } footer: {
                Text("Opens a simple web card in any phone browser with live status and one-tap logging for feeds, diapers and sleep. No app install or account needed.")
            }
            if let url = createdURL {
                Section("Share pass") {
                    VStack(spacing: 10) {
                        QRCode(text: url).frame(width: 170, height: 170)
                        Text(url).font(.caption.monospaced()).textSelection(.enabled).multilineTextAlignment(.center)
                        if let link = URL(string: url) {
                            ShareLink(item: link) { Label("Share link", systemImage: "square.and.arrow.up") }
                                .buttonStyle(.borderedProminent)
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 6)
                }
            }
            if !passes.isEmpty {
                Section("Active passes") {
                    ForEach(passes) { p in
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(passTitle(p.name))
                                Text(p.lastUsedAt.map { "used \($0.formatted(.relative(presentation: .named)))" } ?? "not opened yet")
                                    .font(.caption).foregroundStyle(.secondary)
                            }
                            Spacer()
                            Button("Revoke", role: .destructive) { Task { await model.revoke(p) } }
                                .buttonStyle(.borderless)
                        }
                    }
                }
            }
        }
        .navigationTitle("Caregiver pass")
        .task { await model.loadTokens() }
    }
}

struct IntervalPicker: View {
    let title: String
    @Binding var minutes: Int?

    var body: some View {
        Picker(title, selection: $minutes) {
            Text("Off").tag(Int?.none)
            ForEach([90, 120, 150, 180, 210, 240, 300, 360], id: \.self) { m in
                Text(StatusSnapshot.duration(Double(m) * 60)).tag(Int?.some(m))
            }
        }
    }
}

struct ModelDownloadRow: View {
    @EnvironmentObject var model: AppModel
    @ObservedObject var models: ModelManager

    init() { models = ModelManagerHolder.shared }

    var body: some View {
        if models.isBundled {
            Label("Laya included with the app", systemImage: "checkmark.seal.fill").foregroundStyle(.green)
        } else if models.isDownloaded {
            Label("Laya on this iPhone (449 MB)", systemImage: "checkmark.seal.fill").foregroundStyle(.green)
        } else if models.progress != nil {
            HStack { ProgressView(); Text("Downloading Laya…") }
        } else {
            Button("Download Laya (449 MB, Wi-Fi)") {
                Task { await model.models.download(); await model.rebuildInterpreter() }
            }
            if let e = models.error { Text(e).font(.caption).foregroundStyle(.red) }
        }
    }
}

/// The multilingual speech model for Spanish and Chinese (Settings → Voice → Language).
struct SpeechModelRow: View {
    @EnvironmentObject var model: AppModel
    @ObservedObject var speech: SpeechModelManager

    init() { speech = SpeechModelHolder.shared }

    var body: some View {
        if speech.isBundled {
            Label("Speech model included with the app", systemImage: "checkmark.seal.fill").foregroundStyle(.green)
        } else if speech.isDownloaded {
            Label("Speech model on this iPhone (216 MB)", systemImage: "checkmark.seal.fill").foregroundStyle(.green)
        } else if let p = speech.progress {
            HStack { ProgressView(value: p).frame(width: 60); Text("Downloading speech model… \(Int(p * 100))%") }
        } else {
            Button("Download speech model (216 MB, Wi-Fi)") { Task { await model.prepareVoiceLanguage() } }
                .accessibilityIdentifier("downloadSpeechModel")
            if let e = speech.error { Text(e).font(.caption).foregroundStyle(.red) }
        }
    }
}

/// Apple's Translation language for the voice language, which turns what was said into English
/// on this iPhone. Downloading it is the system's own sheet (`prepareTranslation`).
@available(iOS 26.0, *)
struct TranslationPackRow: View {
    let language: VoiceLanguage
    @State private var status: LanguageAvailability.Status?
    @State private var request: TranslationSession.Configuration?

    var body: some View {
        Group {
            switch status {
            case .installed?:
                Label("\(language.title) translation on this iPhone", systemImage: "checkmark.seal.fill").foregroundStyle(.green)
            case .supported?:
                Button("Download \(language.title) translation") {
                    request = TranslationSession.Configuration(source: language.translationLanguage, target: VoiceTranslator.english)
                }
                .accessibilityIdentifier("downloadTranslation")
            case .unsupported?:
                Text("Translation isn't available for \(language.title) here; Whisper translates instead.").font(.caption).foregroundStyle(.secondary)
            default:
                ProgressView()
            }
        }
        .task { await refresh() }
        .translationTask(request) { session in
            try? await session.prepareTranslation()
            await refresh()
        }
    }

    private func refresh() async {
        status = await LanguageAvailability().status(from: language.translationLanguage, to: VoiceTranslator.english)
    }
}

@MainActor
enum ModelManagerHolder {
    static var shared = ModelManager()
}

struct QRCode: View {
    let text: String
    var body: some View {
        let filter = CIFilter.qrCodeGenerator()
        filter.message = Data(text.utf8)
        let image = filter.outputImage.flatMap { CIContext().createCGImage($0.transformed(by: .init(scaleX: 8, y: 8)), from: $0.transformed(by: .init(scaleX: 8, y: 8)).extent) }
        return Group {
            if let image { Image(decorative: image, scale: 1).interpolation(.none).resizable().scaledToFit() } else { Color.clear }
        }
    }
}

// MARK: - Agents

struct AgentsView: View {
    @EnvironmentObject var model: AppModel
    @State private var name = "My assistant"
    @State private var write = false
    @State private var created: String?

    var body: some View {
        Form {
            Section {
                LabeledContent("Server URL") { Text(model.mcpURL).font(.caption.monospaced()).textSelection(.enabled) }
                Text("Agents that support OAuth sign in with the same account as this app. For others, create a token below.")
                    .font(.footnote).foregroundStyle(.secondary)
            } header: { Text("MCP server") }
            Section("New token") {
                TextField("Name", text: $name)
                Toggle("Allow logging (write)", isOn: $write)
                Button("Create token") { Task { created = await model.createToken(name: name, write: write) } }
                if let created {
                    Text(created).font(.caption.monospaced()).textSelection(.enabled)
                    Text("Copy it now; it is shown once.").font(.caption).foregroundStyle(.orange)
                }
            }
            Section("Tokens") {
                ForEach(model.tokens) { t in
                    HStack {
                        VStack(alignment: .leading) {
                            Text(t.name)
                            Text("\(t.scope) · \(t.lastUsedAt.map { "used \($0.formatted(.relative(presentation: .named)))" } ?? "never used")")
                                .font(.caption).foregroundStyle(.secondary)
                        }
                        Spacer()
                        if t.revokedAt == nil {
                            Button("Revoke", role: .destructive) { Task { await model.revoke(t) } }.buttonStyle(.borderless)
                        } else {
                            Text("revoked").font(.caption).foregroundStyle(.secondary)
                            Button("Delete") { Task { await model.delete(t) } }.buttonStyle(.borderless)
                        }
                    }
                }
            }
        }
        .navigationTitle("AI agents")
        .task { await model.loadTokens() }
    }
}

// MARK: - Paywall (StoreKit 2, local .storekit configuration in development)

struct PaywallView: View {
    @EnvironmentObject var model: AppModel

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text("Wee Hours Plus").font(.largeTitle.bold())
                Text(SettingsView.describe(model.entitlement?.access(now: Date()))).foregroundStyle(.secondary)
                VStack(alignment: .leading, spacing: 8) {
                    Label("Voice logging with the on-device model", systemImage: "mic.fill")
                    Label("Apple Watch and Even G2 glasses + ring", systemImage: "applewatch")
                    Label("Reminders for whoever is on duty", systemImage: "bell.fill")
                    Label("Your AI assistant over MCP", systemImage: "sparkles")
                    Label("One purchase covers both parents", systemImage: "person.2.fill")
                }
                .font(.subheadline)
                Text("Tap logging is always free, so you never lose access to your log.").font(.footnote).foregroundStyle(.secondary)
                ForEach(model.billing.products, id: \.id) { p in
                    Button { Task { await model.buy(p) } } label: {
                        HStack {
                            VStack(alignment: .leading) {
                                Text(p.displayName).font(.headline)
                                Text(p.description).font(.caption).foregroundStyle(.secondary)
                            }
                            Spacer()
                            Text(p.displayPrice).font(.headline)
                        }
                        .padding()
                        .background(Theme.card, in: RoundedRectangle(cornerRadius: 14))
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("buy-\(p.id)")
                }
                if model.billing.products.isEmpty {
                    // Dummy store: used when StoreKit has no products (simulator launched outside
                    // Xcode, CI). Same entitlement path as a real purchase.
                    ForEach(DummyStore.plans, id: \.plan) { item in
                        Button { Task { await model.buyDummy(item.plan) } } label: {
                            HStack {
                                VStack(alignment: .leading) {
                                    Text(item.name).font(.headline)
                                    Text(item.detail).font(.caption).foregroundStyle(.secondary)
                                }
                                Spacer()
                                Text(item.price).font(.headline)
                            }
                            .padding()
                            .background(Theme.card, in: RoundedRectangle(cornerRadius: 14))
                        }
                        .buttonStyle(.plain)
                        .accessibilityIdentifier("buy-\(item.plan.rawValue)")
                    }
                    Text("Dummy store · no money moves. Run from Xcode to use the StoreKit test configuration.").font(.caption).foregroundStyle(.secondary)
                }
                Button("Restore purchases") { Task { await model.restorePurchases() } }
            }
            .padding()
        }
        .task { await model.billing.load() }
    }
}

enum DummyStore {
    struct Item { let plan: Plan; let name: String; let detail: String; let price: String; let days: Int? }
    static let plans = [
        Item(plan: .monthly, name: "Monthly", detail: "Voice, watch, glasses, reminders and agents.", price: "$4.99", days: 30),
        Item(plan: .yearly, name: "Yearly", detail: "Everything in Plus, billed yearly.", price: "$39.99", days: 365),
        Item(plan: .lifetime, name: "Lifetime", detail: "Everything, forever. One purchase for the household.", price: "$79.99", days: nil),
    ]
}

/// Moves a local-only household onto an account: a new household made from this one, or the
/// partner's household if you have an invite code.
struct AttachAccountView: View {
    @EnvironmentObject var model: AppModel
    @State private var email = ""
    @State private var password = ""
    @State private var create = true
    @State private var code = ""
    @State private var working = false

    var body: some View {
        Form {
            Section {
                Picker("", selection: $create) {
                    Text("New account").tag(true)
                    Text("I have one").tag(false)
                }
                .pickerStyle(.segmented)
                TextField("Email", text: $email).textContentType(.emailAddress).keyboardType(.emailAddress).textInputAutocapitalization(.never)
                SecureField("Password", text: $password)
            }
            Section {
                TextField("Partner's invite code (optional)", text: $code).textInputAutocapitalization(.characters)
            } footer: {
                Text("With a code, this phone's entries join your partner's log. Without one, your household is created on the server as it is now.")
            }
            Section {
                Button {
                    working = true
                    Task {
                        await model.attachAccount(email: email, password: password, create: create, inviteCode: code.trimmingCharacters(in: .whitespaces))
                        working = false
                    }
                } label: {
                    HStack { Text("Sign in and upload my log"); if working { Spacer(); ProgressView() } }
                }
                .disabled(email.isEmpty || password.count < 6 || working)
            }
        }
        .navigationTitle("Sync and share")
    }
}

import AuthenticationServices
import CoreImage.CIFilterBuiltins
import LogCore
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
    @State private var translationRequest: TranslationSession.Configuration?
    @AppStorage(AutoStopVoice.key) private var autoStopVoice = false
    @AppStorage(NightMode.key) private var nightMode = NightMode.off
    @AppStorage(NightMode.fromKey) private var nightFrom = NightMode.defaultFrom
    @AppStorage(NightMode.toKey) private var nightTo = NightMode.defaultTo
    @AppStorage(NightMode.tintKey) private var nightTint = NightTint.amber
    @AppStorage(ThumbDock.key) private var thumbDock = ThumbDock.off
    @AppStorage("liveActivitiesEnabled") private var liveActivitiesEnabled = true
    @AppStorage(GroupSessions.key) private var groupSessions = true
    @AppStorage(NowRhythm.key) private var nowRhythm = true

    /// When the next feed is due with the interval as set here (the adapted one if that's on),
    /// counted from the last logged feed; nil before any feed is logged.
    private var nextFeedDue: Date? {
        let now = Date()
        let adapted = draft.reminders.adaptive ? ReminderPlanner.suggestedFeedInterval(log: model.log, now: now) : nil
        return StatusSnapshot(log: model.log, now: now)
            .nextFeedDue(feedEveryMinutes: draft.reminders.feedEveryMinutes, adaptiveSuggestion: adapted)
    }

    var body: some View {
        NavigationStack {
            Form {
                accessSection
                childrenSection
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
                    Toggle("Next feed reminders", isOn: Binding(
                        get: { draft.reminders.feedEveryMinutes != nil },
                        set: { enabled in
                            if enabled {
                                draft.reminders.feedEveryMinutes = draft.reminders.feedEveryMinutes ?? 180
                            } else {
                                draft.reminders.feedEveryMinutes = nil
                            }
                        }
                    )).accessibilityIdentifier("toggleFeedReminders")

                    if draft.reminders.feedEveryMinutes != nil {
                        IntervalPicker(title: "Feed every", minutes: $draft.reminders.feedEveryMinutes)
                        Toggle("Adapt feed interval to last 3 days", isOn: $draft.reminders.adaptive)
                        if let due = nextFeedDue {
                            LabeledContent("Next feed due", value: due.formatted(date: .omitted, time: .shortened))
                                .accessibilityIdentifier("nextFeedDue")
                        }
                    }

                    IntervalPicker(title: "Diaper check every", minutes: $draft.reminders.diaperEveryMinutes)
                    Stepper("Sound after \(draft.reminders.overdueMarginMinutes) min overdue", value: $draft.reminders.overdueMarginMinutes, in: 5...90, step: 5)
                    if draft.reminders.feedEveryMinutes != nil, let suggestion = ReminderPlanner.suggestedFeedInterval(log: model.log, now: Date()) {
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
                    Toggle("Lock Screen Live Activity", isOn: $liveActivitiesEnabled)
                        .accessibilityIdentifier("toggleLiveActivities")
                        .onChange(of: liveActivitiesEnabled) { _, on in
                            if !on {
                                SessionActivities.endAll()
                            }
                        }
                } header: { Text("Lock Screen & Dynamic Island") } footer: {
                    Text("Shows ongoing timer on your Lock Screen and Dynamic Island during feeding and sleep sessions. Toggle off individually per caregiver preference.")
                }
                Section {
                    Toggle("Group feeds and sleeps", isOn: $groupSessions)
                        .accessibilityIdentifier("groupSessions")
                    Toggle("Today vs yesterday on Now", isOn: $nowRhythm)
                        .accessibilityIdentifier("nowRhythm")
                } header: { Text("Timeline") } footer: {
                    Text("Grouping shows a finished feed or sleep as one entry with its length; search and the Audit view always show every entry. Today vs yesterday puts today's and yesterday's feeds, diapers and sleep side by side at the top of Now.")
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
                    Text("The night screen is true black with big amber or red buttons, so it won't light up the nursery. It comes up by itself (always, or between the hours you set), and the moon at the top of Now opens it any time. Swipe down on it for the full app. With the one-handed dock, press and hold the mic on Now: feed, diaper and sleep fan out around it within reach of your thumb, and you slide onto one and let go to log it. A tap still listens. Both are for this iPhone only.")
                }
                Section {
                    NavigationLink { WatchSettingsView() } label: { Label("Apple Watch", systemImage: "applewatch") }
                        .accessibilityIdentifier("settings-watch")
                    NavigationLink { GlassesSettingsView() } label: { Label("Even G2 glasses", systemImage: "eyeglasses") }
                        .accessibilityIdentifier("settings-glasses")
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
                    .onChange(of: voiceLanguage) {
                        Task { await model.prepareVoiceLanguage() }
                        requestTranslation(for: voiceLanguage)
                    }
                    if voiceLanguage.translates { SpeechModelRow() }
                    Toggle("Quick capture", isOn: $quickCapture).accessibilityIdentifier("quickCapture")
                    Toggle("Auto-log when you stop speaking", isOn: $autoStopVoice).accessibilityIdentifier("autoStopVoice")
                    #if DEBUG
                    Picker("Decision model", selection: Binding(get: { model.decisionBackend }, set: { model.decisionBackend = $0 })) {
                        ForEach(DecisionBackend.allCases) { Text($0.rawValue).tag($0) }
                    }
                    ModelDownloadRow()
                    if model.decisionBackend == .devServer {
                        TextField("llama-server URL", text: $model.devServer).textInputAutocapitalization(.never)
                    }
                    #endif
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
                Section {
                    Button { showingWhatsNew = true } label: { Label("What's New in Wee Hours", systemImage: "sparkles") }
                    LabeledContent("Version", value: Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? WhatsNewView.currentVersion)
                    Link("Privacy Policy", destination: URL(string: "https://weehours.hejitech.workers.dev/privacy/")!)
                    Link("Terms of Use", destination: URL(string: "https://weehours.hejitech.workers.dev/terms/")!)
                    Link("Support", destination: URL(string: "https://weehours.hejitech.workers.dev/support/")!)
                    NavigationLink("Acknowledgements") { AcknowledgementsView() }
                } header: {
                    Text("About")
                } footer: {
                    Text("Wee Hours records what happened. It doesn't give medical advice; ask your pediatrician about your baby's health.")
                }
                accountSection
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
            // picking Español or 中文 asks iOS for its translation (the system's own download sheet)
            .translationTask(translationRequest) { session in try? await session.prepareTranslation() }
            .onAppear { if !loaded { draft = model.household; loaded = true } }
            .onChange(of: model.household) { _, h in draft = h }
            .confirmationDialog(model.localOnly
                                ? "Erase this phone's log? This permanently removes every entry and photo on this iPhone. This cannot be undone."
                                : "Delete your account and all household data? This permanently removes every entry, photo, capture and access token for everyone in the household, then deletes your Wee Hours account. Other HEJI apps you sign in to with the same account aren't affected. This cannot be undone.",
                                isPresented: $confirmDelete, titleVisibility: .visible) {
                Button(model.localOnly ? "Erase this phone's log" : "Delete account & data", role: .destructive) { Task { await model.deleteAllData() } }
            }
        }
    }

    /// Apple's on-device Translation turns the voice language into English (iOS 26, see
    /// VoiceTranslator). When the language isn't on the iPhone yet, picking it asks for it once;
    /// without it Whisper translates by itself, so nothing is shown in Settings either way.
    private func requestTranslation(for language: VoiceLanguage) {
        guard #available(iOS 26.0, *), language.translates else { return }
        Task {
            let status = await LanguageAvailability().status(from: language.translationLanguage, to: VoiceTranslator.english)
            guard status == .supported else { return }
            translationRequest = TranslationSession.Configuration(source: language.translationLanguage, target: VoiceTranslator.english)
        }
    }

    @ViewBuilder private var accessSection: some View {
        Section {
            NavigationLink { PaywallView() } label: {
                HStack {
                    Label("Lifetime Access", systemImage: "checkmark.seal.fill")
                    Spacer()
                    Text("All features included").foregroundStyle(.secondary)
                }
            }
            .accessibilityIdentifier("settings-plus")
        }
    }

    @ViewBuilder private var childrenSection: some View {
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
    }

    @ViewBuilder private var accountSection: some View {
        if model.localOnly {
            Section {
                LabeledContent("Account", value: "This iPhone only")
                NavigationLink { AttachAccountView() } label: { Label("Sign in to sync and share", systemImage: "person.crop.circle.badge.plus") }
                Button("Erase this phone's log", role: .destructive) { confirmDelete = true }
            } header: { Text("Account") } footer: {
                Text("Your partner's phone, the glasses and AI agents need an account. Signing in uploads everything logged here.")
            }
        } else {
            Section {
                if let email = model.email { LabeledContent("Signed in", value: email) }
                if let last = model.lastSync { LabeledContent("Last sync", value: last.formatted(date: .omitted, time: .standard)) }
                if let e = model.syncError { Text("Offline: \(e)").font(.caption).foregroundStyle(.orange) }
                Button("Sync now") { Task { await model.syncNow() } }
                Button("Sign out") { model.signOut() }
                Button("Delete account & data", role: .destructive) { confirmDelete = true }
            } header: {
                Text("Account")
            } footer: {
                Text("In the future, baby data that is inactive for more than a year might be archived. If that happens, we will provide a way to download and re-import your data.")
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

/// Born on a date, or not born yet with a due date (and how far along). Used when setting up a
/// household and in a child's settings.
struct BirthFields: View {
    @Binding var baby: Baby

    var body: some View {
        Toggle("Not born yet", isOn: Binding(get: { baby.isExpected }, set: { expecting in
            if expecting {
                baby.birthDate = nil
                baby.dueDate = baby.dueDate ?? Calendar.current.date(byAdding: .day, value: 140, to: Date())
            } else {
                baby.dueDate = nil
                baby.birthDate = baby.birthDate ?? Date()
            }
        }))
        .accessibilityIdentifier("childExpected")
        if baby.isExpected {
            DatePicker("Due", selection: Binding(get: { baby.dueDate ?? Date() }, set: { baby.dueDate = $0 }),
                       in: Date().addingTimeInterval(-30 * 86_400)..., displayedComponents: .date)
            if let g = baby.gestation() {
                LabeledContent("Pregnancy", value: "\(g.weeks) weeks \(g.days) days")
            }
        } else {
            DatePicker("Born", selection: Binding(get: { baby.birthDate ?? Date() }, set: { baby.birthDate = $0 }), in: ...Date(), displayedComponents: .date)
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
                BirthFields(baby: $baby)
            } footer: {
                if baby.isExpected {
                    Text("Before birth, Now tracks this baby's movements: tap when you feel one, or count kicks. When the baby arrives, set the birth date below and the log carries on.")
                }
            }
            if baby.isExpected && !isNew {
                Section {
                    Button("Baby has arrived") {
                        baby.dueDate = nil
                        baby.birthDate = Date()
                    }
                    .accessibilityIdentifier("babyArrived")
                } footer: {
                    Text("Sets today as the birth date (change it above). Movements before birth stay in the log.")
                }
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
            if !baby.isExpected {
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
                ForEach(model.tokens.filter { !$0.name.hasPrefix("glasses:") }) { t in
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

// MARK: - Lifetime Access & Data Policy

struct PaywallView: View {
    @EnvironmentObject var model: AppModel

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                VStack(alignment: .leading, spacing: 6) {
                    HStack(spacing: 8) {
                        Image(systemName: "checkmark.seal.fill")
                            .font(.title2)
                            .foregroundStyle(Theme.accent)
                        Text("Wee Hours Lifetime")
                            .font(.largeTitle.bold())
                    }
                    Text("One-time purchase · Lifetime use for your newborn")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }

                VStack(alignment: .leading, spacing: 12) {
                    Text("Included Features").font(.headline)
                    Label("Voice logging with the on-device AI model", systemImage: "mic.fill")
                    Label("Apple Watch app, complications and Action Button", systemImage: "applewatch")
                    Label("Even G2 glasses and R1 ring companion support", systemImage: "eyeglasses")
                    Label("Smart reminders for whoever is on duty", systemImage: "bell.fill")
                    Label("AI assistant connectivity via MCP", systemImage: "sparkles")
                    Label("Family Sharing: one purchase covers your Apple family group", systemImage: "person.2.fill")
                }
                .font(.subheadline)
                .padding()
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Theme.card, in: RoundedRectangle(cornerRadius: 14))

                VStack(alignment: .leading, spacing: 8) {
                    HStack(spacing: 6) {
                        Image(systemName: "archivebox.fill").foregroundStyle(.orange)
                        Text("Data Retention Notice").font(.headline)
                    }
                    Text("In the future, baby data that is inactive for more than a year might be archived. If that happens, we will provide a way to download your complete archive and re-import it anytime.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
                .padding()
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Theme.card, in: RoundedRectangle(cornerRadius: 14))

                VStack(alignment: .leading, spacing: 10) {
                    Text("Legal & Privacy").font(.caption.bold()).foregroundStyle(.secondary)
                    HStack(spacing: 16) {
                        Link("Privacy Policy", destination: URL(string: "https://weehours.hejitech.workers.dev/privacy/")!)
                        Link("Terms of Use", destination: URL(string: "https://weehours.hejitech.workers.dev/terms/")!)
                    }
                    .font(.footnote)
                }
            }
            .padding()
        }
        .navigationTitle("Lifetime Access")
    }
}

/// Moves a local-only household onto an account: a new household made from this one, or the
/// partner's household if you have an invite code.
struct AttachAccountView: View {
    @EnvironmentObject var model: AppModel
    @Environment(\.webAuthenticationSession) private var webAuthenticationSession
    @State private var email = ""
    @State private var password = ""
    @State private var create = true
    @State private var code = ""
    @State private var working = false

    var body: some View {
        Form {
            Section {
                TextField("Partner's invite code (optional)", text: $code).textInputAutocapitalization(.characters)
            } footer: {
                Text("With a code, this phone's entries join your partner's log. Without one, your household is created on the server as it is now.")
            }

            Section {
                SignInWithAppleButton(.signIn) { req in req.requestedScopes = [.email] } onCompletion: { r in
                    working = true
                    Task {
                        await model.attachAccountWithApple(r, inviteCode: code.trimmingCharacters(in: .whitespaces))
                        working = false
                    }
                }
                .frame(height: 48)
                .signInWithAppleButtonStyle(.whiteOutline)

                Button {
                    working = true
                    Task {
                        await model.attachAccountWithGoogle(using: webAuthenticationSession, inviteCode: code.trimmingCharacters(in: .whitespaces))
                        working = false
                    }
                } label: {
                    Label("Continue with Google", systemImage: "g.circle.fill").frame(maxWidth: .infinity, minHeight: 40)
                }
                .buttonStyle(.bordered)
            } header: {
                Text("Sign in to sync")
            }

            #if DEBUG
            Section("Email (local development)") {
                Picker("", selection: $create) {
                    Text("New account").tag(true)
                    Text("I have one").tag(false)
                }
                .pickerStyle(.segmented)
                TextField("Email", text: $email).textContentType(.emailAddress).keyboardType(.emailAddress).textInputAutocapitalization(.never)
                SecureField("Password", text: $password)
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
            #endif
        }
        .navigationTitle("Sync and share")
    }
}

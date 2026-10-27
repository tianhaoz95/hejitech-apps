import FitLoopKit
import SwiftUI

/// The Settings tab: what the agent should know, every data option (on/off), what the agent may see,
/// reminders, glasses (pairing + display), agents, account, What's New, deleting data.
struct SettingsView: View {
    @Environment(AppModel.self) private var model
    @State private var draft = Settings.defaults
    @State private var saved = true
    @State private var confirmDelete = false
    @State private var whatsNew = false

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    NavigationLink("About you (for your agent)") { AboutEditor(about: $draft.about) }
                } footer: { Text("Your agent fills this in by interviewing you over MCP; you don't need to type it first. Every agent you connect reads it at the start of a session.") }
                Section {
                    Toggle("Live heart rate in workouts", isOn: $draft.vitals.liveHr)
                    Toggle("Daily Apple Health summary", isOn: $draft.vitals.healthDaily)
                    Toggle("Manual entries", isOn: $draft.vitals.manual)
                    Toggle("Progress photos", isOn: $draft.vitals.photos)
                } header: { Text("Data FitLoop keeps") } footer: { Text("Heart rate comes from your Apple Watch during a workout; Apple Health adds weight, resting HR, HRV, sleep, steps and active energy once a day. Never used for advertising, marketing or data mining.") }
                Section {
                    Toggle("Check-ins", isOn: $draft.agentAccess.checkins)
                    Toggle("Feedback notes", isOn: $draft.agentAccess.feedback)
                    Toggle("Vitals", isOn: $draft.agentAccess.vitals)
                    Toggle("Progress photo images", isOn: $draft.agentAccess.photos)
                } header: { Text("What your agent may see") } footer: { Text("Shared over MCP only with the third-party AI agents you connect. Vitals include Apple Health metrics (weight, resting HR, HRV, sleep, steps, active energy, workout HR) for the sources switched on above.") }
                Section {
                    Toggle("Before a workout", isOn: $draft.reminders.workout.on)
                    if draft.reminders.workout.on { Stepper("\(draft.reminders.workout.minutesBefore) min before", value: $draft.reminders.workout.minutesBefore, in: 0...120, step: 5) }
                    Toggle("At each meal", isOn: $draft.reminders.meals.on)
                    Toggle("Evening check-in nudge", isOn: $draft.reminders.evening.on)
                    if draft.reminders.evening.on { TimeRow(title: "At", hhmm: $draft.reminders.evening.time) }
                    Toggle("Weekly review for your agent", isOn: $draft.reminders.weekly.on)
                    if draft.reminders.weekly.on {
                        Picker("On", selection: $draft.reminders.weekly.weekday) { ForEach(Plan.weekdays, id: \.self) { Text($0.capitalized).tag($0) } }
                        TimeRow(title: "At", hhmm: $draft.reminders.weekly.time)
                    }
                } header: { Text("Reminders") }
                Section("Even G2") {
                    Toggle("Show heart rate", isOn: $draft.glasses.showHr)
                    Toggle("Start the rest timer after each set", isOn: $draft.glasses.autoRestTimer)
                    NavigationLink("Pair glasses") { GlassesPairing() }
                }
                Section {
                    Picker("Units", selection: $draft.units) { Text("Metric").tag("metric"); Text("Imperial").tag("imperial") }
                }
                Section("Agents") {
                    Link("Connect an agent (MCP)", destination: model.backend.config.site.appendingPathComponent("settings/"))
                    Text("Add \(model.backend.config.site.absoluteString)/mcp as a connector in Claude or another MCP client and sign in with this account.").font(.footnote).foregroundStyle(.secondary)
                }
                Section("Account") {
                    LabeledContent("Signed in as", value: model.email ?? "—")
                    Button("Sign out") { model.signOut() }
                }
                Section("About") {
                    Button("What's New") { whatsNew = true }
                    Link("Help", destination: model.backend.config.site.appendingPathComponent("support/"))
                    Link("Terms", destination: model.backend.config.site.appendingPathComponent("terms/"))
                    Link("Privacy", destination: model.backend.config.site.appendingPathComponent("privacy/"))
                    LabeledContent("Version", value: Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "")
                }
                Section {
                    Button("Delete my FitLoop data", role: .destructive) { confirmDelete = true }
                } footer: { Text("FitLoop shows your agent's plan and your records; it isn't medical advice.") }
            }
            .navigationTitle("Settings")
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button(saved ? "Saved" : "Save") {
                        Task {
                            if await model.save(draft) {
                                saved = true
                                await model.requestNotifications()
                            }
                        }
                    }
                    .disabled(saved)
                }
            }
            .onAppear { draft = model.settings; saved = true }
            .onChange(of: draft) { saved = draft == model.settings }
            .sheet(isPresented: $whatsNew) { WhatsNewView() }
            .confirmationDialog("Delete everything FitLoop keeps about you?", isPresented: $confirmDelete, titleVisibility: .visible) {
                Button("Delete", role: .destructive) { Task { await model.deleteData() } }
            }
        }
    }
}

struct AboutEditor: View {
    @Binding var about: Settings.About

    var body: some View {
        Form {
            Section("Goals") { TextField("e.g. lose 4 kg by December", text: $about.goals, axis: .vertical) }
            Section("Injuries and limits") { TextField("e.g. left knee: no jumping", text: $about.restrictions, axis: .vertical) }
            Section("Equipment") { TextField("e.g. dumbbells to 30 kg, bike", text: $about.equipment, axis: .vertical) }
            Section("When you can train") { TextField("e.g. 45 min at lunch on weekdays", text: $about.schedule, axis: .vertical) }
            Section("Diet") { TextField("e.g. vegetarian on weekdays", text: $about.diet, axis: .vertical) }
            Section("Anything else") { TextField("", text: $about.notes, axis: .vertical) }
        }
        .navigationTitle("About you")
    }
}

/// An "HH:MM" string edited with a time picker.
struct TimeRow: View {
    let title: String
    @Binding var hhmm: String

    var body: some View {
        DatePicker(title, selection: Binding(get: {
            let (h, m) = Day.time(hhmm) ?? (21, 0)
            return Calendar.current.date(bySettingHour: h, minute: m, second: 0, of: Date()) ?? Date()
        }, set: { d in
            let c = Calendar.current.dateComponents([.hour, .minute], from: d)
            hhmm = String(format: "%02d:%02d", c.hour ?? 0, c.minute ?? 0)
        }), displayedComponents: .hourAndMinute)
    }
}

/// A pairing code for the Even Hub plugin, and the paired glasses.
struct GlassesPairing: View {
    @Environment(AppModel.self) private var model
    @State private var code: PairingCode?
    @State private var devices: [PairedDevice] = []
    @State private var error: String?

    var body: some View {
        List {
            Section {
                if let code {
                    VStack(alignment: .leading, spacing: 8) {
                        Text(code.code.map(String.init).joined(separator: " ")).font(.system(size: 40, weight: .bold, design: .monospaced)).foregroundStyle(Color.accentColor)
                        Text("Open FitLoop in the Even app (Even Hub) and type this code. It works once, for ten minutes.").font(.footnote).foregroundStyle(.secondary)
                    }
                }
                Button(code == nil ? "Get a pairing code" : "Get a new code") {
                    Task { do { code = try await model.backend.pairingCode() } catch { self.error = error.localizedDescription } }
                }
            } footer: { Text("On the glasses: swipe through today, tap to open, tap a set done, hold for the menu (how-to, skip, notes), double-tap to go back or exit.") }
            Section("Paired glasses") {
                if devices.isEmpty { Text("None yet").foregroundStyle(.secondary) }
                ForEach(devices) { d in
                    Text(d.label).swipeActions { Button("Unpair", role: .destructive) { Task { try? await model.backend.unpair(d.id); await load() } } }
                }
            }
            if let error { Text(error).foregroundStyle(.red).font(.footnote) }
        }
        .navigationTitle("Glasses")
        .task { await load() }
    }

    private func load() async { devices = (try? await model.backend.devices()) ?? devices }
}

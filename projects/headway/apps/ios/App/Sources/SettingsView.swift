import HeadwayKit
import SwiftUI

/// The Settings tab: alerts permission, account, What's New, help, privacy, deleting data.
struct SettingsView: View {
    private var onTrainFooter: String {
        let detail: String
        switch model.settings.onTrain {
        case .off: detail = "Headway won't check whether you're on a train."
        case .card: detail = "With the app open, a card shows your next stop and arrival once you're riding. Tracking is one tap."
        case .auto: detail = "With the app open, the card appears and Headway starts tracking the train, so you get your stop alert and Live Activity."
        case .background: detail = "Headway also watches for a ride with the app closed and tells you when it starts tracking. This needs Always location and uses a little more battery."
        }
        return detail + " Your location is only used to find the train and is never stored."
    }

    @Environment(AppModel.self) private var model
    @State private var confirmDelete = false
    @State private var whatsNew = false
    @State private var tested = false

    var body: some View {
        NavigationStack {
            List {
                Section {
                    switch model.notificationsAllowed {
                    case .some(true):
                        Label("Alerts are on", systemImage: "bell.badge.fill").foregroundStyle(.green)
                        Button(tested ? "Test alert sent" : "Send a test alert") { Task { await model.sendTestAlert(); tested = true } }
                    case .some(false):
                        Label("Alerts are off", systemImage: "bell.slash")
                        Button("Open iPhone Settings") {
                            if let url = URL(string: UIApplication.openNotificationSettingsURLString) { UIApplication.shared.open(url) }
                        }
                    case .none:
                        Button("Turn on alerts") { Task { await model.requestNotifications() } }
                    }
                    Picker("Which alerts", selection: Binding(get: { model.settings.alerts.scope }, set: { s in Task { await model.setAlertScope(s) } })) {
                        ForEach(AlertScope.allCases, id: \.self) { Text($0.title).tag($0) }
                    }
                    Toggle("Stop once my commute is done", isOn: Binding(get: { model.settings.alerts.stopWhenDone }, set: { on in Task { await model.setStopWhenDone(on) } }))
                } header: {
                    Text("iPhone alerts")
                } footer: {
                    Text("Once your location shows you got off at your commute's stop, Headway stops that leg's delay, cancellation and leave-now alerts for the rest of the day; the Trains tab says so and can turn them back on for the day. Priority alerts affect your commute: your direction, inside your watch window, and the train you track. Priority and quiet adds delays and notices for your stations at other times or the other way; those arrive silently in Notification Center. Choose which kinds of alerts in the Commute tab.")
                }
                Section {
                    Picker("When I'm riding", selection: Binding(get: { model.settings.onTrain }, set: { m in Task { await model.setOnTrainMode(m) } })) {
                        ForEach(OnTrainMode.allCases, id: \.self) { Text($0.title).tag($0) }
                    }
                } header: {
                    Text("On a train")
                } footer: {
                    Text(onTrainFooter)
                }
                Section {
                    Toggle("Estimate my trip from where I am", isOn: Binding(get: { model.useLocation }, set: { on in Task { await model.setUseLocation(on) } }))
                } header: {
                    Text("Location")
                } footer: {
                    Text("Headway measures how far you are from your departure station and estimates the walk or drive (set per leg in Commute) at an average speed, so leave-by times and how many minutes you have to spare fit where you are. It's a rough estimate without routes or traffic. Your location goes with each board request and is never stored.")
                }
                Section("Devices") {
                    NavigationLink {
                        GlassesView()
                    } label: {
                        Label("Even G2 Glasses", systemImage: "eyeglasses")
                    }
                }
                AssistantsSection()
                PassSettingsSection()
                Section("Account") {
                    LabeledContent("Signed in as", value: model.email ?? "—")
                    Button("Sign out") { Task { await model.signOut() } }
                }
                Section("About") {
                    Button("What's New") { whatsNew = true }
                    Link("Help", destination: model.backend.config.site.appendingPathComponent("support/"))
                    Link("Privacy", destination: model.backend.config.site.appendingPathComponent("privacy/"))
                    Link("Web settings", destination: model.backend.config.site.appendingPathComponent("settings/"))
                    LabeledContent("Version", value: Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "")
                }
                Section {
                    Button("Delete my Headway data", role: .destructive) { confirmDelete = true }
                } footer: {
                    Text("Removes your commute, alert choices, paired glasses, iPhones, your family group (or your place in one) and assistant connections from Headway. Headway isn't affiliated with Caltrain.")
                }
            }
            .navigationTitle("Settings")
            .sheet(isPresented: $whatsNew) { WhatsNewView() }
            .confirmationDialog("Delete everything Headway keeps about you?", isPresented: $confirmDelete, titleVisibility: .visible) {
                Button("Delete", role: .destructive) { Task { await model.deleteData() } }
            }
            .task { await model.registerForPushIfAllowed() }
        }
    }
}

/// Settings › Assistants: whether connected assistants (MCP) may change the commute, and every change
/// they made, with Undo. Off until the rider turns it on; no assistant can reach this switch.
struct AssistantsSection: View {
    @Environment(AppModel.self) private var model
    @State private var showAll = false

    var body: some View {
        Section {
            Toggle("Let assistants change my commute", isOn: Binding(
                get: { model.agentAccess?.editSettings ?? false },
                set: { on in Task { await model.setAgentEditing(on) } }
            ))
            .disabled(model.agentAccess == nil)
            let changes = model.agentAccess?.changes ?? []
            ForEach(showAll ? changes : Array(changes.prefix(3))) { c in
                AgentChangeRow(change: c)
            }
            if changes.count > 3 && !showAll {
                Button("Show all \(changes.count) changes") { showAll = true }
            }
            if let e = model.agentError {
                Text(e).font(.footnote).foregroundStyle(.red)
            }
            Link("Connect an assistant (MCP)", destination: model.backend.config.site.appendingPathComponent("settings/"))
        } header: {
            Text("Assistants")
        } footer: {
            Text("With this on, assistants you've connected, like Claude, can change your stations, usual trains, how you get to the station, commute days and alerts. Your iPhone tells you each time, and you can undo it here. They can't change on-train mode, family or devices. Assistants can always read your commute and trains.")
        }
        .task { await model.loadAgentAccess() }
    }
}

struct AgentChangeRow: View {
    @Environment(AppModel.self) private var model
    let change: AgentChange
    @State private var undoing = false

    var body: some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 3) {
                Text(change.client ?? "An assistant").font(.subheadline.weight(.semibold))
                if let d = change.createdDate {
                    Text(d, format: .relative(presentation: .named)).font(.caption).foregroundStyle(.secondary)
                }
                ForEach(change.summary, id: \.self) { line in
                    Text(line).font(.footnote).foregroundStyle(change.undoneAt == nil ? .primary : .secondary)
                }
            }
            Spacer(minLength: 8)
            if change.undoneAt != nil {
                Text("Undone").font(.caption).foregroundStyle(.secondary)
            } else {
                Button(undoing ? "Undoing…" : "Undo") {
                    undoing = true
                    Task { await model.undoAgentChange(change); undoing = false }
                }
                .buttonStyle(.bordered)
                .controlSize(.small)
                .disabled(undoing)
            }
        }
        .accessibilityElement(children: .combine)
    }
}

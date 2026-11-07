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
                } header: {
                    Text("iPhone alerts")
                } footer: {
                    Text("Priority alerts affect your commute: your direction, inside your watch window, and the train you track. Priority and quiet adds delays and notices for your stations at other times or the other way; those arrive silently in Notification Center. Choose which kinds of alerts in the Commute tab.")
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
                Section("Account") {
                    LabeledContent("Signed in as", value: model.email ?? "—")
                    Button("Sign out") { Task { await model.signOut() } }
                }
                Section("About") {
                    Button("What's New") { whatsNew = true }
                    Link("Help", destination: model.backend.config.site.appendingPathComponent("support/"))
                    Link("Privacy", destination: model.backend.config.site.appendingPathComponent("privacy/"))
                    Link("Assistants (MCP) and web settings", destination: model.backend.config.site.appendingPathComponent("settings/"))
                    LabeledContent("Version", value: Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "")
                }
                Section {
                    Button("Delete my Headway data", role: .destructive) { confirmDelete = true }
                } footer: {
                    Text("Removes your commute, alert choices, paired glasses, iPhones and assistant connections from Headway. Headway isn't affiliated with Caltrain.")
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

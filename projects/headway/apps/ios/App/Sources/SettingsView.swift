import SwiftUI

/// The Settings tab: alerts permission, account, What's New, help, privacy, deleting data.
struct SettingsView: View {
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
                } header: {
                    Text("iPhone alerts")
                } footer: {
                    Text("Choose which alerts in the Commute tab.")
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

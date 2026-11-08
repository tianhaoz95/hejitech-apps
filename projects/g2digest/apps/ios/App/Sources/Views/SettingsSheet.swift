import SwiftUI

public struct SettingsSheet: View {
    @ObservedObject var appModel: AppModel
    @Environment(\.dismiss) private var dismiss

    @State private var serverURLString: String = ""
    @State private var showSavedNotice: Bool = false

    public init(appModel: AppModel) {
        self.appModel = appModel
    }

    public var body: some View {
        NavigationStack {
            Form {
                Section("Connection & Pairing") {
                    HStack {
                        Text("Status")
                        Spacer()
                        Text(appModel.isPaired ? "Paired" : "Unpaired (Tour Mode)")
                            .foregroundStyle(appModel.isPaired ? Color.green : Color.secondary)
                    }

                    Button {
                        dismiss()
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
                            appModel.showPairingSheet = true
                        }
                    } label: {
                        Text(appModel.isPaired ? "Manage Pairing" : "Pair iPhone")
                    }
                }

                Section("Server Environment") {
                    TextField("Server URL", text: $serverURLString)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)
                        .keyboardType(.URL)

                    Button("Reset to Production") {
                        serverURLString = AppModel.defaultServerURL.absoluteString
                        saveURL()
                    }

                    Button("Set to Local Stack (127.0.0.1:8790)") {
                        serverURLString = "http://127.0.0.1:8790"
                        saveURL()
                    }

                    if showSavedNotice {
                        Text("Server updated and refreshed.")
                            .font(.caption)
                            .foregroundStyle(.green)
                    }
                }

                Section("App Information") {
                    Button {
                        dismiss()
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
                            appModel.showWhatsNewSheet = true
                        }
                    } label: {
                        HStack {
                            Text("What's New")
                            Spacer()
                            Image(systemName: "chevron.right")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }

                    HStack {
                        Text("Version")
                        Spacer()
                        Text(WhatsNewView.currentVersion)
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") {
                        if let url = URL(string: serverURLString), url != AppModel.defaultServerURL {
                            appModel.updateServerURL(url)
                        }
                        dismiss()
                    }
                }
            }
            .onAppear {
                serverURLString = UserDefaults.standard.string(forKey: "g2digest_server_url")
                    ?? AppModel.defaultServerURL.absoluteString
            }
        }
    }

    private func saveURL() {
        if let url = URL(string: serverURLString) {
            appModel.updateServerURL(url)
            withAnimation {
                showSavedNotice = true
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
                withAnimation {
                    showSavedNotice = false
                }
            }
        }
    }
}

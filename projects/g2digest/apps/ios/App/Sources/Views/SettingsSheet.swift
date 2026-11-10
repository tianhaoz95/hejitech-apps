import SwiftUI
import G2DigestKit

public struct SettingsSheet: View {
    @ObservedObject var appModel: AppModel
    @Environment(\.dismiss) private var dismiss

    @State private var serverURLString: String = ""
    @State private var pairingCode: PairingCode?
    @State private var makingCode = false
    @State private var confirmDelete = false
    @State private var deleting = false

    public init(appModel: AppModel) {
        self.appModel = appModel
    }

    public var body: some View {
        NavigationStack {
            Form {
                if let account = appModel.account {
                    Section("Account") {
                        LabeledContent("Signed in as", value: account.email ?? "your HEJI account")
                        Button("Sign Out") {
                            Task { await appModel.signOut(); dismiss() }
                        }
                    }

                    Section {
                        if let pc = pairingCode {
                            VStack(spacing: 6) {
                                Text(pc.code)
                                    .font(.system(size: 40, weight: .bold, design: .monospaced))
                                    .kerning(6)
                                    .textSelection(.enabled)
                                Text("Type it in G2 Digest on your glasses within ten minutes.")
                                    .font(.footnote)
                                    .foregroundStyle(.secondary)
                                    .multilineTextAlignment(.center)
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 6)
                        }
                        Button {
                            Task {
                                makingCode = true
                                pairingCode = await appModel.newPairingCode()
                                makingCode = false
                            }
                        } label: {
                            HStack {
                                Text(pairingCode == nil ? "Get a Pairing Code" : "Get a New Code")
                                if makingCode { Spacer(); ProgressView() }
                            }
                        }
                        ForEach(appModel.devices) { d in
                            VStack(alignment: .leading, spacing: 2) {
                                Text(d.label ?? d.kind.capitalized)
                                Text("\(kindName(d.kind)) · paired \(shortDate(d.createdAt))")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            .swipeActions {
                                Button("Unpair", role: .destructive) { Task { await appModel.revokeDevice(d) } }
                            }
                        }
                    } header: {
                        Text("Glasses & Devices")
                    } footer: {
                        Text("Swipe left on a device to unpair it. It stops working right away.")
                    }

                    Section {
                        Button(role: .destructive) { confirmDelete = true } label: {
                            HStack {
                                Text("Delete All My G2 Digest Data")
                                if deleting { Spacer(); ProgressView() }
                            }
                        }
                        .disabled(deleting)
                    } footer: {
                        Text("Permanently deletes your brief, editions, audio, paired glasses, feeds, tokens and connected assistants, then signs you out.")
                    }
                } else {
                    Section("Connection") {
                        LabeledContent("Status", value: appModel.isPaired ? "Paired with a code" : "Not signed in")
                        Button("Sign In with Apple or Google") {
                            dismiss()
                            DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { appModel.showPairingSheet = true }
                        }
                        if appModel.isPaired {
                            Button("Unpair This iPhone", role: .destructive) { appModel.unpair(); dismiss() }
                        }
                    }
                }

                if let err = appModel.errorMessage {
                    Section { Text(err).font(.footnote).foregroundStyle(.red) }
                }

                #if DEBUG
                Section("Server Environment (Debug)") {
                    TextField("Server URL", text: $serverURLString)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)
                        .keyboardType(.URL)
                    Button("Use Production") {
                        serverURLString = AppModel.defaultServerURL.absoluteString
                        saveURL()
                    }
                    Button("Use Local Stack (127.0.0.1:8790)") {
                        serverURLString = "http://127.0.0.1:8790"
                        saveURL()
                    }
                }
                #endif

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
                    LabeledContent("Version", value: WhatsNewView.currentVersion)
                }
            }
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                }
            }
            .refreshable { await appModel.loadDevices() }
            .task { await appModel.loadDevices() }
            .onAppear {
                serverURLString = UserDefaults.standard.string(forKey: "g2digest_server_url")
                    ?? AppModel.defaultServerURL.absoluteString
            }
            .alert("Delete all your G2 Digest data?", isPresented: $confirmDelete) {
                Button("Delete Everything", role: .destructive) {
                    Task {
                        deleting = true
                        let ok = await appModel.deleteAllData()
                        deleting = false
                        if ok { dismiss() }
                    }
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("Your brief, every edition and its audio, paired glasses, feeds, tokens and connected assistants. This can't be undone.")
            }
        }
    }

    private func kindName(_ kind: String) -> String {
        switch kind {
        case "glasses": return "Glasses or phone"
        case "feed": return "Podcast feed"
        default: return kind.capitalized
        }
    }

    private func shortDate(_ iso: String) -> String {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let d = f.date(from: iso) ?? ISO8601DateFormatter().date(from: iso)
        return d.map { $0.formatted(date: .abbreviated, time: .omitted) } ?? String(iso.prefix(10))
    }

    private func saveURL() {
        if let url = URL(string: serverURLString) {
            appModel.updateServerURL(url)
        }
    }
}

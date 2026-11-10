import SwiftUI
import TradeboardKit

public struct SettingsView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss

    @State private var showWhatsNew = false
    @State private var showSignOutConfirm = false

    public init() {}

    private var currentEmail: String {
        if case .authenticated(let email) = model.authPhase {
            return email ?? "Active Account"
        }
        return "Not signed in"
    }

    public var body: some View {
        NavigationStack {
            List {
                Section("Account") {
                    HStack {
                        Label("Signed In", systemImage: "person.crop.circle.fill")
                        Spacer()
                        Text(currentEmail)
                            .foregroundStyle(.secondary)
                    }

                    HStack {
                        Label("Session Status", systemImage: "key.fill")
                        Spacer()
                        Text("Verified via TOTP")
                            .font(.footnote)
                            .foregroundStyle(.green)
                    }
                }

                Section("Trading Plan Controls") {
                    NavigationLink {
                        StrategyView()
                    } label: {
                        Label("Trading Strategy", systemImage: "sparkles")
                    }

                    NavigationLink {
                        PolicyView()
                    } label: {
                        Label("Safety Policy & Limits", systemImage: "lock.shield")
                    }

                    NavigationLink {
                        ExecutorsView()
                    } label: {
                        Label("Connected Hosts & Models", systemImage: "cpu")
                    }
                }

                Section("Environment") {
                    Picker("Server", selection: Binding(
                        get: { model.config == .production ? "production" : "local" },
                        set: { val in
                            model.config = val == "production" ? .production : .local
                            Task { await model.refresh() }
                        }
                    )) {
                        Text("Production (Cloudflare)").tag("production")
                        Text("Local Stack (127.0.0.1:8798)").tag("local")
                    }
                }

                Section("About") {
                    Button {
                        showWhatsNew = true
                    } label: {
                        Label("What's New in Tradeboard", systemImage: "gift")
                    }

                    HStack {
                        Text("Version")
                        Spacer()
                        Text(WhatsNewView.currentVersion)
                            .foregroundStyle(.secondary)
                    }
                }

                Section {
                    Button(role: .destructive) {
                        showSignOutConfirm = true
                    } label: {
                        HStack {
                            Spacer()
                            Text("Sign Out")
                            Spacer()
                        }
                    }
                }
            }
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
            .sheet(isPresented: $showWhatsNew) {
                WhatsNewView()
            }
            .confirmationDialog("Sign Out of Tradeboard?", isPresented: $showSignOutConfirm, titleVisibility: .visible) {
                Button("Sign Out", role: .destructive) {
                    Task {
                        await model.signOut()
                        dismiss()
                    }
                }
                Button("Cancel", role: .cancel) {}
            }
        }
    }
}

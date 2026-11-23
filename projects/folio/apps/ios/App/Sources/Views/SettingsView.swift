import FolioKit
import SwiftUI

struct SettingsView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var confirmSignOut = false
    @State private var confirmDelete = false
    @State private var showWhatsNew = false
    @State private var inviteLink = ""

    var body: some View {
        @Bindable var model = model
        NavigationStack {
            Form {
                Section {
                    LabeledContent("Signed in as", value: model.email ?? "Apple ID (email hidden)")
                }

                Section {
                    Toggle("Notifications", isOn: Binding(get: { model.pushEnabled }, set: { on in Task { await model.setPushEnabled(on) } }))
                    if model.pushEnabled {
                        Toggle("Suggestions", isOn: $model.pushPrefs.suggestions)
                        Toggle("Comments", isOn: $model.pushPrefs.comments)
                        Toggle("New versions from agents", isOn: $model.pushPrefs.edits)
                    }
                } header: {
                    Text("Notifications")
                } footer: {
                    Text("Folio tells you when your agents or the people you share with suggest a change, comment or save a version. What you do yourself in Folio doesn't notify you. Accept, reject or reply right from the notification.")
                }
                .onChange(of: model.pushPrefs) { _, _ in Task { await model.savePushPrefs() } }

                Section {
                    NavigationLink { ProView() } label: {
                        LabeledContent {
                            Text(model.pro.map { $0.pro ? "Pro" : "Free" } ?? "")
                        } label: {
                            Label("Folio Pro", systemImage: "seal")
                        }
                    }
                } header: {
                    Text("Plan")
                } footer: {
                    Text("Webhooks (Pro) are set up on Folio's site, in Settings.")
                }

                Section("Agents") {
                    NavigationLink { ConnectView() } label: { Label("Connect an agent", systemImage: "point.3.connected.trianglepath.dotted") }
                    NavigationLink { TokensView() } label: { Label("Agent tokens", systemImage: "key") }
                }

                Section {
                    HStack {
                        TextField("Paste an invite link", text: $inviteLink)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                        Button("Open") {
                            if let u = URL(string: inviteLink.trimmingCharacters(in: .whitespaces)), AppModel.inviteToken(u) != nil {
                                dismiss()
                                model.handle(url: u)
                            } else {
                                model.flash("That isn't a Folio invite link.")
                            }
                        }
                        .disabled(inviteLink.isEmpty)
                    }
                } header: {
                    Text("Invites")
                } footer: {
                    Text("Invite links open in Folio when you tap them, or paste one here.")
                }

                Section {
                    Button { showWhatsNew = true } label: { Label("What's new", systemImage: "sparkles") }
                    Link(destination: model.config.site.appendingPathComponent("support/")) { Label("Help", systemImage: "questionmark.circle") }
                    Link(destination: model.config.site.appendingPathComponent("privacy/")) { Label("Privacy", systemImage: "hand.raised") }
                    Link(destination: model.config.site.appendingPathComponent("terms/")) { Label("Terms", systemImage: "doc.text") }
                } footer: {
                    Text("Folio \(Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "") (\(Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? ""))\(model.config.isLocal ? " · local" : "")")
                }

                Section {
                    Button("Sign out") { confirmSignOut = true }
                    Button("Delete my Folio data", role: .destructive) { confirmDelete = true }
                } footer: {
                    Text("Deleting removes everything Folio keeps for you: your artifacts and their history, your access to artifacts shared with you, agent connections and this device. Your comments and versions on other people's artifacts stay, without your name. Your sign-in is shared with other HEJI apps and isn't affected.")
                }
            }
            .paperBackground()
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
            .sheet(isPresented: $showWhatsNew) { WhatsNewView() }
            .task { await model.refreshPro() }
            .confirmationDialog("Sign out of Folio?", isPresented: $confirmSignOut, titleVisibility: .visible) {
                Button("Sign out", role: .destructive) {
                    Task {
                        await model.signOut()
                        dismiss()
                    }
                }
            }
            .alert("Delete your Folio data?", isPresented: $confirmDelete) {
                Button("Delete", role: .destructive) {
                    Task {
                        do {
                            try await model.deleteAllData()
                            dismiss()
                        } catch { model.flash(error.localizedDescription) }
                    }
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("Your artifacts and their history are deleted for everyone they're shared with. This can't be undone.")
            }
        }
    }
}

/// How to connect each agent: the MCP address and the one step each client needs.
struct ConnectView: View {
    /// Opened as a sheet (the empty home screen) rather than pushed from Settings.
    var showsDone = false
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss

    private var mcp: String { model.config.mcpURL.absoluteString }

    var body: some View {
        List {
            Section {
                CopyRow(label: "Folio's MCP address", value: mcp)
            } footer: {
                Text("Add Folio to an agent with this address. It signs in to your Folio account the first time, so everything it makes shows up here.")
            }
            Section("Claude (app, web, desktop)") {
                Text("Settings → Connectors → Add custom connector. Name it Folio and paste the address above. A connector added on claude.ai also works in the Claude app on this iPhone.")
                    .font(.subheadline)
            }
            Section("Claude Code") {
                CopyRow(label: "Run", value: "claude mcp add --transport http folio \(mcp)", mono: true)
                Text("Then /mcp → folio → Authenticate.").font(.subheadline).foregroundStyle(.secondary)
            }
            Section("Gemini CLI") {
                CopyRow(label: "~/.gemini/settings.json", value: "{ \"mcpServers\": { \"folio\": { \"httpUrl\": \"\(mcp)\" } } }", mono: true)
                Text("Then /mcp auth folio.").font(.subheadline).foregroundStyle(.secondary)
            }
            Section("ChatGPT") {
                Text("Settings → Apps & Connectors → Advanced settings → Developer mode, then create a connector with the address above and OAuth.").font(.subheadline)
            }
            Section("Codex") {
                CopyRow(label: "~/.codex/config.toml", value: "[mcp_servers.folio]\nurl = \"\(mcp)\"", mono: true)
                Text("Then codex mcp login folio.").font(.subheadline).foregroundStyle(.secondary)
            }
            Section("Other agents") {
                Text("Any MCP client with remote (Streamable HTTP) servers works. One that can't sign in can use an agent token instead.").font(.subheadline)
                NavigationLink("Agent tokens") { TokensView() }
            }
            Section {
                Link(destination: model.config.site.appendingPathComponent("connect/")) { Label("Full guide on the web", systemImage: "safari") }
            }
        }
        .paperBackground()
        .navigationTitle("Connect an agent")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if showsDone {
                ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } }
            }
        }
    }
}

struct CopyRow: View {
    @Environment(AppModel.self) private var model
    let label: String
    let value: String
    var mono = false

    var body: some View {
        Button {
            UIPasteboard.general.string = value
            model.flash("Copied")
        } label: {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(label).font(.caption).foregroundStyle(.secondary)
                    Text(value).font(mono ? .footnote.monospaced() : .body).foregroundStyle(.primary).textSelection(.enabled)
                }
                Spacer()
                Image(systemName: "doc.on.doc").foregroundStyle(Color.accentColor)
            }
        }
        .accessibilityHint("Copies it")
    }
}

/// Personal tokens for agents that can't sign in (sent as `Authorization: Bearer fol_…`).
struct TokensView: View {
    @Environment(AppModel.self) private var model
    @State private var tokens: [AgentToken] = []
    @State private var name = ""
    @State private var made: NewToken?

    var body: some View {
        List {
            Section {
                HStack {
                    TextField("Name, e.g. My script", text: $name)
                    Button("Make") {
                        Task {
                            do {
                                made = try await model.api.makeToken(name: name.isEmpty ? "Agent" : name)
                                name = ""
                                await load()
                            } catch { model.flash(error.localizedDescription) }
                        }
                    }
                }
                if let made {
                    CopyRow(label: "Copy it now: it isn't shown again", value: made.token, mono: true)
                }
            } footer: {
                Text("Agents that sign in themselves don't need one. A token can do anything you can in Folio except delete artifacts.")
            }
            if !tokens.isEmpty {
                Section("Tokens") {
                    ForEach(tokens) { t in
                        VStack(alignment: .leading, spacing: 2) {
                            Text(t.name)
                            Text(t.last_used_at.map { "Used \($0.formatted(.relative(presentation: .named)))" } ?? "Never used").font(.caption).foregroundStyle(.secondary)
                        }
                        .swipeActions {
                            Button("Revoke", role: .destructive) {
                                Task {
                                    try? await model.api.revokeToken(t.id)
                                    await load()
                                }
                            }
                        }
                    }
                }
            }
        }
        .paperBackground()
        .navigationTitle("Agent tokens")
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
    }

    private func load() async {
        tokens = (try? await model.api.tokens()) ?? tokens
    }
}

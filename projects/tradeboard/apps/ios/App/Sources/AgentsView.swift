import SwiftUI
import TradeboardKit
import UIKit
import UniformTypeIdentifiers

/// Settings → Connect an Agent: the portal's Agents page on the phone (Board MCP address, register an
/// agent, make, copy and revoke tokens, disconnect OAuth apps). Same /api/agents endpoints.
struct AgentsView: View {
    @Environment(AppModel.self) private var model

    @State private var data = AgentsResponse()
    @State private var loading = true
    @State private var error: String?
    @State private var newId = ""
    @State private var newName = ""
    @State private var revealed: NewAgentToken?
    @State private var confirmRevokeAgent: AgentItem?
    @State private var copiedURL = false
    @State private var creating = false

    private var mcp: String { model.backend.mcpURL.absoluteString }

    var body: some View {
        List {
            Section {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Board MCP")
                        .font(.headline)
                    Text(mcp)
                        .font(.callout.monospaced())
                        .textSelection(.enabled)
                    Button {
                        UIPasteboard.general.string = mcp
                        copiedURL = true
                    } label: {
                        Label(copiedURL ? "Copied" : "Copy URL", systemImage: copiedURL ? "checkmark" : "doc.on.doc")
                    }
                    .buttonStyle(.bordered)
                    .accessibilityIdentifier("copy-mcp-url")
                }
                .padding(.vertical, 4)
            } header: {
                Text("Option 1 · Apps with OAuth")
            } footer: {
                Text("Claude, ChatGPT, Gemini and other apps that support OAuth: add a custom connector with this URL. You'll sign in and pick which agent it speaks as; no token needed.")
            }

            Section {
                TextField("Agent name (e.g. claude-code)", text: $newId)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .font(.body.monospaced())
                    .accessibilityIdentifier("token-agent-id")
                    .submitLabel(.go)
                    .onSubmit {
                        if isValidAgentId(newId.trimmingCharacters(in: .whitespaces)) { Task { await createToken() } }
                    }
                TextField("Display name (optional)", text: $newName)
                Button {
                    Task { await createToken() }
                } label: {
                    HStack {
                        Label("Create Token", systemImage: "key.horizontal.fill")
                        Spacer()
                        if creating { ProgressView() }
                    }
                }
                .disabled(creating || !isValidAgentId(newId.trimmingCharacters(in: .whitespaces)))
                .accessibilityIdentifier("create-token")
                if !newId.isEmpty && !isValidAgentId(newId.trimmingCharacters(in: .whitespaces)) {
                    Text("2–32 lowercase letters, digits, - or _, starting with a letter.")
                        .font(.footnote)
                        .foregroundStyle(.orange)
                }
            } header: {
                Text("Option 2 · Token, for agents without OAuth")
            } footer: {
                Text("For Claude Code, scripts and other MCP clients that take a header: name the agent and tap Create Token. You get the token once, plus a ready Claude Code command and MCP config, sent as Authorization: Bearer tba_…. Agents can draft and debate plans but can't approve, change the policy, control the executor or reach Robinhood.")
            }

            if let error {
                Section {
                    Label(error, systemImage: "exclamationmark.circle.fill")
                        .font(.footnote)
                        .foregroundStyle(.red)
                }
            }

            if loading && data.agents.isEmpty {
                Section { ProgressView() }
            }

            ForEach(data.agents) { a in
                Section {
                    let tokens = data.tokens.filter { $0.agent_id == a.agent_id }
                    let grants = data.grants.filter { $0.agent_id == a.agent_id }
                    ForEach(tokens) { t in
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Token “\(t.label ?? "token")”")
                                Text("Issued \(short(t.created_at)) · last used \(short(t.last_used_at))")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            Spacer()
                            Button("Revoke", role: .destructive) {
                                Task { await act { try await model.backend.revokeAgentToken(id: t.id) } }
                            }
                            .buttonStyle(.borderless)
                        }
                    }
                    ForEach(grants) { g in
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("OAuth connection\(g.client_name.map { " from \($0)" } ?? "")")
                                Text(short(g.created_at))
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            Spacer()
                            Button("Disconnect", role: .destructive) {
                                Task { await act { try await model.backend.disconnectGrant(id: g.id) } }
                            }
                            .buttonStyle(.borderless)
                        }
                    }
                    if a.revoked_at == nil {
                        Button {
                            Task { await newToken(a.agent_id) }
                        } label: {
                            Label("New Token", systemImage: "key.horizontal")
                        }
                        .accessibilityIdentifier("new-token-\(a.agent_id)")
                        Button(role: .destructive) {
                            confirmRevokeAgent = a
                        } label: {
                            Label("Revoke Agent", systemImage: "xmark.octagon")
                        }
                    }
                } header: {
                    HStack {
                        Text(a.display_name ?? a.agent_id)
                        Text(a.agent_id).font(.caption.monospaced())
                        Spacer()
                        Text(a.revoked_at == nil ? "Active" : "Revoked")
                            .foregroundStyle(a.revoked_at == nil ? .green : .secondary)
                    }
                }
            }
        }
        .navigationTitle("Connect an Agent")
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
        .refreshable { await load() }
        .sheet(item: $revealed) { t in
            TokenSheet(token: t, mcp: mcp)
        }
        .confirmationDialog("Revoke \(confirmRevokeAgent?.agent_id ?? "")?", isPresented: Binding(get: { confirmRevokeAgent != nil }, set: { if !$0 { confirmRevokeAgent = nil } }), titleVisibility: .visible) {
            Button("Revoke Agent", role: .destructive) {
                if let a = confirmRevokeAgent {
                    Task { await act { try await model.backend.revokeAgent(agentId: a.agent_id) } }
                }
            }
        } message: {
            Text("Its tokens stop working and its OAuth connections are disconnected.")
        }
    }

    private func short(_ iso: String?) -> String {
        guard let iso else { return "never" }
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let d = f.date(from: iso) ?? ISO8601DateFormatter().date(from: iso)
        return d?.formatted(date: .abbreviated, time: .shortened) ?? iso
    }

    private func load() async {
        loading = true
        defer { loading = false }
        do {
            data = try await model.backend.getAgents()
            error = nil
        } catch {
            self.error = "Couldn't load agents: \(error.localizedDescription)"
        }
    }

    private func act(_ f: () async throws -> Void) async {
        do {
            try await f()
            error = nil
        } catch {
            self.error = error.localizedDescription
        }
        await load()
    }

    /// Registers the agent if it's new (or was revoked) and makes its first token in one step.
    private func createToken() async {
        let id = newId.trimmingCharacters(in: .whitespaces)
        creating = true
        defer { creating = false }
        do {
            if !data.agents.contains(where: { $0.agent_id == id && $0.revoked_at == nil }) {
                try await model.backend.registerAgent(id: id, displayName: newName.trimmingCharacters(in: .whitespaces))
            }
            revealed = try await model.backend.newAgentToken(agentId: id)
            newId = ""
            newName = ""
            error = nil
        } catch {
            self.error = "Couldn't create the token: \(error.localizedDescription)"
        }
        await load()
    }

    private func newToken(_ agentId: String) async {
        do {
            revealed = try await model.backend.newAgentToken(agentId: agentId)
            error = nil
        } catch {
            self.error = "Couldn't make a token: \(error.localizedDescription)"
        }
        await load()
    }
}

extension NewAgentToken: Identifiable {}

/// The new token, shown once, with ready-to-paste setups.
private struct TokenSheet: View {
    let token: NewAgentToken
    let mcp: String
    @Environment(\.dismiss) private var dismiss
    @State private var copied: String?

    private var claudeCode: String {
        "claude mcp add --transport http tradeboard \(mcp) --header \"Authorization: Bearer \(token.token)\""
    }

    private var json: String {
        """
        {
          "mcpServers": {
            "tradeboard": {
              "type": "http",
              "url": "\(mcp)",
              "headers": { "Authorization": "Bearer \(token.token)" }
            }
          }
        }
        """
    }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Text("Shown only once. Copy it now; if you lose it, make a new one and revoke this one. Copied tokens clear from the clipboard after 10 minutes.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
                block("Token for \(token.agent_id)", token.token, key: "token")
                block("Board MCP URL", mcp, key: "url")
                block("Claude Code", claudeCode, key: "claude")
                block("MCP config (JSON)", json, key: "json")
            }
            .navigationTitle("New Token")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } }
            }
        }
    }

    private func block(_ title: String, _ text: String, key: String) -> some View {
        Section(title) {
            Text(text)
                .font(.caption.monospaced())
                .textSelection(.enabled)
            Button {
                UIPasteboard.general.setItems([[UTType.utf8PlainText.identifier: text]], options: [.expirationDate: Date().addingTimeInterval(600)])
                copied = key
            } label: {
                Label(copied == key ? "Copied" : "Copy", systemImage: copied == key ? "checkmark" : "doc.on.doc")
            }
            .accessibilityIdentifier("copy-\(key)")
        }
    }
}

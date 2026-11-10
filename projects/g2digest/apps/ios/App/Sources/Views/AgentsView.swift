import SwiftUI
import G2DigestKit

/// The web app's Build agents page and the agent half of its Pair page: the MCP address and the one
/// prompt to copy, agent tokens (made here, shown once) and assistants connected over OAuth.
struct AgentsView: View {
    @ObservedObject var appModel: AppModel
    @State private var tokenName = "Daily build"
    @State private var newToken: String?
    @State private var making = false
    @State private var copied: String?

    var body: some View {
        Form {
            Section {
                Text("An agent compiles each edition ahead of time: it reads your brief, researches each section, writes the edition and the cards, makes the audio, checks everything and publishes. Any agent that can use an MCP server and produce audio can do it, on any schedule.")
                    .font(.callout)
                    .foregroundStyle(.secondary)
            }

            Section {
                copyRow(label: "MCP server", value: appModel.mcpURL, mono: true)
                copyRow(label: "Token config", value: tokenConfig, mono: true)
            } header: {
                Text("1. Connect")
            } footer: {
                Text("Streamable HTTP. Agents with OAuth support ask you to approve them; others use a token from below.")
            }

            Section {
                DisclosureGroup("Show the prompt") {
                    Text(Self.prompt)
                        .font(.footnote.monospaced())
                        .textSelection(.enabled)
                        .padding(.vertical, 4)
                }
                Button { copy(Self.prompt, "prompt") } label: {
                    Label(copied == "prompt" ? "Copied" : "Copy the Prompt", systemImage: copied == "prompt" ? "checkmark" : "doc.on.doc")
                }
            } header: {
                Text("2. The prompt")
            } footer: {
                Text("It carries no card rules and no topics: the agent fetches the card guide and your brief live, so editing your brief changes tomorrow's edition with nothing else to update.")
            }

            Section {
                Text("Run it on your delivery days, about an hour before the delivery time in your brief: a Claude routine, a cron job around another agent, anything that can run a prompt.")
                    .font(.callout)
            } header: {
                Text("3. Schedule it")
            }

            Section {
                ForEach(appModel.tokens) { t in
                    VStack(alignment: .leading, spacing: 2) {
                        Text(t.name)
                        Text("Made \(when(t.createdAt)) · last used \(t.lastUsedAt.map(when) ?? "never")")
                            .font(.caption).foregroundStyle(.secondary)
                    }
                    .swipeActions { Button("Revoke", role: .destructive) { Task { await appModel.revokeToken(t) } } }
                }
                if appModel.tokens.isEmpty { Text("No agent tokens.").foregroundStyle(.secondary) }
                HStack {
                    TextField("Token name", text: $tokenName)
                    Button {
                        Task {
                            making = true
                            newToken = await appModel.createToken(name: tokenName)
                            making = false
                        }
                    } label: {
                        if making { ProgressView() } else { Text("Make Token") }
                    }
                    .disabled(tokenName.trimmingCharacters(in: .whitespaces).isEmpty || making)
                }
                if let newToken {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Copy it now, it's shown once:").font(.footnote)
                        Text(newToken).font(.footnote.monospaced()).textSelection(.enabled)
                        Button { copy(newToken, "token") } label: {
                            Label(copied == "token" ? "Copied" : "Copy Token", systemImage: copied == "token" ? "checkmark" : "doc.on.doc")
                        }
                    }
                }
            } header: {
                Text("Agent tokens")
            } footer: {
                Text("For agents that can't sign in over OAuth. Swipe a token to revoke it.")
            }

            Section {
                ForEach(appModel.assistants) { a in
                    VStack(alignment: .leading, spacing: 2) {
                        Text(a.clientName ?? "Unnamed assistant")
                        Text("Connected \(when(a.createdAt))").font(.caption).foregroundStyle(.secondary)
                    }
                    .swipeActions { Button("Disconnect", role: .destructive) { Task { await appModel.disconnect(a) } } }
                }
                if appModel.assistants.isEmpty { Text("No assistants connected over OAuth.").foregroundStyle(.secondary) }
            } header: {
                Text("Connected assistants")
            } footer: {
                Text("Swipe an assistant to disconnect it.")
            }

            if let err = appModel.errorMessage {
                Section { Text(err).font(.footnote).foregroundStyle(.red) }
            }
        }
        .navigationTitle("Build Agents")
        .navigationBarTitleDisplayMode(.inline)
        .refreshable { await appModel.loadAgents() }
        .task { await appModel.loadAgents() }
    }

    private var tokenConfig: String {
        """
        {"mcpServers":{"g2digest":{"type":"http","url":"\(appModel.mcpURL)","headers":{"Authorization":"Bearer g2a_…"}}}}
        """
    }

    private func copyRow(label: String, value: String, mono: Bool) -> some View {
        Button { copy(value, label) } label: {
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(label).foregroundStyle(.primary)
                    Spacer()
                    Image(systemName: copied == label ? "checkmark" : "doc.on.doc").foregroundStyle(Color.accentColor)
                }
                Text(value).font(mono ? .caption.monospaced() : .caption).foregroundStyle(.secondary).lineLimit(3)
            }
        }
    }

    private func copy(_ text: String, _ key: String) {
        UIPasteboard.general.string = text
        copied = key
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { if copied == key { copied = nil } }
    }

    /// The build prompt (`pipeline/build-prompt.md`, bundled as the web app bundles it).
    static let prompt: String = {
        guard let url = Bundle.main.url(forResource: "build-prompt", withExtension: "md"),
              let s = try? String(contentsOf: url, encoding: .utf8) else { return "" }
        return s.trimmingCharacters(in: .whitespacesAndNewlines)
    }()
}

/// A short local date for an ISO timestamp from the Worker.
func when(_ iso: String) -> String {
    let f = ISO8601DateFormatter()
    f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    let d = f.date(from: iso) ?? ISO8601DateFormatter().date(from: iso)
    return d.map { $0.formatted(date: .abbreviated, time: .shortened) } ?? String(iso.prefix(10))
}

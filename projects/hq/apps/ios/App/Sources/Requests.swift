// On-demand requests: ask HQ for something ("Propose a redesign of the logo"); an agent claims it,
// files cards that carry its id and answers in the thread (packages/core/src/request.ts).
import SwiftUI

struct LinkedCard: Codable, Hashable, Identifiable {
    var id: String
    var title: String
    var status: String
    var tier: String
    var project: String
    var kind: String
}

struct HQRequest: Codable, Hashable, Identifiable {
    var id: String
    var project: String?
    var body: String
    var status: String
    var outcome: String?
    var requested_by: String
    var claimed_by: String?
    var claimed_until: String?
    var created_at: String
    var cards: [LinkedCard]?
    var last_message: String?

    /// Where it stands, in the asker's words.
    var state: (label: String, color: Color) {
        switch (status, outcome) {
        case ("closed", _): return ("closed", .secondary)
        case ("open", _): return ("waiting for an agent", .secondary)
        case ("claimed", _): return ("an agent is on it", .blue)
        case (_, "proposed"): return ("proposed", .green)
        case (_, "question"): return ("needs your answer", .orange)
        case (_, "declined"): return ("declined", .red)
        default: return ("answered", .orange)
        }
    }
}

struct RequestMessage: Codable, Hashable, Identifiable {
    var id: Int
    var author: String
    var kind: String
    var body: String
    var created_at: String
}

struct RequestDetail: Codable {
    var request: HQRequest
    var messages: [RequestMessage]
    var cards: [LinkedCard]
}

struct RequestRowView: View {
    var request: HQRequest
    var body: some View {
        let st = request.state
        VStack(alignment: .leading, spacing: 5) {
            HStack(spacing: 5) {
                Text(st.label).font(.caption2.weight(.bold)).foregroundStyle(st.color)
                Chip(text: request.project ?? "any project")
                if let n = request.cards?.count, n > 0 { Chip(text: "\(n) card\(n == 1 ? "" : "s")") }
                Spacer()
                Text(relativeTime(request.created_at)).font(.caption2).foregroundStyle(.secondary)
            }
            Text(Markdown.plain(request.body, max: 140)).font(.subheadline.weight(.semibold)).lineLimit(3)
            if let m = request.last_message { Text(Markdown.plain(m)).font(.caption).foregroundStyle(.secondary).lineLimit(2) }
        }
        .padding(.vertical, 3)
    }
}

/// Ask HQ: what you want proposed, and optionally which project.
struct AskView: View {
    var onAsked: (String) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var text = ""
    @State private var project = ""
    @State private var projects: [String] = []
    @State private var busy = false
    @State private var error: String?
    @FocusState private var focused: Bool

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Propose a redesign of the logo…", text: $text, axis: .vertical)
                        .lineLimit(4...10).focused($focused)
                    Picker("Project", selection: $project) {
                        Text("Any project").tag("")
                        ForEach(projects, id: \.self) { Text($0).tag($0) }
                    }
                } footer: {
                    Text("An agent looks into the repo and files a card for you to decide. Asking approves nothing.")
                }
                if let error { Section { Text(error).foregroundStyle(.red) } }
            }
            .navigationTitle("Ask HQ")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button(busy ? "Asking…" : "Ask") {
                        Task {
                            busy = true; defer { busy = false }
                            do {
                                let d = try await HQClient().ask(text, project: project.isEmpty ? nil : project)
                                UINotificationFeedbackGenerator().notificationOccurred(.success)
                                dismiss()
                                onAsked(d.request.id)
                            } catch { self.error = error.localizedDescription }
                        }
                    }.disabled(busy || text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
            .task {
                focused = true
                projects = (try? await HQClient().projects()) ?? []
            }
        }
    }
}

struct RequestsView: View {
    @Environment(AppModel.self) private var model
    @State private var list: [HQRequest] = []
    @State private var error: String?
    @State private var asking = false
    @State private var path: [String] = []

    var body: some View {
        List {
            if let error { Section { Text(error).foregroundStyle(.red) } }
            let open = list.filter { $0.status != "closed" }
            let closed = list.filter { $0.status == "closed" }
            Section {
                if open.isEmpty { Text("Nothing asked yet.").font(.footnote).foregroundStyle(.secondary) }
                ForEach(open) { r in NavigationLink(value: r.id) { RequestRowView(request: r) } }
            } header: { Text("Open") } footer: {
                Text("What people asked HQ for. An agent claims each one, looks into the repo and answers with a card, a question or a reason.")
            }
            if !closed.isEmpty {
                Section("Closed") { ForEach(closed) { r in NavigationLink(value: r.id) { RequestRowView(request: r) } } }
            }
        }
        .navigationTitle("Requests")
        .navigationDestination(for: String.self) { RequestDetailView(requestID: $0) }
        .toolbar {
            if model.canDecide { Button { asking = true } label: { Label("Ask HQ", systemImage: "plus.bubble") } }
        }
        .sheet(isPresented: $asking) { AskView { _ in Task { await load() } } }
        .refreshable { await load() }
        .task { await load() }
    }

    private func load() async {
        do { list = try await HQClient().requests(); error = nil } catch { self.error = error.localizedDescription }
    }
}

struct RequestDetailView: View {
    var requestID: String
    @Environment(AppModel.self) private var model
    @State private var detail: RequestDetail?
    @State private var error: String?
    @State private var reply = ""
    @State private var busy = false

    var body: some View {
        Form {
            if let error { Section { Text(error).foregroundStyle(.red) } }
            if let d = detail {
                let r = d.request
                Section {
                    HStack(spacing: 5) {
                        Text(r.state.label).font(.caption2.weight(.bold)).foregroundStyle(r.state.color)
                        Chip(text: r.project ?? "any project")
                    }
                    MarkdownText(text: r.body)
                    Text("asked by \(r.requested_by) · \(relativeTime(r.created_at))\(r.status == "claimed" ? " · claimed by \(r.claimed_by ?? "an agent")" : "")")
                        .font(.caption).foregroundStyle(.secondary)
                    if model.canDecide {
                        if r.status == "open" || r.status == "claimed" {
                            Button("Ask an agent again") { Task { await act { _ = try await HQClient().retryRequest(requestID) } } }.disabled(busy)
                        }
                        if r.status != "closed" {
                            Button("Done, close it") { Task { await act { detail = try await HQClient().closeRequest(requestID) } } }.disabled(busy)
                        }
                    }
                }
                if !d.cards.isEmpty {
                    Section("Cards for this request") {
                        ForEach(d.cards) { c in
                            NavigationLink { CardDetailView(cardID: c.id, reasons: []) } label: {
                                VStack(alignment: .leading, spacing: 4) {
                                    HStack(spacing: 5) { TierBadge(tier: c.tier); Chip(text: c.project); Chip(text: c.status.replacingOccurrences(of: "_", with: " ")) }
                                    Text(c.title).font(.subheadline.weight(.semibold))
                                }
                            }
                        }
                    }
                }
                Section("Thread") {
                    if d.messages.isEmpty {
                        Text(r.status == "open" || r.status == "claimed" ? "No answer yet. A runner picks this up on its next check; an agent connected over MCP sees it in its context." : "No messages.")
                            .font(.footnote).foregroundStyle(.secondary)
                    }
                    ForEach(d.messages) { m in
                        VStack(alignment: .leading, spacing: 3) {
                            Text("\(m.kind == "system" ? "HQ" : m.author) · \(relativeTime(m.created_at))").font(.caption2).foregroundStyle(.secondary)
                            MarkdownText(text: m.body).foregroundStyle(m.kind == "system" ? .secondary : .primary)
                        }
                    }
                    if model.canDecide {
                        TextField(r.outcome == "question" ? "Answer the agent's question" : "Follow up: what to change, or more detail", text: $reply, axis: .vertical).lineLimit(2...6)
                        Button(r.status == "closed" ? "Reopen with this" : "Send") {
                            Task { await act { detail = try await HQClient().replyToRequest(requestID, reply); reply = "" } }
                        }.disabled(busy || reply.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    }
                }
            } else if error == nil { ProgressView() }
        }
        .navigationTitle(requestID)
        .navigationBarTitleDisplayMode(.inline)
        .refreshable { await load() }
        .task { await load() }
    }

    private func act(_ fn: () async throws -> Void) async {
        busy = true; defer { busy = false }
        do { try await fn(); UINotificationFeedbackGenerator().notificationOccurred(.success); await load() } catch { self.error = error.localizedDescription }
    }

    private func load() async {
        do { detail = try await HQClient().request(requestID); error = nil } catch { self.error = error.localizedDescription }
    }
}

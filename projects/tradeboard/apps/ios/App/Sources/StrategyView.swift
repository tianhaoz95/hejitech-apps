import SwiftUI
import TradeboardKit

/// Settings → Trading Strategy: the portal's /strategy/ page. The document is the user's; agents only
/// save drafts (propose_strategy), which do nothing until the user adopts one here, edited or not.
public struct StrategyView: View {
    @Environment(AppModel.self) private var model
    @State private var editor: Editor?
    @State private var confirmDismiss: StrategyProposal?
    @State private var busy = false
    @State private var errorMessage: String?

    /// What the editor sheet is writing: a new version from scratch or the current one, or an agent's draft.
    struct Editor: Identifiable {
        let id = UUID()
        var text: String
        var fromProposal: StrategyProposal?
    }

    public init() {}

    private var data: StrategyResponse { model.strategy ?? StrategyResponse() }

    public var body: some View {
        List {
            Section {
                Label("Guidance for discussion agents", systemImage: "sparkles")
                    .font(.headline)
                Text("Agents read your strategy before proposing or debating trades, and report each plan's fit with it. It guides discussion; hard limits belong in Policy. Agents can only suggest drafts: nothing changes until you adopt one.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }

            if let errorMessage {
                Section {
                    Label(errorMessage, systemImage: "exclamationmark.circle.fill")
                        .font(.footnote)
                        .foregroundStyle(.red)
                }
            }

            ForEach(data.proposals) { p in
                Section {
                    if let s = p.summary, !s.isEmpty {
                        Text(s).font(.subheadline.weight(.semibold))
                    }
                    StrategyBody(text: p.body)
                    hints(p.policy_hints)
                    Button {
                        Task { await adopt(p, text: p.body) }
                    } label: {
                        Label("Adopt as Version \((data.current?.version ?? 0) + 1)", systemImage: "checkmark.circle.fill")
                    }
                    .disabled(busy)
                    .accessibilityIdentifier("adopt-\(p.agent_id)")
                    Button {
                        editor = Editor(text: p.body, fromProposal: p)
                    } label: {
                        Label("Edit, Then Adopt", systemImage: "square.and.pencil")
                    }
                    .disabled(busy)
                    Button(role: .destructive) {
                        confirmDismiss = p
                    } label: {
                        Label("Dismiss Draft", systemImage: "xmark")
                    }
                    .disabled(busy)
                } header: {
                    HStack {
                        Label("Draft from \(p.agent_id)", systemImage: "tray.and.arrow.down.fill")
                        Spacer()
                        Text(Self.short(p.created_at))
                    }
                    .foregroundStyle(.orange)
                } footer: {
                    if let based = p.based_on_version, let cur = data.current?.version, based != cur {
                        Text("Written against version \(based); you've saved version \(cur) since.")
                    } else if p.based_on_version == nil, data.current != nil {
                        Text("Written before you had a strategy; adopting it replaces your current version.")
                    }
                }
            }

            if let cur = data.current {
                Section {
                    StrategyBody(text: cur.body)
                    hints(cur.policy_hints)
                } header: {
                    HStack {
                        Text("Version \(cur.version)")
                        Spacer()
                        Text(Self.short(cur.created_at))
                    }
                } footer: {
                    if let n = cur.note, !n.isEmpty { Text(n) }
                }
            } else if model.strategy != nil {
                Section {
                    Text(data.proposals.isEmpty
                         ? "No strategy yet. Write one, or ask a connected agent to interview you: it saves a draft here for you to adopt."
                         : "No strategy yet. Adopt the draft above, or write your own.")
                        .foregroundStyle(.secondary)
                    Button {
                        editor = Editor(text: data.template ?? "", fromProposal: nil)
                    } label: {
                        Label("Write a Strategy", systemImage: "square.and.pencil")
                    }
                }
            } else {
                Section { ProgressView() }
            }

            if data.history.count > 1 {
                Section("Earlier versions") {
                    ForEach(data.history.dropFirst()) { v in
                        DisclosureGroup {
                            StrategyBody(text: v.body)
                        } label: {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Version \(v.version)\(v.from_proposal != nil ? " · from an agent's draft" : "")")
                                Text(Self.short(v.created_at)).font(.caption).foregroundStyle(.secondary)
                            }
                        }
                    }
                }
            }
        }
        .navigationTitle("Trading Strategy")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if data.current != nil {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Edit") { editor = Editor(text: data.current?.body ?? "", fromProposal: nil) }
                        .disabled(busy)
                }
            }
        }
        .task { await model.loadStrategy() }
        .refreshable { await model.loadStrategy() }
        .sheet(item: $editor) { e in
            StrategyEditor(editor: e, nextVersion: (data.current?.version ?? 0) + 1) { text, note in
                if let p = e.fromProposal {
                    return await adopt(p, text: text, note: note)
                }
                return await save(text: text, note: note)
            }
        }
        .confirmationDialog("Dismiss the draft from \(confirmDismiss?.agent_id ?? "")?", isPresented: Binding(get: { confirmDismiss != nil }, set: { if !$0 { confirmDismiss = nil } }), titleVisibility: .visible) {
            Button("Dismiss Draft", role: .destructive) {
                if let p = confirmDismiss { Task { await dismissDraft(p) } }
            }
        } message: {
            Text("Your strategy stays as it is.")
        }
    }

    @ViewBuilder
    private func hints(_ hints: [PolicyHint]?) -> some View {
        if let hints, !hints.isEmpty {
            VStack(alignment: .leading, spacing: 4) {
                Label("These read like hard limits. Agents only see them as guidance; to enforce them, set them in Policy.", systemImage: "lock.shield")
                    .font(.caption.weight(.semibold))
                ForEach(hints, id: \.self) { h in
                    Text("“\(h.line)” → \(h.settings.joined(separator: ", "))")
                        .font(.caption)
                }
            }
            .foregroundStyle(.secondary)
        }
    }

    @discardableResult
    private func adopt(_ p: StrategyProposal, text: String, note: String = "") async -> Bool {
        let n = note.isEmpty ? "Adopted the draft from \(p.agent_id)" : note
        return await run { await model.saveStrategy(text: text, note: n, fromProposal: p.proposal_id) }
    }

    private func save(text: String, note: String) async -> Bool {
        await run { await model.saveStrategy(text: text, note: note) }
    }

    private func dismissDraft(_ p: StrategyProposal) async {
        _ = await run { await model.dismissStrategyProposal(id: p.proposal_id) }
    }

    private func run(_ f: () async -> Bool) async -> Bool {
        busy = true
        defer { busy = false }
        let ok = await f()
        errorMessage = ok ? nil : model.error
        return ok
    }

    static func short(_ iso: String?) -> String {
        guard let iso else { return "" }
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let d = f.date(from: iso) ?? ISO8601DateFormatter().date(from: iso)
        return d?.formatted(date: .abbreviated, time: .shortened) ?? String(iso.prefix(10))
    }
}

/// The strategy's Markdown, line by line (headings bold), selectable.
private struct StrategyBody: View {
    let text: String
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            ForEach(Array(text.components(separatedBy: "\n").enumerated()), id: \.offset) { _, raw in
                let line = raw.trimmingCharacters(in: .whitespaces)
                if line.hasPrefix("<!--") || line.isEmpty {
                    EmptyView()
                } else if line.hasPrefix("#") {
                    Text(line.drop(while: { $0 == "#" }).trimmingCharacters(in: .whitespaces))
                        .font(.subheadline.weight(.bold))
                        .padding(.top, 4)
                } else {
                    Text((try? AttributedString(markdown: line)) ?? AttributedString(line))
                        .font(.callout)
                }
            }
        }
        .textSelection(.enabled)
        .padding(.vertical, 4)
    }
}

private struct StrategyEditor: View {
    let editor: StrategyView.Editor
    let nextVersion: Int
    let save: (String, String) async -> Bool
    @Environment(\.dismiss) private var dismiss
    @State private var text = ""
    @State private var note = ""
    @State private var saving = false

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextEditor(text: $text)
                        .font(.callout.monospaced())
                        .frame(minHeight: 320)
                        .accessibilityIdentifier("strategy-editor")
                } footer: {
                    Text(editor.fromProposal.map { "Draft from \($0.agent_id). Saving adopts it as version \(nextVersion)." } ?? "Saved as version \(nextVersion). Earlier versions are kept.")
                }
                Section("Note (optional)") {
                    TextField("What changed", text: $note)
                }
            }
            .navigationTitle(editor.fromProposal == nil ? "Edit Strategy" : "Edit Draft")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button(editor.fromProposal == nil ? "Save" : "Adopt") {
                        saving = true
                        Task {
                            let ok = await save(text.trimmingCharacters(in: .whitespacesAndNewlines), note)
                            saving = false
                            if ok { dismiss() }
                        }
                    }
                    .disabled(saving || text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
            .onAppear { text = editor.text }
        }
    }
}

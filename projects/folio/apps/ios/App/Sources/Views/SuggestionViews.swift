import FolioKit
import SwiftUI

struct SuggestionList: View {
    let store: ArtifactStore

    var body: some View {
        List {
            if store.suggestions.isEmpty {
                ContentUnavailableView("No suggestions", systemImage: "text.badge.plus", description: Text("When an agent proposes a change instead of making it, it shows up here for you to accept or reject."))
                    .listRowBackground(Color.clear)
            }
            if !store.openSuggestions.isEmpty {
                Section("Open") {
                    ForEach(store.openSuggestions) { s in
                        NavigationLink(value: Destination.suggestion(store.slug, s.number)) { SuggestionRow(s: s) }
                    }
                }
            }
            if !store.closedSuggestions.isEmpty {
                Section("Closed") {
                    ForEach(store.closedSuggestions) { s in
                        NavigationLink(value: Destination.suggestion(store.slug, s.number)) { SuggestionRow(s: s) }
                    }
                }
            }
        }
        .paperBackground()
        .listStyle(.insetGrouped)
    }
}

struct SuggestionRow: View {
    let s: Suggestion

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 6) {
                Text("#\(s.number)").foregroundStyle(.secondary)
                Text(s.title).font(.body.weight(.semibold)).lineLimit(2)
            }
            if !s.rationale.isEmpty { Text(s.rationale).font(.subheadline).foregroundStyle(.secondary).lineLimit(2) }
            HStack(spacing: 6) {
                AgentBadge(agent: s.agent)
                StatusTag(status: s.status)
                Text(s.created_at, format: .relative(presentation: .named)).font(.caption).foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 2)
    }
}

struct StatusTag: View {
    let status: SuggestionStatus

    var body: some View {
        if status != .open {
            Text(status.rawValue.capitalized)
                .font(.caption.weight(.semibold))
                .foregroundStyle(color)
                .padding(.horizontal, 6).padding(.vertical, 1)
                .background(color.opacity(0.13), in: Capsule())
        }
    }

    private var color: Color { status == .accepted ? .green : status == .rejected ? .red : .secondary }
}

/// One suggestion: why, what changes (diff) or how it looks (live preview), its discussion, and
/// Accept / Reject for people who can review.
struct SuggestionView: View {
    let slug: String
    let number: Int
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var detail: SuggestionDetail?
    @State private var role: Role = .viewer
    @State private var comments: [Comment] = []
    @State private var preview: URL?
    @State private var mode = 0
    @State private var error: String?
    @State private var busy = false
    @State private var note = ""
    @State private var askReject = false

    var body: some View {
        Group {
            if let d = detail {
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        summary(d)
                        Picker("Show", selection: $mode) {
                            Text("Changes").tag(0)
                            Text("Preview").tag(1)
                        }
                        .pickerStyle(.segmented)
                        if mode == 0 {
                            DiffList(files: d.files)
                        } else if let preview {
                            WebPreview(url: preview)
                                .frame(height: 520)
                                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                                .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(.quaternary))
                        } else {
                            ProgressView().frame(maxWidth: .infinity, minHeight: 200)
                        }
                        Text("Discussion").font(.headline).padding(.top, 6)
                        CommentThreads(slug: slug, comments: comments, canComment: true, suggestion: number, embedded: true) { await load() }
                    }
                    .padding()
                }
                .background(Color.paper)
                .safeAreaInset(edge: .bottom) {
                    if d.suggestion.status == .open && role.canReview { reviewBar(d) }
                }
            } else if let error {
                ContentUnavailableView("Can't open this suggestion", systemImage: "exclamationmark.triangle", description: Text(error))
            } else {
                ProgressView()
            }
        }
        .navigationTitle("Suggestion #\(number)")
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
        .refreshable { await load() }
        .alert("Reject this suggestion?", isPresented: $askReject) {
            TextField("Why (optional)", text: $note)
            Button("Reject", role: .destructive) { review(.reject) }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("The agent sees your note.")
        }
    }

    private func summary(_ d: SuggestionDetail) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(d.suggestion.title).font(.title3.bold())
            HStack(spacing: 6) {
                AgentBadge(agent: d.suggestion.agent)
                StatusTag(status: d.suggestion.status)
                Text("on v\(d.suggestion.base_version)").font(.caption).foregroundStyle(.secondary)
                Text(d.suggestion.created_at, format: .relative(presentation: .named)).font(.caption).foregroundStyle(.secondary)
            }
            if !d.suggestion.rationale.isEmpty {
                Text(d.suggestion.rationale).font(.body).fixedSize(horizontal: false, vertical: true)
            }
            if d.suggestion.status == .open && !d.applies_to_head {
                Label("The artifact changed since this was suggested (now v\(d.head_version)) and it no longer applies cleanly. Ask the agent to revise it, or reject it.", systemImage: "exclamationmark.triangle.fill")
                    .font(.footnote)
                    .foregroundStyle(.orange)
                    .padding(10)
                    .background(Color.orange.opacity(0.1), in: RoundedRectangle(cornerRadius: 10))
            }
            if d.suggestion.status != .open {
                let who = d.suggestion.resolved_agent.map { " by \($0)" } ?? ""
                let result = d.suggestion.result_version.map { " as v\($0)" } ?? ""
                Text("\(d.suggestion.status.rawValue.capitalized)\(who)\(result)\(d.suggestion.resolution_note.map { ": \($0)" } ?? "")")
                    .font(.footnote).foregroundStyle(.secondary)
            }
        }
    }

    private func reviewBar(_ d: SuggestionDetail) -> some View {
        HStack(spacing: 12) {
            Button(role: .destructive) { askReject = true } label: {
                Label("Reject", systemImage: "xmark").frame(maxWidth: .infinity, minHeight: 30)
            }
            .buttonStyle(.bordered)
            Button { review(.accept) } label: {
                ZStack {
                    Label("Accept", systemImage: "checkmark").opacity(busy ? 0 : 1)
                    if busy { ProgressView().tint(.white) }
                }
                .frame(maxWidth: .infinity, minHeight: 30)
            }
            .buttonStyle(.borderedProminent)
            .disabled(!d.applies_to_head)
        }
        .controlSize(.large)
        .disabled(busy)
        .padding(.horizontal)
        .padding(.vertical, 10)
        .background(.bar)
    }

    private func load() async {
        await Task {
            do {
                async let d = model.api.suggestion(slug, number: number)
                async let c = model.api.comments(slug, resolved: true, suggestion: number)
                async let a = model.api.artifact(slug)
                let (dd, cc, aa) = try await (d, c, a)
                detail = dd
                comments = cc
                role = aa.role ?? .viewer
                if preview == nil, dd.suggestion.status == .open { preview = try? await model.api.renderURL(slug, suggestion: number) }
                if preview == nil, let v = dd.suggestion.result_version { preview = try? await model.api.renderURL(slug, version: v) }
            } catch {
                self.error = error.localizedDescription
            }
        }.value
    }

    private func review(_ decision: FolioAPI.Decision) {
        busy = true
        Task {
            do {
                let v = try await model.api.review(slug, number: number, decision, note: note)
                UINotificationFeedbackGenerator().notificationOccurred(.success)
                model.flash(decision == .accept ? "Accepted as v\(v ?? 0)" : "Rejected")
                await model.refresh()
                await load()
            } catch {
                UINotificationFeedbackGenerator().notificationOccurred(.error)
                model.flash(error.localizedDescription)
                await load()
            }
            busy = false
        }
    }
}

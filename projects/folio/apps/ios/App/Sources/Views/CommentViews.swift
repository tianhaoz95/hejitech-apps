import FolioKit
import SwiftUI

/// Comment threads (top-level comments with their replies) and a box to write one. Embedded in a
/// suggestion it shows that suggestion's discussion; otherwise the artifact's open comments.
struct CommentThreads: View {
    let slug: String
    let comments: [Comment]
    let canComment: Bool
    var suggestion: Int? = nil
    var embedded = false
    let reload: () async -> Void

    @Environment(AppModel.self) private var model
    @State private var draft = ""
    @State private var replyTo: Comment?
    @State private var sending = false
    @FocusState private var focused: Bool

    private var threads: [(Comment, [Comment])] {
        let tops = comments.filter { c in c.reply_to == nil || !comments.contains { $0.id == c.reply_to } }
        return tops.map { t in (t, comments.filter { $0.reply_to == t.id }) }
    }

    var body: some View {
        if embedded {
            VStack(alignment: .leading, spacing: 12) {
                list
                composer.padding(.top, 4)
            }
        } else {
            ScrollView {
                // Fill the width: with no comments the list is empty and the scroll view would
                // otherwise shrink to its padding, a thin strip with the empty state squeezed in it.
                VStack(alignment: .leading, spacing: 12) { list }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding()
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Color(uiColor: .systemGroupedBackground))
            .overlay {
                if comments.isEmpty {
                    ContentUnavailableView("No open comments", systemImage: "bubble.left.and.bubble.right", description: Text("Comments from agents and people show up here. Resolved ones are hidden."))
                }
            }
            .safeAreaInset(edge: .bottom) {
                if canComment { composer.padding(.horizontal).padding(.vertical, 8).background(.bar) }
            }
        }
    }

    @ViewBuilder private var list: some View {
        if embedded && comments.isEmpty {
            Text("No comments yet.").font(.subheadline).foregroundStyle(.secondary)
        }
        ForEach(threads, id: \.0.id) { top, replies in
            VStack(alignment: .leading, spacing: 10) {
                CommentBubble(c: top)
                ForEach(replies) { r in CommentBubble(c: r).padding(.leading, 22) }
                HStack(spacing: 16) {
                    Button("Reply") {
                        replyTo = top
                        focused = true
                    }
                    if !top.resolved {
                        Button("Resolve") { resolve(top) }
                    }
                }
                .font(.caption.weight(.semibold))
                .padding(.leading, 2)
            }
            .padding(12)
            .background(Color(uiColor: .secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            .opacity(top.resolved ? 0.6 : 1)
        }
    }

    private var composer: some View {
        VStack(alignment: .leading, spacing: 6) {
            if let r = replyTo {
                HStack {
                    Text("Replying to \(r.agent)").font(.caption).foregroundStyle(.secondary)
                    Spacer()
                    Button { replyTo = nil } label: { Image(systemName: "xmark.circle.fill").foregroundStyle(.secondary) }
                        .accessibilityLabel("Cancel reply")
                }
            }
            HStack(alignment: .bottom, spacing: 8) {
                TextField(replyTo == nil ? "Add a comment" : "Reply", text: $draft, axis: .vertical)
                    .lineLimit(1...5)
                    .focused($focused)
                    .padding(.horizontal, 12).padding(.vertical, 8)
                    .background(Color(uiColor: .tertiarySystemFill), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                Button(action: send) {
                    Image(systemName: sending ? "ellipsis.circle.fill" : "arrow.up.circle.fill").font(.title)
                }
                .disabled(sending || draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                .accessibilityLabel("Send")
            }
        }
    }

    private func send() {
        let text = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        sending = true
        Task {
            do {
                try await model.api.comment(slug, body: text, suggestion: replyTo == nil ? suggestion : nil, replyTo: replyTo?.id)
                draft = ""
                replyTo = nil
                focused = false
                await reload()
            } catch {
                model.flash(error.localizedDescription)
            }
            sending = false
        }
    }

    private func resolve(_ c: Comment) {
        Task {
            do {
                try await model.api.resolve(slug, comment: c.id)
                await reload()
            } catch { model.flash(error.localizedDescription) }
        }
    }
}

struct CommentBubble: View {
    let c: Comment

    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            HStack(spacing: 6) {
                AgentBadge(agent: c.agent)
                if let p = c.path { Text(p).font(.caption.monospaced()).foregroundStyle(.secondary).lineLimit(1) }
                if let l = c.anchor?.line { Text("line \(l)").font(.caption).foregroundStyle(.secondary) }
                Spacer(minLength: 0)
                Text(c.created_at, format: .relative(presentation: .named)).font(.caption).foregroundStyle(.secondary)
            }
            if let quote = c.anchor?.text ?? c.anchor?.selector {
                Text(quote).font(.caption.monospaced()).foregroundStyle(.secondary).lineLimit(2)
                    .padding(.leading, 8)
                    .overlay(alignment: .leading) { Rectangle().fill(.quaternary).frame(width: 2) }
            }
            Text(c.body).font(.body).textSelection(.enabled).fixedSize(horizontal: false, vertical: true)
        }
    }
}

/// The artifact's comments on their own screen (from a notification).
struct CommentsScreen: View {
    let slug: String
    @Environment(AppModel.self) private var model
    @State private var comments: [Comment] = []

    var body: some View {
        CommentThreads(slug: slug, comments: comments, canComment: true) { await load() }
            .navigationTitle("Comments")
            .navigationBarTitleDisplayMode(.inline)
            .task { await load() }
            .refreshable { await load() }
    }

    private func load() async {
        await Task { comments = (try? await model.api.comments(slug)) ?? comments }.value
    }
}

// MARK: history

struct HistoryList: View {
    let store: ArtifactStore

    var body: some View {
        List(store.versions) { v in
            NavigationLink(value: Destination.version(store.slug, v.number)) {
                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 6) {
                        Text("v\(v.number)").font(.body.monospacedDigit().weight(.semibold))
                        if v.number == store.detail?.head.number {
                            Text("Current").font(.caption.weight(.semibold)).foregroundStyle(Color.accentColor)
                                .padding(.horizontal, 6).padding(.vertical, 1)
                                .background(Color.accentColor.opacity(0.13), in: Capsule())
                        }
                        Spacer()
                        Text(v.created_at, format: .relative(presentation: .named)).font(.caption).foregroundStyle(.secondary)
                    }
                    Text(v.message.isEmpty ? kindText(v) : v.message).font(.subheadline).lineLimit(2)
                    HStack(spacing: 6) {
                        AgentBadge(agent: v.agent)
                        if let m = v.model { Text(m).font(.caption).foregroundStyle(.secondary).lineLimit(1) }
                    }
                }
                .padding(.vertical, 2)
            }
        }
        .listStyle(.insetGrouped)
    }

    private func kindText(_ v: Version) -> String {
        if let r = v.restored_from { return "Restored v\(r)" }
        return v.kind == "suggestion" ? "Accepted a suggestion" : "Saved"
    }
}

/// One version: what changed from the one before, how it looked, and Restore.
struct VersionView: View {
    let slug: String
    let number: Int
    @Environment(AppModel.self) private var model
    @State private var diff: VersionDiff?
    @State private var version: Version?
    @State private var head = 0
    @State private var role: Role = .viewer
    @State private var preview: URL?
    @State private var mode = 0
    @State private var confirmRestore = false
    @State private var error: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if let v = version {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(v.message.isEmpty ? "Version \(v.number)" : v.message).font(.title3.bold())
                        HStack(spacing: 6) {
                            AgentBadge(agent: v.agent)
                            if let m = v.model { Text(m).font(.caption).foregroundStyle(.secondary) }
                            Text(v.created_at, format: .dateTime.month().day().hour().minute()).font(.caption).foregroundStyle(.secondary)
                        }
                    }
                }
                Picker("Show", selection: $mode) {
                    Text(number > 1 ? "Changes from v\(number - 1)" : "Files").tag(0)
                    Text("Preview").tag(1)
                }
                .pickerStyle(.segmented)
                if mode == 0 {
                    if let diff { DiffList(files: diff.files) } else if let error { Text(error).foregroundStyle(.secondary) } else { ProgressView().frame(maxWidth: .infinity) }
                } else if let preview {
                    WebPreview(url: preview)
                        .frame(height: 560)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                }
            }
            .padding()
        }
        .background(Color(uiColor: .systemGroupedBackground))
        .navigationTitle("v\(number)")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if role.canEdit && number != head && head > 0 {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Restore") { confirmRestore = true }
                }
            }
        }
        .confirmationDialog("Restore v\(number)?", isPresented: $confirmRestore, titleVisibility: .visible) {
            Button("Restore as a new version") {
                Task {
                    do {
                        let v = try await model.api.restore(slug, version: number)
                        model.flash("Restored as v\(v)")
                        await load()
                        await model.refresh()
                    } catch { model.flash(error.localizedDescription) }
                }
            }
        } message: {
            Text("Nothing is lost: the current version stays in the history.")
        }
        .task { await load() }
    }

    private func load() async {
        await Task {
            do {
                async let a = model.api.artifact(slug)
                async let vs = model.api.versions(slug)
                let (aa, all) = try await (a, vs)
                head = aa.head.number
                role = aa.role ?? .viewer
                version = all.first { $0.number == number }
                diff = try await model.api.diff(slug, from: max(0, number - 1), to: number)
                preview = try? await model.api.renderURL(slug, version: number)
            } catch {
                self.error = error.localizedDescription
            }
        }.value
    }
}

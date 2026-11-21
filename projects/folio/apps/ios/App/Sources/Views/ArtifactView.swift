import FolioKit
import SwiftUI

/// One artifact's data, loaded together and refreshed after every change.
@MainActor
@Observable
final class ArtifactStore {
    let slug: String
    var detail: ArtifactDetail?
    var suggestions: [Suggestion] = []
    var comments: [Comment] = []
    var versions: [Version] = []
    var previewURL: URL?
    var error: String?

    init(slug: String) { self.slug = slug }

    var role: Role { detail?.role ?? .viewer }
    var openSuggestions: [Suggestion] { suggestions.filter { $0.status == .open } }
    var closedSuggestions: [Suggestion] { suggestions.filter { $0.status != .open } }

    func load(_ api: FolioAPI) async {
        await Task {
            do {
                async let d = api.artifact(slug)
                async let s = api.suggestions(slug)
                async let c = api.comments(slug)
                async let v = api.versions(slug)
                let (dd, ss, cc, vv) = try await (d, s, c, v)
                if previewURL == nil || detail?.head.number != dd.head.number {
                    previewURL = try? await api.renderURL(slug)
                }
                detail = dd
                suggestions = ss.sorted { ($0.status == .open ? 0 : 1, -$0.number) < ($1.status == .open ? 0 : 1, -$1.number) }
                comments = cc
                versions = vv
                error = nil
            } catch {
                self.error = error.localizedDescription
            }
        }.value
    }
}

struct ArtifactView: View {
    let slug: String
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var store: ArtifactStore
    @State private var tab: Tab = .preview
    @State private var showSharing = false
    @State private var showRename = false
    @State private var confirmDelete = false
    @State private var fullScreen = false
    @State private var exportURL: URL?
    @State private var draft: AnchorDraft?
    @State private var highlight: QuoteRequest?

    enum Tab: String, CaseIterable { case preview = "Preview", suggestions = "Review", comments = "Comments", history = "History" }

    init(slug: String) {
        self.slug = slug
        _store = State(initialValue: ArtifactStore(slug: slug))
    }

    var body: some View {
        VStack(spacing: 0) {
            if let d = store.detail {
                header(d)
                tabBar
                Divider()
                content
            } else if let e = store.error {
                ContentUnavailableView("Can't open this artifact", systemImage: "exclamationmark.triangle", description: Text(e))
            } else {
                ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .navigationTitle(store.detail?.artifact.title ?? "")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { toolbar }
        .task { await store.load(model.api) }
        .refreshable { await store.load(model.api) }
        .sheet(isPresented: $showSharing) {
            SharingView(slug: slug, role: store.role) { Task { await store.load(model.api) } }
        }
        .sheet(isPresented: $showRename) {
            if let d = store.detail { RenameSheet(slug: slug, title: d.artifact.title, description: d.artifact.description) { Task { await store.load(model.api); await model.refresh() } } }
        }
        .sheet(item: $exportURL) { url in ShareSheet(items: [url]) }
        .sheet(item: $draft) { d in
            AnchoredCommentSheet(slug: slug, draft: d, version: store.detail?.head.number) {
                Task { await store.load(model.api) }
            }
        }
        .environment(\.showQuote) { c in
            tab = .preview
            highlight = QuoteRequest(text: c.anchor?.text, selector: c.anchor?.selector, path: c.path)
        }
        .fullScreenCover(isPresented: $fullScreen) {
            if let u = store.previewURL { FullScreenPreview(url: u, title: store.detail?.artifact.title ?? "") }
        }
        .confirmationDialog("Delete this artifact?", isPresented: $confirmDelete, titleVisibility: .visible) {
            Button("Delete", role: .destructive) {
                Task {
                    do {
                        try await model.api.delete(slug)
                        await model.refresh()
                        dismiss()
                    } catch { model.flash(error.localizedDescription) }
                }
            }
        } message: {
            Text("Every version, suggestion and comment goes with it, for everyone it's shared with. This can't be undone.")
        }
        .onChange(of: model.path.count) { _, _ in Task { await store.load(model.api) } }
    }

    private func label(_ t: Tab) -> String {
        switch t {
        case .suggestions: return store.openSuggestions.isEmpty ? "Review" : "Review \(store.openSuggestions.count)"
        case .comments: return store.comments.isEmpty ? "Comments" : "Comments \(store.comments.count)"
        default: return t.rawValue
        }
    }

    /// Preview / Review / Comments / History: Liquid Glass buttons on iOS 26, the selected one
    /// prominent; a segmented picker before that.
    @ViewBuilder private var tabBar: some View {
        if #available(iOS 26, *) {
            // All four in one row: regular text when it fits, smaller on narrow phones, and
            // scrolling only as a last resort (large Dynamic Type).
            ViewThatFits(in: .horizontal) {
                glassTabs(font: .subheadline.weight(.semibold), spacing: 8)
                glassTabs(font: .footnote.weight(.semibold), spacing: 6)
                ScrollView(.horizontal, showsIndicators: false) {
                    glassTabs(font: .footnote.weight(.semibold), spacing: 6)
                }
                .scrollClipDisabled()
            }
            .padding(.bottom, 8)
        } else {
            Picker("View", selection: $tab) {
                ForEach(Tab.allCases, id: \.self) { t in Text(label(t)).tag(t) }
            }
            .pickerStyle(.segmented)
            .padding(.horizontal)
            .padding(.bottom, 8)
        }
    }

    @available(iOS 26, *)
    private func glassTabs(font: Font, spacing: CGFloat) -> some View {
        GlassEffectContainer(spacing: spacing) {
            HStack(spacing: spacing) {
                ForEach(Tab.allCases, id: \.self) { t in
                    let button = Button {
                        withAnimation(.snappy) { tab = t }
                    } label: {
                        Text(label(t)).font(font).monospacedDigit().lineLimit(1).fixedSize()
                    }
                    .accessibilityAddTraits(tab == t ? .isSelected : [])
                    if tab == t {
                        button.buttonStyle(.glassProminent)
                    } else {
                        button.buttonStyle(.glass)
                    }
                }
            }
        }
        .padding(.horizontal)
        .padding(.vertical, 2)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    @ViewBuilder private func copyForAgent(_ d: ArtifactDetail) -> some View {
        let menu = Menu {
            AgentCopyItems(slug: slug, title: d.artifact.title, comments: store.comments.count, suggestions: store.openSuggestions.count)
        } label: {
            Label("Copy for your agent", systemImage: "doc.on.doc")
                .font(.caption.weight(.semibold))
        }
        if #available(iOS 26, *) {
            menu.buttonStyle(.glass).controlSize(.small).tint(.accentColor)
        } else {
            menu.labelStyle(.titleAndIcon)
                .padding(.horizontal, 10).padding(.vertical, 5)
                .background(Color.accentColor.opacity(0.12), in: Capsule())
        }
    }

    private func header(_ d: ArtifactDetail) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            if !d.artifact.description.isEmpty {
                Text(d.artifact.description).font(.subheadline).foregroundStyle(.secondary).lineLimit(2)
            }
            HStack(spacing: 6) {
                AgentBadge(agent: d.head.agent)
                Text("saved v\(d.head.number)")
                Text(d.head.created_at, format: .relative(presentation: .named))
                Spacer()
                if store.role != .owner { Text(store.role.label).padding(.horizontal, 6).padding(.vertical, 2).background(.quaternary, in: Capsule()) }
            }
            .font(.caption)
            .foregroundStyle(.secondary)
            copyForAgent(d)
                .padding(.top, 4)
        }
        .padding(.horizontal)
        .padding(.vertical, 8)
    }

    @ViewBuilder private var content: some View {
        switch tab {
        case .preview:
            ZStack(alignment: .bottomTrailing) {
                if let u = store.previewURL {
                    WebPreview(
                        url: u,
                        onComment: { anchor, path in draft = AnchorDraft(anchor: anchor, path: path) },
                        highlight: highlight,
                        highlightMissed: { model.flash("That part isn't in this version anymore.") }
                    )
                    .ignoresSafeArea(edges: .bottom)
                    Button { fullScreen = true } label: {
                        Image(systemName: "arrow.up.left.and.arrow.down.right")
                            .font(.body.weight(.semibold))
                            .padding(12)
                            .background(.regularMaterial, in: Circle())
                    }
                    .accessibilityLabel("Full screen")
                    .padding()
                } else {
                    ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
                }
            }
        case .suggestions:
            SuggestionList(store: store)
        case .comments:
            CommentThreads(slug: slug, comments: store.comments, canComment: true) { await store.load(model.api) }
        case .history:
            HistoryList(store: store)
        }
    }

    @ToolbarContentBuilder private var toolbar: some ToolbarContent {
        ToolbarItemGroup(placement: .topBarTrailing) {
            Button { showSharing = true } label: { Image(systemName: "person.badge.plus") }
                .accessibilityLabel("Share")
            Menu {
                if let d = store.detail {
                    Menu {
                        AgentCopyItems(slug: slug, title: d.artifact.title, comments: store.comments.count, suggestions: store.openSuggestions.count)
                    } label: { Label("Copy", systemImage: "doc.on.doc") }
                    ShareLink(item: model.api.webURL(slug), subject: Text(d.artifact.title)) { Label("Share Folio link", systemImage: "square.and.arrow.up") }
                    Link(destination: model.api.webURL(slug)) { Label("Open in Safari", systemImage: "safari") }
                    Button {
                        Task {
                            do { exportURL = try await model.api.exportZip(slug, title: d.artifact.title, version: d.head.number) } catch { model.flash(error.localizedDescription) }
                        }
                    } label: { Label("Export .zip", systemImage: "doc.zipper") }
                    Button {
                        Task {
                            do {
                                let c = try await model.api.fork(slug)
                                await model.refresh()
                                model.open(.artifact(c.slug))
                                model.flash("Copied into a new artifact")
                            } catch { model.flash(error.localizedDescription) }
                        }
                    } label: { Label("Make a copy", systemImage: "plus.square.on.square") }
                    if store.role == .owner {
                        Button { showRename = true } label: { Label("Rename", systemImage: "pencil") }
                        Divider()
                        Button(role: .destructive) { confirmDelete = true } label: { Label("Delete", systemImage: "trash") }
                    }
                }
            } label: { Image(systemName: "ellipsis.circle") }
            .accessibilityLabel("More")
        }
    }
}

/// Who did something: an agent's name in a small tinted capsule ("iPhone" and "Web" are people).
struct AgentBadge: View {
    let agent: String

    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: icon).imageScale(.small)
            Text(agent).lineLimit(1)
        }
        .font(.caption.weight(.semibold))
        .foregroundStyle(color)
        .padding(.horizontal, 7).padding(.vertical, 2)
        .background(color.opacity(0.13), in: Capsule())
    }

    private var isPerson: Bool { agent == "iPhone" || agent == "Web" }
    private var icon: String { agent == "iPhone" ? "iphone" : agent == "Web" ? "globe" : "sparkle" }
    private var color: Color {
        if isPerson { return .secondary }
        let palette: [Color] = [.blue, .purple, .orange, .teal, .pink, .indigo, .green]
        let h = agent.lowercased().unicodeScalars.reduce(0) { ($0 &* 31 &+ Int($1.value)) & 0xffff }
        return palette[h % palette.count]
    }
}

extension URL: @retroactive Identifiable {
    public var id: String { absoluteString }
}

struct RenameSheet: View {
    let slug: String
    @State var title: String
    @State var description: String
    let done: () -> Void
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var busy = false

    var body: some View {
        NavigationStack {
            Form {
                Section("Title") { TextField("Title", text: $title) }
                Section("Description") { TextField("What it is", text: $description, axis: .vertical).lineLimit(2...5) }
            }
            .navigationTitle("Rename")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        busy = true
                        Task {
                            do {
                                try await model.api.update(slug, title: title, description: description)
                                done()
                                dismiss()
                            } catch { model.flash(error.localizedDescription) }
                            busy = false
                        }
                    }
                    .disabled(busy || title.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
        }
        .presentationDetents([.medium])
    }
}

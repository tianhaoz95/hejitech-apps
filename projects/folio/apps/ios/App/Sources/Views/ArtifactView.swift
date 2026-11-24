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
    @State private var tabBarHeight: CGFloat = 0
    @State private var keyboardShown = false
    /// The brief, the version line and "Copy for your agent" stay out of the way of the page
    /// until the info button in the toolbar shows them.
    @State private var showDetails = false
    @Namespace private var tabSelection

    enum Tab: String, CaseIterable {
        case preview = "Preview", suggestions = "Review", comments = "Comments", history = "History"

        var icon: String {
            switch self {
            case .preview: return "eye"
            case .suggestions: return "checklist"
            case .comments: return "bubble.left.and.bubble.right"
            case .history: return "clock.arrow.circlepath"
            }
        }
    }

    init(slug: String) {
        self.slug = slug
        _store = State(initialValue: ArtifactStore(slug: slug))
    }

    var body: some View {
        VStack(spacing: 0) {
            if let d = store.detail {
                if showDetails {
                    header(d)
                        .transition(.move(edge: .top).combined(with: .opacity))
                    Divider()
                }
                content
                    // The tabs float over the bottom of the content, which scrolls underneath them.
                    .safeAreaInset(edge: .bottom, spacing: 0) {
                        if !keyboardShown {
                            tabBar
                                .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { tabBarHeight = $0 }
                                .transition(.move(edge: .bottom).combined(with: .opacity))
                        }
                    }
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
        .alert("Delete this artifact?", isPresented: $confirmDelete) {
            Button("Delete", role: .destructive) {
                Task {
                    do {
                        try await model.api.delete(slug)
                        await model.refresh()
                        dismiss()
                    } catch { model.flash(error.localizedDescription) }
                }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Every version, suggestion and comment goes with it, for everyone it's shared with. This can't be undone.")
        }
        .onChange(of: model.path.count) { _, _ in Task { await store.load(model.api) } }
        // The comment composer sits just above the tabs; while typing, the tabs step aside so
        // they don't ride up on the keyboard.
        .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillShowNotification)) { _ in
            withAnimation(.snappy) { keyboardShown = true }
        }
        .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillHideNotification)) { _ in
            withAnimation(.snappy) { keyboardShown = false }
        }
    }

    private func count(_ t: Tab) -> Int {
        switch t {
        case .suggestions: return store.openSuggestions.count
        case .comments: return store.comments.count
        default: return 0
        }
    }

    /// Preview / Review / Comments / History: one floating capsule over the bottom of the
    /// content, Liquid Glass on iOS 26 (a material before), so the page shows through it instead
    /// of a bar taking a strip of the screen.
    private var tabBar: some View {
        HStack(spacing: 0) {
            ForEach(Tab.allCases, id: \.self) { t in tabButton(t) }
        }
        .padding(4)
        .modifier(FloatingCapsule())
        .frame(maxWidth: 440)
        .padding(.horizontal, 20)
        .padding(.top, 6)
        .padding(.bottom, 2)
    }

    private func tabButton(_ t: Tab) -> some View {
        let selected = tab == t
        let n = count(t)
        return Button {
            withAnimation(.snappy) { tab = t }
        } label: {
            VStack(spacing: 2) {
                Image(systemName: t.icon)
                    .font(.system(size: 17, weight: .semibold))
                    .frame(height: 22)
                    .overlay(alignment: .topTrailing) {
                        if n > 0 {
                            Text(n > 99 ? "99+" : "\(n)")
                                .font(.system(size: 11, weight: .bold)).monospacedDigit()
                                .foregroundStyle(.white)
                                .padding(.horizontal, 4.5).frame(minWidth: 17, minHeight: 17)
                                .background(t == .suggestions ? Color.coral : Color.red, in: Capsule())
                                .offset(x: 11, y: -5)
                        }
                    }
                Text(t.rawValue).font(.caption2.weight(.semibold)).lineLimit(1).minimumScaleFactor(0.8)
            }
            .foregroundStyle(selected ? Color.accentColor : Color.primary)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 6)
            .background {
                if selected {
                    Capsule().fill(Color.primary.opacity(0.09))
                        .matchedGeometryEffect(id: "selected", in: tabSelection)
                }
            }
            .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(n > 0 ? "\(t.rawValue), \(n)" : t.rawValue)
        .accessibilityAddTraits(selected ? [.isSelected, .isButton] : .isButton)
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
                        highlightMissed: { model.flash("That part isn't in this version anymore.") },
                        bottomInset: tabBarHeight
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
            if store.detail != nil {
                Button {
                    withAnimation(.snappy) { showDetails.toggle() }
                } label: { Image(systemName: showDetails ? "info.circle.fill" : "info.circle") }
                    .accessibilityLabel(showDetails ? "Hide details" : "Show details")
            }
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

/// The floating tab bar's surface: interactive Liquid Glass on iOS 26, a thin material with a
/// soft shadow before it.
private struct FloatingCapsule: ViewModifier {
    func body(content: Content) -> some View {
        if #available(iOS 26, *) {
            content.glassEffect(.regular.interactive(), in: .capsule)
        } else {
            content
                .background(.regularMaterial, in: Capsule())
                .overlay(Capsule().strokeBorder(Color.primary.opacity(0.08)))
                .shadow(color: .black.opacity(0.15), radius: 12, y: 4)
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
            .paperBackground()
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

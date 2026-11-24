import FolioKit
import SwiftUI

/// The home screen (the "Today strip" design, reports/2026-11-21-folio-home-redesign, candidate 03):
/// three counts at the top, what waits for your review and which agent asked, favorites as chips,
/// then everything else in compact rows by when it changed (Today, This week, Earlier). Search
/// replaces all of it with a flat list of matches: titles and descriptions right away, then what
/// the server finds inside the artifacts' files. The grouping is `HomeSections` in FolioKit.
struct HomeView: View {
    @Environment(AppModel.self) private var model
    @State private var query = ""
    @State private var searching = false
    @FocusState private var searchFocused: Bool
    @State private var showSettings = false
    @State private var showActivity = false
    @State private var showConnect = false
    @State private var pendingRemoval: ArtifactSummary?
    /// Artifacts whose files contain the words (GET /api/search), minus the title matches above.
    @State private var fileHits: [SearchHit] = []
    @AppStorage(HomeSpacing.storageKey) private var spacing: HomeSpacing = .compact

    private var matches: [ArtifactSummary] {
        let q = query.trimmingCharacters(in: .whitespaces).lowercased()
        guard !q.isEmpty else { return model.artifacts }
        return model.artifacts.filter { $0.title.lowercased().contains(q) || $0.description.lowercased().contains(q) }
    }

    var body: some View {
        @Bindable var model = model
        NavigationStack(path: $model.path) {
            List {
                if let e = model.listError {
                    Label(e, systemImage: "wifi.exclamationmark").foregroundStyle(.secondary).homeRow()
                }
                if searching {
                    searchField
                    ForEach(matches) { a in row(a) { CompactRow(a: a) } }
                    if !insideHits.isEmpty {
                        header("Found inside artifacts")
                        ForEach(insideHits) { h in row(h.artifact) { FileHitRow(hit: h, words: searchWords) } }
                    }
                } else if !model.artifacts.isEmpty {
                    strip(HomeSections(model.artifacts))
                }
            }
            .listStyle(.plain)
            .environment(\.defaultMinListRowHeight, 0)
            .environment(\.homeSpacing, spacing)
            .animation(.snappy, value: spacing)
            .paperBackground()
            .animation(.default, value: model.artifacts)
            .confirmationDialog(removalTitle, isPresented: Binding(get: { pendingRemoval != nil }, set: { if !$0 { pendingRemoval = nil } }), titleVisibility: .visible, presenting: pendingRemoval) { a in
                Button(a.role == .owner ? "Delete" : "Leave", role: .destructive) {
                    Task { await model.removeFromList(a) }
                }
            } message: { a in
                Text(a.role == .owner
                    ? "Every version, suggestion and comment goes with it, for everyone it's shared with. This can't be undone."
                    : "You and your agents lose access until someone invites you again.")
            }
            .overlay {
                if model.loaded && model.artifacts.isEmpty && model.listError == nil {
                    EmptyHome { showConnect = true }
                } else if !model.loaded {
                    ProgressView()
                } else if searching && matches.isEmpty && insideHits.isEmpty && !query.isEmpty {
                    ContentUnavailableView.search(text: query)
                }
            }
            .refreshable { await model.refresh() }
            .navigationTitle("Folio")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { toolbar }
            .navigationDestination(for: Destination.self) { d in
                switch d {
                case .artifact(let slug): ArtifactView(slug: slug)
                case .suggestion(let slug, let n): SuggestionView(slug: slug, number: n)
                case .comments(let slug): CommentsScreen(slug: slug)
                case .version(let slug, let v): VersionView(slug: slug, number: v)
                }
            }
        }
        .task {
            await model.refresh()
            if let q = model.debugSearch { searching = true; query = q; model.debugSearch = nil }
        }
        .task(id: query) { await searchFiles() }
        .sheet(isPresented: $showSettings) { SettingsView() }
        .sheet(isPresented: $showActivity) { ActivityView() }
        .sheet(isPresented: $showConnect) { NavigationStack { ConnectView(showsDone: true) } }
        .onReceive(NotificationCenter.default.publisher(for: UIApplication.willEnterForegroundNotification)) { _ in
            Task { await model.refresh() }
        }
    }

    @ToolbarContentBuilder
    private var toolbar: some ToolbarContent {
        // The wordmark sits on the paper, not in a glass capsule (iOS 26 gives every bar item one).
        if #available(iOS 26.0, *) {
            ToolbarItem(placement: .topBarLeading) { brand }.sharedBackgroundVisibility(.hidden)
        } else {
            ToolbarItem(placement: .topBarLeading) { brand }
        }
        ToolbarItem(placement: .principal) { Color.clear.frame(width: 1) }
        ToolbarItemGroup(placement: .topBarTrailing) {
            Button {
                withAnimation(.snappy) { searching.toggle() }
                if searching { searchFocused = true } else { query = "" }
            } label: { Image(systemName: searching ? "xmark" : "magnifyingglass") }
                .accessibilityLabel(searching ? "Close search" : "Search")
            Button { showActivity = true } label: {
                Image(systemName: "bell")
                    .overlay(alignment: .topTrailing) {
                        if model.hasUnreadActivity {
                            Circle().fill(.red).frame(width: 9, height: 9).offset(x: 3, y: -2)
                        }
                    }
            }
            .accessibilityLabel(model.hasUnreadActivity ? "Activity, new" : "Activity")
            Button { showSettings = true } label: { Image(systemName: "person.crop.circle") }
                .accessibilityLabel("Settings")
        }
    }

    private var brand: some View {
        HStack(spacing: 8) {
            Image("AppMark").resizable().frame(width: 26, height: 26).clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
            Text("Folio").font(.title3.weight(.bold)).fixedSize()
        }
        .fixedSize()
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isHeader)
    }

    private var searchWords: [String] {
        query.lowercased().replacingOccurrences(of: "\"", with: "").split(separator: " ").map(String.init)
    }

    private var insideHits: [SearchHit] {
        let shown = Set(matches.map(\.id))
        return fileHits.filter { !$0.files.isEmpty && !shown.contains($0.artifact.id) }
    }

    /// Asks the server once typing pauses (it searches every file of every current version).
    private func searchFiles() async {
        let q = query.trimmingCharacters(in: .whitespaces)
        guard searching, q.count >= 2 else { fileHits = []; return }
        try? await Task.sleep(for: .milliseconds(350))
        guard !Task.isCancelled else { return }
        let hits = (try? await model.api.search(q)) ?? []
        guard !Task.isCancelled else { return }
        fileHits = hits
    }

    private var searchField: some View {
        HStack(spacing: 7) {
            Image(systemName: "magnifyingglass").foregroundStyle(.secondary)
            TextField("Search titles and contents", text: $query)
                .focused($searchFocused)
                .submitLabel(.search)
                .autocorrectionDisabled()
            if !query.isEmpty {
                Button { query = "" } label: { Image(systemName: "xmark.circle.fill").foregroundStyle(.tertiary) }
                    .buttonStyle(.borderless)
                    .accessibilityLabel("Clear")
            }
        }
        .padding(.horizontal, 10)
        .frame(height: 36)
        .background(Color(.tertiarySystemFill), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
        .homeRow(top: 4, bottom: 8)
    }

    @ViewBuilder
    private func strip(_ home: HomeSections) -> some View {
        StatsStrip(home: home).homeRow(top: 4, bottom: 6)

        if !home.review.isEmpty {
            header("To review")
            ForEach(home.review) { a in
                row(a, top: spacing.reviewPadding, bottom: spacing.reviewPadding) { ReviewRow(a: a) }
            }
        }
        if !home.favorites.isEmpty {
            header("Favorites")
            FavoriteChips(artifacts: home.favorites, spacing: spacing.chipSpacing) { a in
                model.path.append(Destination.artifact(a.slug))
            } unfavorite: { a in
                Task { await model.toggleFavorite(a) }
            }
            .homeRow(top: 2, bottom: 4)
        }
        ForEach(home.dayGroups, id: \.title) { group in
            header(group.title)
            ForEach(group.artifacts) { a in row(a) { CompactRow(a: a) } }
        }
    }

    private func header(_ title: String) -> some View {
        Text(title)
            .font(.footnote.weight(.semibold))
            .foregroundStyle(.primary)
            .accessibilityAddTraits(.isHeader)
            .homeRow(top: spacing.headerTop, bottom: 4)
    }
}

extension HomeView {
    private var removalTitle: String {
        guard let a = pendingRemoval else { return "" }
        return a.role == .owner ? "Delete \"\(a.title)\"?" : "Leave \"\(a.title)\"?"
    }

    /// A row with its swipe actions: favorite from the leading edge, delete (or leave, when it's
    /// shared with you) from the trailing edge, always confirmed first.
    private func row<Content: View>(_ a: ArtifactSummary, top: CGFloat? = nil, bottom: CGFloat? = nil, @ViewBuilder content: () -> Content) -> some View {
        let top = top ?? spacing.rowPadding, bottom = bottom ?? spacing.rowPadding
        let card = a.needsReview && !searching
        return NavigationLink(value: Destination.artifact(a.slug)) { content() }
            .homeRow(top: top, bottom: bottom, horizontal: card ? 26 : 16, background: card ? Color.coral.opacity(0.1) : .clear)
            .contextMenu {
                AgentCopyItems(slug: a.slug, title: a.title, comments: a.unresolved_comments ?? 0, suggestions: a.open_suggestions)
            }
            .swipeActions(edge: .leading, allowsFullSwipe: true) {
                Button {
                    Task { await model.toggleFavorite(a) }
                } label: {
                    Label(a.isFavorite ? "Unfavorite" : "Favorite", systemImage: a.isFavorite ? "star.slash.fill" : "star.fill")
                }
                .tint(.mustard)
            }
            .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                // Not `role: .destructive`: that animates the row away before the confirmation.
                Button {
                    pendingRemoval = a
                } label: {
                    Label(a.role == .owner ? "Delete" : "Leave", systemImage: a.role == .owner ? "trash" : "rectangle.portrait.and.arrow.right")
                }
                .tint(.red)
            }
    }
}

private extension View {
    /// A list row on the paper: no separator, no background, Folio's own spacing.
    /// `background` other than clear is drawn as a rounded card inside the row's margins.
    func homeRow(top: CGFloat = 5, bottom: CGFloat = 5, horizontal: CGFloat = 16, background: Color = .clear) -> some View {
        listRowInsets(EdgeInsets(top: top, leading: horizontal, bottom: bottom, trailing: horizontal))
            .listRowSeparator(.hidden)
            .listRowBackground(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(background)
                    .padding(.horizontal, 16).padding(.vertical, 3)
            )
    }
}

/// Suggestions to review, artifacts changed today and open comments (the last only when the
/// server sends comment counts).
private struct StatsStrip: View {
    let home: HomeSections

    var body: some View {
        HStack(spacing: 8) {
            tile(home.suggestionsToReview, home.suggestionsToReview == 1 ? "suggestion\nto review" : "suggestions\nto review", .coral)
            tile(home.changedToday, "changed\ntoday", .accentColor)
            if let comments = home.openComments {
                tile(comments, comments == 1 ? "open\ncomment" : "open\ncomments", .mustardInk)
            }
        }
    }

    private func tile(_ value: Int, _ label: String, _ tint: Color) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text("\(value)").font(.title2.weight(.bold)).monospacedDigit().foregroundStyle(value == 0 ? Color.secondary : tint)
            Text(label).font(.caption).foregroundStyle(.secondary).lineLimit(2, reservesSpace: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 11).padding(.vertical, 9)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        .accessibilityElement(children: .combine)
    }
}

/// An artifact waiting for review: how many suggestions, the title, and who asked.
struct ReviewRow: View {
    let a: ArtifactSummary
    @Environment(\.homeSpacing) private var spacing

    var body: some View {
        HStack(spacing: 10) {
            Text("\(a.open_suggestions)")
                .font(.caption.weight(.bold)).monospacedDigit()
                .foregroundStyle(.white)
                .frame(minWidth: 24, minHeight: 24)
                .background(Color.coral, in: Circle())
                .accessibilityLabel("\(a.open_suggestions) open suggestion\(a.open_suggestions == 1 ? "" : "s")")
            VStack(alignment: .leading, spacing: spacing.lineSpacing) {
                Text(a.title).font(.subheadline.weight(.semibold)).lineLimit(1)
                Text(detail).font(.caption).foregroundStyle(.secondary).lineLimit(1)
            }
        }
        .padding(.vertical, 3)
    }

    private var detail: String {
        let when = HomeSections.shortTime(a.updated_at)
        if let agent = a.review_agent, !agent.isEmpty { return "from \(agent) · \(when)" }
        return "\(a.open_suggestions) suggestion\(a.open_suggestions == 1 ? "" : "s") · \(when)"
    }
}

/// One line per artifact: a small tile, the title, its version and access, and when it changed.
struct CompactRow: View {
    let a: ArtifactSummary
    @Environment(\.homeSpacing) private var spacing

    var body: some View {
        HStack(spacing: 10) {
            ArtifactTile(size: spacing.tileSize)
            VStack(alignment: .leading, spacing: spacing.lineSpacing) {
                HStack(spacing: 4) {
                    if a.isFavorite {
                        Image(systemName: "star.fill").font(.caption2).foregroundStyle(Color.mustard).accessibilityLabel("Favorite")
                    }
                    Text(a.title).font(.subheadline.weight(.semibold)).lineLimit(1)
                }
                HStack(spacing: 4) {
                    Text("v\(a.head_version)")
                    if a.role != .owner { Text("· \(a.role.label)") }
                    if a.visibility == .link { Image(systemName: "link").accessibilityLabel("Anyone with the link") }
                    if a.needsReview { Text("· \(a.open_suggestions) to review").foregroundStyle(Color.coral) }
                }
                .font(.caption)
                .foregroundStyle(.secondary)
            }
            Spacer(minLength: 6)
            Text(HomeSections.shortTime(a.updated_at)).font(.caption).foregroundStyle(.secondary).monospacedDigit()
        }
    }
}

struct ArtifactTile: View {
    var size: CGFloat = 34

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: size * 0.24, style: .continuous).fill(Color.accentColor.opacity(0.1))
            Image(systemName: "doc.richtext").font(.system(size: size * 0.42)).foregroundStyle(Color.accentColor)
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}

/// Favorites as chips that wrap; tap to open, long-press to unfavorite or copy for an agent.
private struct FavoriteChips: View {
    let artifacts: [ArtifactSummary]
    var spacing: CGFloat = 6
    let open: (ArtifactSummary) -> Void
    let unfavorite: (ArtifactSummary) -> Void

    var body: some View {
        FlowLayout(spacing: spacing) {
            ForEach(artifacts) { a in
                Button { open(a) } label: {
                    HStack(spacing: 6) {
                        ArtifactTile(size: 22)
                        Text(a.title).font(.footnote.weight(.semibold)).lineLimit(1).foregroundStyle(.primary)
                    }
                    .padding(.leading, 4).padding(.trailing, 10).padding(.vertical, 4)
                    .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                }
                .buttonStyle(.borderless)
                .contextMenu {
                    Button { unfavorite(a) } label: { Label("Unfavorite", systemImage: "star.slash") }
                    AgentCopyItems(slug: a.slug, title: a.title, comments: a.unresolved_comments ?? 0, suggestions: a.open_suggestions)
                }
            }
        }
    }
}

/// Lays its children out left to right, wrapping onto new lines; a child wider than the row is
/// given the row's width.
private struct FlowLayout: Layout {
    var spacing: CGFloat = 6

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let rows = arrange(width: proposal.width ?? .infinity, subviews: subviews)
        let height = rows.reduce(0) { $0 + $1.height } + spacing * CGFloat(max(0, rows.count - 1))
        let width = rows.map(\.width).max() ?? 0
        return CGSize(width: proposal.width ?? width, height: height)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var y = bounds.minY
        for row in arrange(width: bounds.width, subviews: subviews) {
            var x = bounds.minX
            for (index, size) in row.items {
                subviews[index].place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(size))
                x += size.width + spacing
            }
            y += row.height + spacing
        }
    }

    private func arrange(width: CGFloat, subviews: Subviews) -> [(items: [(Int, CGSize)], width: CGFloat, height: CGFloat)] {
        var rows: [(items: [(Int, CGSize)], width: CGFloat, height: CGFloat)] = []
        var current: [(Int, CGSize)] = []
        var x: CGFloat = 0, height: CGFloat = 0
        for (index, subview) in subviews.enumerated() {
            var size = subview.sizeThatFits(.unspecified)
            if size.width > width { size = subview.sizeThatFits(ProposedViewSize(width: width, height: nil)) }
            if !current.isEmpty, x + spacing + size.width > width {
                rows.append((current, x, height))
                current = []; x = 0; height = 0
            }
            x += (current.isEmpty ? 0 : spacing) + size.width
            height = max(height, size.height)
            current.append((index, size))
        }
        if !current.isEmpty { rows.append((current, x, height)) }
        return rows
    }
}

private struct EmptyHome: View {
    let connect: () -> Void

    var body: some View {
        ContentUnavailableView {
            Label("No artifacts yet", systemImage: "sparkles.rectangle.stack")
        } description: {
            Text("Connect Claude, Gemini or another agent and ask it to save something to Folio. You can also share a page, text or photos to Folio from any app.")
        } actions: {
            Button("Connect an agent", action: connect).buttonStyle(.borderedProminent)
        }
    }
}

/// A search result found inside an artifact's files: the title, then each file with the words
/// highlighted in its excerpt.
struct FileHitRow: View {
    let hit: SearchHit
    let words: [String]

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(hit.artifact.title).font(.body.weight(.semibold)).lineLimit(1)
            ForEach(hit.files.prefix(2), id: \.path) { f in
                (Text(f.path).font(.caption.monospaced()).foregroundStyle(.secondary) + Text("  ") + highlighted(f.excerpt))
                    .font(.caption)
                    .lineLimit(3)
            }
        }
        .padding(.vertical, 2)
        .accessibilityElement(children: .combine)
    }

    private func highlighted(_ text: String) -> Text {
        var s = AttributedString(text)
        let lower = text.lowercased()
        for w in words where !w.isEmpty {
            var from = lower.startIndex
            while let r = lower.range(of: w, range: from..<lower.endIndex) {
                if let lo = AttributedString.Index(r.lowerBound, within: s), let hi = AttributedString.Index(r.upperBound, within: s) {
                    s[lo..<hi].backgroundColor = Color.mustard.opacity(0.55)
                    s[lo..<hi].foregroundColor = .primary
                }
                from = r.upperBound
            }
        }
        return Text(s).foregroundColor(.secondary)
    }
}

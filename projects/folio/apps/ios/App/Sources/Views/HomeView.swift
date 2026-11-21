import FolioKit
import SwiftUI

/// The artifact list: what needs your review first, then everything you can open.
struct HomeView: View {
    @Environment(AppModel.self) private var model
    @State private var query = ""
    @State private var showSettings = false
    @State private var showActivity = false
    @State private var showConnect = false
    @State private var pendingRemoval: ArtifactSummary?

    private var filtered: [ArtifactSummary] {
        let q = query.trimmingCharacters(in: .whitespaces).lowercased()
        guard !q.isEmpty else { return model.artifacts }
        return model.artifacts.filter { $0.title.lowercased().contains(q) || $0.description.lowercased().contains(q) }
    }
    private var needsReview: [ArtifactSummary] { filtered.filter { $0.open_suggestions > 0 && $0.role.canReview } }
    private var others: [ArtifactSummary] { filtered.filter { !($0.open_suggestions > 0 && $0.role.canReview) } }
    private var favorites: [ArtifactSummary] { others.filter(\.isFavorite) }
    private var rest: [ArtifactSummary] { others.filter { !$0.isFavorite } }

    var body: some View {
        @Bindable var model = model
        NavigationStack(path: $model.path) {
            List {
                if let e = model.listError {
                    Section {
                        Label(e, systemImage: "wifi.exclamationmark").foregroundStyle(.secondary)
                    }
                }
                if !needsReview.isEmpty {
                    Section {
                        ForEach(needsReview) { a in row(a) }
                    } header: {
                        Text("Needs your review")
                    }
                }
                if !favorites.isEmpty {
                    Section("Favorites") {
                        ForEach(favorites) { a in row(a) }
                    }
                }
                if !rest.isEmpty {
                    Section(needsReview.isEmpty && favorites.isEmpty ? "" : "Artifacts") {
                        ForEach(rest) { a in row(a) }
                    }
                }
            }
            .listStyle(.insetGrouped)
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
                } else if filtered.isEmpty && !query.isEmpty {
                    ContentUnavailableView.search(text: query)
                }
            }
            .searchable(text: $query, prompt: "Search artifacts")
            .refreshable { await model.refresh() }
            .navigationTitle("Folio")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button { showSettings = true } label: { Image(systemName: "person.crop.circle") }
                        .accessibilityLabel("Settings")
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button { showActivity = true } label: {
                        Image(systemName: "bell")
                            .overlay(alignment: .topTrailing) {
                                if model.hasUnreadActivity {
                                    Circle().fill(.red).frame(width: 9, height: 9).offset(x: 3, y: -2)
                                }
                            }
                    }
                    .accessibilityLabel(model.hasUnreadActivity ? "Activity, new" : "Activity")
                }
            }
            .navigationDestination(for: Destination.self) { d in
                switch d {
                case .artifact(let slug): ArtifactView(slug: slug)
                case .suggestion(let slug, let n): SuggestionView(slug: slug, number: n)
                case .comments(let slug): CommentsScreen(slug: slug)
                case .version(let slug, let v): VersionView(slug: slug, number: v)
                }
            }
        }
        .task { await model.refresh() }
        .sheet(isPresented: $showSettings) { SettingsView() }
        .sheet(isPresented: $showActivity) { ActivityView() }
        .sheet(isPresented: $showConnect) { NavigationStack { ConnectView(showsDone: true) } }
        .onReceive(NotificationCenter.default.publisher(for: UIApplication.willEnterForegroundNotification)) { _ in
            Task { await model.refresh() }
        }
    }
}

extension HomeView {
    private var removalTitle: String {
        guard let a = pendingRemoval else { return "" }
        return a.role == .owner ? "Delete \"\(a.title)\"?" : "Leave \"\(a.title)\"?"
    }

    /// A row with its swipe actions: favorite from the leading edge, delete (or leave, when it's
    /// shared with you) from the trailing edge, always confirmed first.
    private func row(_ a: ArtifactSummary) -> some View {
        NavigationLink(value: Destination.artifact(a.slug)) { ArtifactRow(a: a) }
            .contextMenu { AgentCopyItems(slug: a.slug, title: a.title, suggestions: a.open_suggestions) }
            .swipeActions(edge: .leading, allowsFullSwipe: true) {
                Button {
                    Task { await model.toggleFavorite(a) }
                } label: {
                    Label(a.isFavorite ? "Unfavorite" : "Favorite", systemImage: a.isFavorite ? "star.slash.fill" : "star.fill")
                }
                .tint(.yellow)
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

struct ArtifactRow: View {
    let a: ArtifactSummary

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 9, style: .continuous).fill(Color.accentColor.opacity(0.12))
                Image(systemName: "doc.richtext").foregroundStyle(Color.accentColor)
            }
            .frame(width: 38, height: 38)
            VStack(alignment: .leading, spacing: 3) {
                HStack(alignment: .firstTextBaseline, spacing: 5) {
                    if a.isFavorite {
                        Image(systemName: "star.fill").font(.caption).foregroundStyle(.yellow).accessibilityLabel("Favorite")
                    }
                    Text(a.title).font(.body.weight(.semibold)).lineLimit(2)
                }
                if !a.description.isEmpty {
                    Text(a.description).font(.subheadline).foregroundStyle(.secondary).lineLimit(2)
                }
                HStack(spacing: 6) {
                    Text("v\(a.head_version)")
                    Text("·")
                    Text(a.updated_at, format: .relative(presentation: .named))
                    if a.role != .owner {
                        Text("·")
                        Text(a.role.label)
                    }
                    if a.visibility == .link {
                        Image(systemName: "link").accessibilityLabel("Anyone with the link")
                    }
                }
                .font(.caption)
                .foregroundStyle(.secondary)
            }
            Spacer(minLength: 0)
            if a.open_suggestions > 0 {
                Text("\(a.open_suggestions)")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 8).padding(.vertical, 3)
                    .background(Color.accentColor, in: Capsule())
                    .accessibilityLabel("\(a.open_suggestions) open suggestions")
            }
        }
        .padding(.vertical, 2)
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

import FolioKit
import SwiftUI

/// The artifact list: what needs your review first, then everything you can open.
struct HomeView: View {
    @Environment(AppModel.self) private var model
    @State private var query = ""
    @State private var showSettings = false
    @State private var showActivity = false
    @State private var showConnect = false

    private var filtered: [ArtifactSummary] {
        let q = query.trimmingCharacters(in: .whitespaces).lowercased()
        guard !q.isEmpty else { return model.artifacts }
        return model.artifacts.filter { $0.title.lowercased().contains(q) || $0.description.lowercased().contains(q) }
    }
    private var needsReview: [ArtifactSummary] { filtered.filter { $0.open_suggestions > 0 && $0.role.canReview } }
    private var rest: [ArtifactSummary] { filtered.filter { !($0.open_suggestions > 0 && $0.role.canReview) } }

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
                        ForEach(needsReview) { a in
                            NavigationLink(value: Destination.artifact(a.slug)) { ArtifactRow(a: a) }
                                .contextMenu { AgentCopyItems(slug: a.slug, title: a.title, suggestions: a.open_suggestions) }
                        }
                    } header: {
                        Text("Needs your review")
                    }
                }
                if !rest.isEmpty {
                    Section(needsReview.isEmpty ? "" : "Artifacts") {
                        ForEach(rest) { a in
                            NavigationLink(value: Destination.artifact(a.slug)) { ArtifactRow(a: a) }
                                .contextMenu { AgentCopyItems(slug: a.slug, title: a.title, suggestions: a.open_suggestions) }
                        }
                    }
                }
            }
            .listStyle(.insetGrouped)
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
                Text(a.title).font(.body.weight(.semibold)).lineLimit(2)
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

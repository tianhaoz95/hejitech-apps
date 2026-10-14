import SwiftUI
#if canImport(FeedbackKit)
import FeedbackKit
#endif

public struct NoteListView: View {
    @StateObject private var viewModel = NoteListViewModel()
    @StateObject private var syncService = WatchSyncService.shared
    @Environment(\.scenePhase) private var scenePhase
    @State private var selectedDetailNote: VoiceNote? = nil
    @State private var selectedDetailTab: NoteDetailViewModel.DetailTab = .cleanedNote
    @State private var keyboardRecordTrigger: KeyboardRecordTrigger?
    @State private var isSearchExpanded: Bool = false
    @State private var showingWhatsNew: Bool = WhatsNewView.shouldShowAutomatically
    @FocusState private var isSearchFieldFocused: Bool

    public init() {}

    public var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                if isSearchExpanded {
                    searchAndTagsHeader
                        .transition(
                            .asymmetric(
                                insertion: .scale(scale: 0.95, anchor: .topTrailing)
                                    .combined(with: .opacity)
                                    .combined(with: .move(edge: .top)),
                                removal: .scale(scale: 0.95, anchor: .topTrailing)
                                    .combined(with: .opacity)
                                    .combined(with: .move(edge: .top))
                            )
                        )
                }

                notesList
            }
            .navigationTitle(viewModel.showArchived ? "Archived Notes" : "")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    if viewModel.showArchived {
                        Button {
                            withAnimation {
                                viewModel.showArchived = false
                            }
                        } label: {
                            Label("Active Notes", systemImage: "chevron.left")
                        }
                    } else {
                        VoxbriefLogoView(size: .inline)
                    }
                }
                .hideSharedBackgroundIfAvailable()

                ToolbarItem(placement: .navigationBarTrailing) {
                    searchToolbarButton
                }

                ToolbarItemGroup(placement: .navigationBarTrailing) {
                    trailingToolbarGroup
                }

                ToolbarItem(placement: .bottomBar) {
                    recordBottomBarButton
                }
            }
            .sheet(isPresented: $viewModel.showingRecordSheet) {
                QuickRecordSheet {}
            }
            .sheet(item: $keyboardRecordTrigger) { _ in
                KeyboardRecordSheet()
            }
            .sheet(isPresented: $viewModel.showingSyncStatus) {
                WatchSyncStatusView(syncService: syncService)
            }
            .sheet(isPresented: $viewModel.showingSettings) {
                SettingsView()
            }
            .sheet(isPresented: $showingWhatsNew) {
                WhatsNewView()
            }
            .sheet(item: $viewModel.mergeSourceNote) { source in
                NoteMergePickerSheet(source: source, candidates: viewModel.mergeCandidates(excluding: source)) { target in
                    viewModel.confirmMerge(source: source, into: target)
                }
            }
            .navigationDestination(item: $selectedDetailNote) { note in
                NoteDetailView(note: note, initialTab: selectedDetailTab)
            }
            .trackFeedbackScreen("NoteList")
            .onAppear {
                applyLaunchArguments()
            }
            .onReceive(NotificationCenter.default.publisher(for: .voxbriefNavigate)) { notification in
                guard let userInfo = notification.userInfo as? [String: String],
                      let screen = userInfo["screen"] else { return }
                applyNavigation(screen: screen, tab: userInfo["tab"])
            }
            .onChange(of: scenePhase) { _, newPhase in
                if newPhase == .active {
                    Task { await viewModel.refresh() }
                }
            }
            .onChange(of: viewModel.showingSyncStatus) { _, isShowing in
                if !isShowing {
                    #if canImport(FeedbackKit)
                    FeedbackKit.currentScreen = "NoteList"
                    #endif
                }
            }
            .onChange(of: viewModel.showingSettings) { _, isShowing in
                if !isShowing {
                    #if canImport(FeedbackKit)
                    FeedbackKit.currentScreen = "NoteList"
                    #endif
                }
            }
        }
    }

    private func applyLaunchArguments() {
        let args = ProcessInfo.processInfo.arguments
        if let screenIdx = args.firstIndex(of: "-voxbriefScreen"), screenIdx + 1 < args.count {
            let screen = args[screenIdx + 1]
            let tab = args.firstIndex(of: "-voxbriefTab").flatMap { idx in
                idx + 1 < args.count ? args[idx + 1] : nil
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                applyNavigation(screen: screen, tab: tab)
            }
        }
        if let searchIdx = args.firstIndex(of: "-voxbriefSearch"), searchIdx + 1 < args.count {
            let query = args[searchIdx + 1]
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) {
                    isSearchExpanded = true
                }
                viewModel.searchText = query
            }
        }
        if let tagIdx = args.firstIndex(of: "-voxbriefTag"), tagIdx + 1 < args.count {
            let tag = args[tagIdx + 1]
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) {
                    isSearchExpanded = true
                }
                viewModel.selectedTag = tag
            }
        }
    }

    private func applyNavigation(screen: String, tab: String?) {
        viewModel.showingRecordSheet = false
        viewModel.showingSyncStatus = false
        viewModel.showingSettings = false
        keyboardRecordTrigger = nil
        selectedDetailNote = nil

        switch screen {
        case "list":
            collapseSearch()
        case "search":
            withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) {
                isSearchExpanded = true
                isSearchFieldFocused = true
            }
        case "detail":
            collapseSearch()
            if let note = viewModel.notes.first {
                switch tab {
                case "raw": selectedDetailTab = .rawTranscript
                case "pipeline": selectedDetailTab = .pipeline
                case "light": selectedDetailTab = .lightCleanup
                default: selectedDetailTab = .cleanedNote
                }
                selectedDetailNote = note
            }
        case "record":
            viewModel.showingRecordSheet = true
        case "keyboardRecord":
            keyboardRecordTrigger = KeyboardRecordTrigger()
        case "settings":
            viewModel.showingSettings = true
        case "sync":
            viewModel.showingSyncStatus = true
        default:
            break
        }
    }

    // MARK: - Subviews

    private var notesList: some View {
        List {
            if viewModel.notes.isEmpty {
                emptyStateView
                    .listRowInsets(EdgeInsets())
                    .listRowSeparator(.hidden)
                    .listRowBackground(Color.clear)
                    .frame(maxWidth: .infinity, minHeight: 350)
            } else if !viewModel.showArchived && !viewModel.pinnedNotes.isEmpty {
                Section {
                    ForEach(viewModel.pinnedNotes) { note in
                        noteRowItem(note: note)
                    }
                } header: {
                    Label("Pinned", systemImage: "pin.fill")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(Color.accentColor)
                }

                if !viewModel.unpinnedNotes.isEmpty {
                    Section {
                        ForEach(viewModel.unpinnedNotes) { note in
                            noteRowItem(note: note)
                        }
                    } header: {
                        Text("Notes")
                            .font(.footnote.weight(.semibold))
                            .foregroundStyle(.secondary)
                    }
                }
            } else {
                ForEach(viewModel.notes) { note in
                    noteRowItem(note: note)
                }
            }
        }
        .listStyle(.insetGrouped)
        .scrollDismissesKeyboard(.interactively)
        .refreshable {
            await viewModel.refresh()
        }
    }

    private func noteRowItem(note: VoiceNote) -> some View {
        NavigationLink(destination: NoteDetailView(note: note)) {
            NoteRowView(note: note)
        }
        .swipeActions(edge: .leading) {
            Button {
                viewModel.toggleFavorite(note: note)
            } label: {
                Label(note.isFavorite ? "Unfavorite" : "Favorite", systemImage: note.isFavorite ? "star.slash" : "star.fill")
            }
            .tint(.yellow)

            Button {
                viewModel.togglePinned(note: note)
            } label: {
                Label(note.isPinned ? "Unpin" : "Pin", systemImage: note.isPinned ? "pin.slash.fill" : "pin.fill")
            }
            .tint(Color.accentColor)
        }
        .swipeActions(edge: .trailing, allowsFullSwipe: false) {
            Button(role: .destructive) {
                viewModel.delete(note: note)
            } label: {
                Label("Delete", systemImage: "trash")
            }

            Button {
                viewModel.toggleArchived(note: note)
            } label: {
                Label(note.isArchived ? "Unarchive" : "Archive", systemImage: note.isArchived ? "tray.and.arrow.up.fill" : "archivebox.fill")
            }
            .tint(.purple)

            Button {
                viewModel.duplicate(note: note)
            } label: {
                Label("Duplicate", systemImage: "doc.on.doc")
            }
            .tint(.indigo)

            if note.status == .failed {
                Button {
                    viewModel.retryProcessing(note: note)
                } label: {
                    Label("Retry", systemImage: "arrow.triangle.2.circlepath")
                }
                .tint(.accentColor)
            }

            if note.status == .ready {
                Button {
                    viewModel.beginMerge(source: note)
                } label: {
                    Label("Append To…", systemImage: "arrow.triangle.merge")
                }
                .tint(.blue)
            }
        }
    }

    @ViewBuilder
    private var searchToolbarButton: some View {
        if !isSearchExpanded {
            Button {
                withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) {
                    isSearchExpanded = true
                    isSearchFieldFocused = true
                }
            } label: {
                Image(systemName: "magnifyingglass")
            }
            .accessibilityLabel("Search and filter tags")
        }
    }

    @ViewBuilder
    private var trailingToolbarGroup: some View {
        Button {
            viewModel.showingSyncStatus = true
        } label: {
            Image(systemName: "applewatch")
                .foregroundStyle(watchIconColor)
        }
        .accessibilityLabel(syncService.isReachable ? "Apple Watch connected" : "Apple Watch disconnected")

        Menu {
            Section("Sort By") {
                Picker("Sort Order", selection: $viewModel.sortOption) {
                    ForEach(SortOption.allCases) { opt in
                        Text(opt.rawValue).tag(opt)
                    }
                }
            }

            Section("Filters") {
                Picker("Source Filter", selection: $viewModel.filterSource) {
                    Text("All Sources").tag(NoteSource?.none)
                    Text("Apple Watch").tag(NoteSource?.some(.watchApp))
                    Text("Watch Complication").tag(NoteSource?.some(.watchComplication))
                    Text("Watch Live Activity").tag(NoteSource?.some(.watchLiveActivity))
                    Text("iPhone Direct").tag(NoteSource?.some(.phoneApp))
                }

                Toggle(isOn: $viewModel.onlyFavorites) {
                    Label("Favorites Only", systemImage: "star")
                }

                Toggle(isOn: $viewModel.showArchived) {
                    Label("Show Archived", systemImage: "archivebox")
                }
            }

            Divider()

            ShareLink(item: viewModel.exportAllNotesMarkdown()) {
                Label("Export All Notes", systemImage: "square.and.arrow.up.on.square")
            }
        } label: {
            Image(systemName: "line.3.horizontal.decrease.circle")
        }

        Button {
            viewModel.showingSettings = true
        } label: {
            Image(systemName: "gearshape")
        }
    }

    private var recordBottomBarButton: some View {
        Button {
            viewModel.showingRecordSheet = true
        } label: {
            Image(systemName: "mic.fill")
        }
        .tint(Color.accentColor)
        .overlay(alignment: .topTrailing) {
            if viewModel.pipeline.activeProcessingCount > 0 {
                Circle()
                    .fill(.orange)
                    .frame(width: 7, height: 7)
                    .offset(x: 8, y: -6)
            }
        }
    }

    private var watchIconColor: Color {
        syncService.isReachable ? .green : .secondary
    }

    private var searchAndTagsHeader: some View {
        VStack(spacing: 8) {
            searchBar

            Picker("Scope", selection: $viewModel.searchScope) {
                ForEach(SearchScope.allCases) { scope in
                    Text(scope.rawValue).tag(scope)
                }
            }
            .pickerStyle(.segmented)
            .padding(.horizontal)

            if !viewModel.tagCounts.isEmpty {
                tagFilterBar
            }
        }
        .padding(.bottom, 6)
        .background(Color(UIColor.systemBackground))
    }

    private var searchBar: some View {
        HStack(spacing: 8) {
            HStack(spacing: 6) {
                Image(systemName: "magnifyingglass")
                    .foregroundStyle(.secondary)
                    .font(.system(size: 16))

                TextField("Search notes, requirements, tags...", text: $viewModel.searchText)
                    .font(.body)
                    .focused($isSearchFieldFocused)
                    .autocorrectionDisabled()
                    .textInputAutocapitalization(.never)
                    .submitLabel(.search)
                    .onSubmit {
                        isSearchFieldFocused = false
                    }

                if !viewModel.searchText.isEmpty {
                    Button {
                        viewModel.searchText = ""
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundStyle(.secondary)
                            .font(.system(size: 15))
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Clear search text")
                }
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 8)
            .background {
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(Color(UIColor.secondarySystemFill))
            }

            Button("Cancel") {
                collapseSearch()
            }
            .font(.body)
            .foregroundStyle(Color.accentColor)
        }
        .padding(.horizontal)
        .padding(.top, 8)
    }

    private func collapseSearch() {
        withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) {
            isSearchExpanded = false
        }
        viewModel.searchText = ""
        viewModel.selectedTag = nil
        isSearchFieldFocused = false
    }

    private var tagFilterBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                filterChip(title: "All", isSelected: viewModel.selectedTag == nil) {
                    viewModel.selectedTag = nil
                }

                ForEach(viewModel.tagCounts, id: \.tag) { item in
                    filterChip(title: "\(item.tag) (\(item.count))", isSelected: viewModel.selectedTag == item.tag) {
                        if viewModel.selectedTag == item.tag {
                            viewModel.selectedTag = nil
                        } else {
                            viewModel.selectedTag = item.tag
                        }
                    }
                }
            }
            .padding(.horizontal)
            .padding(.vertical, 4)
        }
    }

    private func filterChip(title: String, isSelected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(.subheadline.weight(.medium))
                .padding(.horizontal, 14)
                .padding(.vertical, 7)
                .background {
                    Capsule()
                        .fill(isSelected ? Color.accentColor : Color(UIColor.tertiarySystemFill))
                }
                .foregroundStyle(isSelected ? .white : .primary)
        }
        .buttonStyle(.plain)
    }

    private var isAnyFilterActive: Bool {
        !viewModel.searchText.isEmpty || viewModel.selectedTag != nil || viewModel.filterSource != nil || viewModel.onlyFavorites || viewModel.showArchived
    }

    private var emptyStateView: some View {
        VStack(spacing: 18) {
            Spacer()

            if viewModel.showArchived {
                Image(systemName: "archivebox")
                    .font(.system(size: 46, weight: .light))
                    .foregroundStyle(.tertiary)

                VStack(spacing: 6) {
                    Text("No Archived Notes")
                        .font(.title3.weight(.semibold))
                    Text("Archived notes will appear here when you swipe to archive them.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 40)
                }
            } else if isAnyFilterActive {
                Image(systemName: "magnifyingglass")
                    .font(.system(size: 46, weight: .light))
                    .foregroundStyle(.tertiary)

                VStack(spacing: 6) {
                    Text("No Matching Notes")
                        .font(.title3.weight(.semibold))
                    Text("Try searching with different keywords or clearing your filters.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 40)
                }
            } else {
                Image(systemName: "waveform")
                    .font(.system(size: 46, weight: .light))
                    .foregroundStyle(.tertiary)

                VStack(spacing: 6) {
                    Text("No Notes Yet")
                        .font(.title3.weight(.semibold))
                    Text("Record from your Apple Watch, or tap the mic icon to capture an idea.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 40)
                }
            }

            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

private struct KeyboardRecordTrigger: Identifiable {
    let id = UUID()
}

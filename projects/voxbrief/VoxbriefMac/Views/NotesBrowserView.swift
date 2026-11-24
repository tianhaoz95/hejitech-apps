import SwiftUI
#if canImport(FeedbackKit)
import FeedbackKit
#endif

/// Full-featured Mac counterpart to the iPhone app's `NoteListView` + `NoteDetailView` — same
/// notes (search, tag/source/favorite filters, export, edit, favorite, reprocess, retry, add
/// recording, append-to-note) and the same `NoteDetailView`, just in a desktop `NavigationSplitView`
/// instead of iOS's push navigation, since a list+detail split view is the native Mac idiom for
/// this rather than aping iOS's own chrome.
///
/// Backed by this app's own `NoteRepository`/`NoteProcessingPipeline`/`AudioPlaybackService`
/// instances (see `VoxbriefMacApp`) -- separate from the iPhone app's, since the two apps'
/// histories are intentionally separate (see `CaptureCoordinator`).
struct NotesBrowserView: View {
    @StateObject private var viewModel: NoteListViewModel
    private let repository: NoteRepository
    private let pipeline: NoteProcessingPipeline
    private let playbackService: AudioPlaybackService
    @ObservedObject private var meetingRecorder: MacMeetingRecorderService

    @State private var selectedNoteId: VoiceNote.ID?
    @State private var showingAsk: Bool = false

    init(
        repository: NoteRepository,
        pipeline: NoteProcessingPipeline,
        playbackService: AudioPlaybackService,
        meetingRecorder: MacMeetingRecorderService
    ) {
        self.repository = repository
        self.pipeline = pipeline
        self.playbackService = playbackService
        self.meetingRecorder = meetingRecorder
        _viewModel = StateObject(wrappedValue: NoteListViewModel(repository: repository, pipeline: pipeline))
    }

    var body: some View {
        NavigationSplitView {
            sidebar
        } detail: {
            if let note = viewModel.notes.first(where: { $0.id == selectedNoteId }) {
                NoteDetailView(note: note, repository: repository, pipeline: pipeline, playbackService: playbackService)
                    .id(note.id)
            } else {
                ContentUnavailableView("Select a Note", systemImage: "waveform")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(AppPageBackground())
            }
        }
        .sheet(isPresented: $showingAsk) {
            AskView(playbackService: playbackService) { noteId in
                selectedNoteId = noteId
            }
            .environmentObject(repository)
            .frame(minWidth: 520, minHeight: 560)
        }
        .sheet(item: $viewModel.mergeSourceNote) { source in
            NoteMergePickerSheet(source: source, candidates: viewModel.mergeCandidates(excluding: source)) { target in
                viewModel.confirmMerge(source: source, into: target)
            }
        }
        .alert("Meeting Recording", isPresented: Binding(
            get: { meetingRecorder.errorMessage != nil },
            set: { if !$0 { meetingRecorder.errorMessage = nil } }
        )) {
            Button("Open System Settings") {
                if let url = URL(string: "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture") {
                    NSWorkspace.shared.open(url)
                }
            }
            Button("OK", role: .cancel) {}
        } message: {
            Text(meetingRecorder.errorMessage ?? "")
        }
        .frame(minWidth: 760, minHeight: 480)
        .trackFeedbackScreen("NotesBrowser")
        .onChange(of: selectedNoteId) { _, newId in
            #if canImport(FeedbackKit)
            FeedbackKit.currentScreen = (newId != nil) ? "NoteDetail" : "NotesBrowser"
            #endif
        }
    }

    private var sidebar: some View {
        VStack(spacing: 0) {
            if meetingRecorder.isRecording {
                meetingRecordingBanner
            }

            if !viewModel.allTags.isEmpty {
                tagFilterBar
            }

            if viewModel.notes.isEmpty {
                ContentUnavailableView(
                    "No Notes Yet",
                    systemImage: "waveform",
                    description: Text("Press both ⌘ keys anywhere to capture your first note, or start a meeting recording.")
                )
            } else {
                List(selection: $selectedNoteId) {
                    ForEach(viewModel.notes) { note in
                        NoteRowView(note: note)
                            .tag(note.id)
                            .contextMenu { contextMenu(for: note) }
                    }
                }
                .listStyle(.sidebar)
            }
        }
        .navigationTitle("VoxBrief")
        .navigationSplitViewColumnWidth(min: 240, ideal: 300)
        .searchable(text: $viewModel.searchText, prompt: "Search notes, requirements, tags...")
        .toolbar {
            ToolbarItem {
                Button {
                    if meetingRecorder.isRecording {
                        Task {
                            if let noteId = await meetingRecorder.stopAndProcess() {
                                selectedNoteId = noteId
                            }
                        }
                    } else {
                        Task { await meetingRecorder.startMeetingRecording() }
                    }
                } label: {
                    Label(
                        meetingRecorder.isRecording ? "Stop Meeting" : "Record Meeting",
                        systemImage: meetingRecorder.isRecording ? "stop.circle.fill" : "person.2.wave.2"
                    )
                    .foregroundStyle(meetingRecorder.isRecording ? .red : .primary)
                }
                .help(meetingRecorder.isRecording ? "Stop and transcribe meeting" : "Record meeting (Mic + System Audio)")
            }

            ToolbarItem {
                Button {
                    showingAsk = true
                } label: {
                    Label("Ask Voxbrief", systemImage: "sparkles")
                }
                .keyboardShortcut("k", modifiers: .command)
                .help("Ask Voxbrief (⌘K)")
            }

            ToolbarItem {
                Menu {
                    Picker("Source Filter", selection: $viewModel.filterSource) {
                        Text("All Sources").tag(NoteSource?.none)
                        Text("Mac").tag(NoteSource?.some(.macApp))
                        Text("Mac Meeting").tag(NoteSource?.some(.macMeeting))
                        Text("Apple Watch").tag(NoteSource?.some(.watchApp))
                        Text("Watch Complication").tag(NoteSource?.some(.watchComplication))
                        Text("Watch Live Activity").tag(NoteSource?.some(.watchLiveActivity))
                        Text("iPhone Direct").tag(NoteSource?.some(.phoneApp))
                    }

                    Toggle(isOn: $viewModel.onlyFavorites) {
                        Label("Favorites Only", systemImage: "star")
                    }

                    Divider()

                    ShareLink(item: viewModel.exportAllNotesMarkdown()) {
                        Label("Export All Notes", systemImage: "square.and.arrow.up.on.square")
                    }
                } label: {
                    Image(systemName: "line.3.horizontal.decrease.circle")
                }
            }

            ToolbarItem {
                SettingsLink {
                    Image(systemName: "gearshape")
                }
            }
        }
    }

    private var meetingRecordingBanner: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 6) {
                Circle()
                    .fill(meetingRecorder.isPaused ? Color.yellow : Color.red)
                    .frame(width: 8, height: 8)
                Text(meetingRecorder.isPaused ? "Meeting Paused" : "Recording Meeting")
                    .font(.caption.weight(.semibold))
                Spacer()
                Text(meetingRecorder.recordingDuration.formattedDuration)
                    .font(.caption.monospacedDigit().weight(.semibold))
                    .foregroundStyle(.secondary)
            }

            HStack(spacing: 8) {
                meterBar(label: "Mic", level: meetingRecorder.micLevel, color: .accentColor)
                meterBar(label: "Sys", level: meetingRecorder.systemLevel, color: .green)
            }

            HStack(spacing: 8) {
                Button(meetingRecorder.isPaused ? "Resume" : "Pause") {
                    meetingRecorder.togglePause()
                }
                .controlSize(.small)

                Button("Stop & Save") {
                    Task {
                        if let noteId = await meetingRecorder.stopAndProcess() {
                            selectedNoteId = noteId
                        }
                    }
                }
                .controlSize(.small)
                .buttonStyle(.borderedProminent)
                .tint(.red)

                Spacer()

                Button("Cancel") {
                    meetingRecorder.cancelRecording()
                }
                .controlSize(.small)
                .buttonStyle(.borderless)
            }
        }
        .padding(10)
        .background(Color.red.opacity(0.08))
        .overlay(alignment: .bottom) { Divider() }
    }

    private func meterBar(label: String, level: Float, color: Color) -> some View {
        HStack(spacing: 4) {
            Text(label)
                .font(.caption2)
                .foregroundStyle(.secondary)
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(Color.secondary.opacity(0.18))
                    Capsule()
                        .fill(color)
                        .frame(width: max(2, geo.size.width * CGFloat(level)))
                }
            }
            .frame(height: 5)
        }
    }

    @ViewBuilder
    private func contextMenu(for note: VoiceNote) -> some View {
        Button {
            viewModel.toggleFavorite(note: note)
        } label: {
            Label(note.isFavorite ? "Unfavorite" : "Favorite", systemImage: note.isFavorite ? "star.slash" : "star.fill")
        }

        if note.status == .ready {
            Button {
                viewModel.beginMerge(source: note)
            } label: {
                Label("Append To…", systemImage: "arrow.triangle.merge")
            }
        }

        if note.status == .failed {
            Button {
                viewModel.retryProcessing(note: note)
            } label: {
                Label("Retry", systemImage: "arrow.triangle.2.circlepath")
            }
        }

        Divider()

        Button(role: .destructive) {
            if selectedNoteId == note.id {
                selectedNoteId = nil
            }
            viewModel.delete(note: note)
        } label: {
            Label("Delete", systemImage: "trash")
        }
    }

    private var tagFilterBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                filterChip(title: "All", isSelected: viewModel.selectedTag == nil) {
                    viewModel.selectedTag = nil
                }

                ForEach(viewModel.allTags, id: \.self) { tag in
                    filterChip(title: tag, isSelected: viewModel.selectedTag == tag) {
                        viewModel.selectedTag = (viewModel.selectedTag == tag) ? nil : tag
                    }
                }
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 8)
        }
    }

    private func filterChip(title: String, isSelected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(.subheadline.weight(.medium))
                .padding(.horizontal, 12)
                .padding(.vertical, 5)
                .background {
                    Capsule().fill(isSelected ? Color.accentColor : Color.appTertiaryFill)
                }
                .foregroundStyle(isSelected ? .white : .primary)
        }
        .buttonStyle(.plain)
    }
}

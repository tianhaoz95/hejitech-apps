import SwiftUI

public struct NoteDetailView: View {
    @StateObject private var viewModel: NoteDetailViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var copiedField: CopyField?
    @State private var showingAddRecording = false
    @State private var showingRemindersAlert = false
    @State private var remindersExportMessage = ""
    @State private var showingCalendarAlert = false
    @State private var calendarExportMessage = ""
    @State private var showingAddTagAlert = false
    @State private var newTagText = ""
    @State private var showingCopiedNotification = false
    @State private var copiedNotificationText = ""
    @State private var transcriptSearchText = ""
    @State private var showingAppendSheet = false
    @State private var appendMemoText = ""
    @State private var appendMemoTitle = ""
    @State private var isScrubbing = false
    @State private var scrubbedTime: TimeInterval = 0
    @State private var isUnlocked: Bool = false
    @Environment(\.scenePhase) private var scenePhase

    private enum CopyField: Equatable {
        case fullRewrite, lightCleanup, rawTranscript
    }

    /// `repository`/`pipeline`/`playbackService` default to the iOS app's `.shared` singletons.
    /// `VoxbriefMac`'s Notes browser passes its own instances explicitly instead (see
    /// `NotesBrowserView`), since the Mac app's note history and audio storage are intentionally
    /// separate from those singletons' default locations.
    public init(
        note: VoiceNote,
        initialTab: NoteDetailViewModel.DetailTab = .cleanedNote,
        repository: NoteRepository = .shared,
        pipeline: NoteProcessingPipeline = .shared,
        playbackService: AudioPlaybackService = .shared
    ) {
        _viewModel = StateObject(wrappedValue: NoteDetailViewModel(
            note: note,
            initialTab: initialTab,
            repository: repository,
            pipeline: pipeline,
            playbackService: playbackService
        ))
    }

    public var body: some View {
        ZStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    header

                if viewModel.note.status == .failed {
                    failureBanner
                }

                if viewModel.usedFallbackCleanup {
                    fallbackCleanupBanner
                }

                if viewModel.note.segments.count > 1 {
                    recordingsSection
                } else if viewModel.hasAudio {
                    audioPlayerCard
                }

                Picker("View Mode", selection: $viewModel.selectedTab) {
                    ForEach(NoteDetailViewModel.DetailTab.visible) { tab in
                        Image(systemName: tab.iconName)
                            .accessibilityLabel(tab.rawValue)
                            .tag(tab)
                    }
                }
                .pickerStyle(.segmented)

                switch viewModel.selectedTab {
                case .cleanedNote:
                    cleanedNoteSection
                case .lightCleanup:
                    lightCleanupSection
                case .rawTranscript:
                    rawTranscriptSection
                case .pipeline:
                    pipelineSection
                }

                metadataFooter
            }
            .padding()
        }
        .background(AppPageBackground())
        .navigationTitle("")
        #if os(iOS)
        .navigationBarTitleDisplayMode(.inline)
        #endif
        .toolbar {
            ToolbarItemGroup(placement: .primaryAction) {
                Button {
                    showingAddRecording = true
                } label: {
                    Image(systemName: "waveform.badge.plus")
                }
                .disabled(viewModel.note.status.isProcessing)
                .accessibilityLabel("Add Recording")

                Button {
                    viewModel.toggleFavorite()
                } label: {
                    Image(systemName: viewModel.note.isFavorite ? "star.fill" : "star")
                        .foregroundStyle(viewModel.note.isFavorite ? .yellow : .primary)
                }

                ShareLink(item: viewModel.note.cleanedNote) {
                    Image(systemName: "square.and.arrow.up")
                }

                Menu {
                    Section("Actions") {
                        Button {
                            viewModel.beginEditing()
                        } label: {
                            Label("Edit Note", systemImage: "pencil")
                        }

                        Button {
                            viewModel.togglePinned()
                        } label: {
                            Label(viewModel.note.isPinned ? "Unpin Note" : "Pin Note", systemImage: viewModel.note.isPinned ? "pin.slash" : "pin")
                        }

                        Button {
                            viewModel.toggleArchived()
                        } label: {
                            Label(viewModel.note.isArchived ? "Unarchive Note" : "Archive Note", systemImage: viewModel.note.isArchived ? "tray.and.arrow.up" : "archivebox")
                        }

                        Button {
                            viewModel.toggleLocked()
                        } label: {
                            Label(viewModel.note.isLocked ? "Unlock Note" : "Lock Note (Privacy Shield)", systemImage: viewModel.note.isLocked ? "lock.open" : "lock")
                        }
                    }

                    Section("Color Accent") {
                        Menu("Color Category") {
                            Button("None") { viewModel.setColorTag(nil) }
                            Button("Blue") { viewModel.setColorTag("blue") }
                            Button("Purple") { viewModel.setColorTag("purple") }
                            Button("Green") { viewModel.setColorTag("green") }
                            Button("Orange") { viewModel.setColorTag("orange") }
                            Button("Pink") { viewModel.setColorTag("pink") }
                            Button("Teal") { viewModel.setColorTag("teal") }
                            Button("Red") { viewModel.setColorTag("red") }
                        }
                    }

                    Section("Copy") {
                        Button {
                            #if os(iOS)
                            UIPasteboard.general.string = viewModel.note.cleanedNote
                            #elseif os(macOS)
                            NSPasteboard.general.clearContents()
                            NSPasteboard.general.setString(viewModel.note.cleanedNote, forType: .string)
                            #endif
                        } label: {
                            Label("Copy Full Note", systemImage: "doc.on.doc")
                        }

                        if !viewModel.note.summary.isEmpty {
                            Button {
                                #if os(iOS)
                                UIPasteboard.general.string = viewModel.note.summary
                                #elseif os(macOS)
                                NSPasteboard.general.clearContents()
                                NSPasteboard.general.setString(viewModel.note.summary, forType: .string)
                                #endif
                            } label: {
                                Label("Copy Summary Only", systemImage: "text.quote")
                            }
                        }

                        if !viewModel.note.actionItems.isEmpty {
                            Button {
                                let actions = NoteExportService.shared.extractActionItems(for: viewModel.note)
                                #if os(iOS)
                                UIPasteboard.general.string = actions
                                #elseif os(macOS)
                                NSPasteboard.general.clearContents()
                                NSPasteboard.general.setString(actions, forType: .string)
                                #endif
                            } label: {
                                Label("Copy Action Items", systemImage: "checklist")
                            }
                        }

                        if !viewModel.note.rawTranscript.isEmpty {
                            Button {
                                #if os(iOS)
                                UIPasteboard.general.string = viewModel.note.rawTranscript
                                #elseif os(macOS)
                                NSPasteboard.general.clearContents()
                                NSPasteboard.general.setString(viewModel.note.rawTranscript, forType: .string)
                                #endif
                            } label: {
                                Label("Copy Verbatim Transcript", systemImage: "waveform")
                            }
                        }
                    }

                    Section("Export") {
                        if let fileURL = viewModel.markdownShareFileURL {
                            ShareLink(item: fileURL) {
                                Label("Share Markdown File (.md)", systemImage: "doc.text")
                            }
                        }

                        if let txtURL = viewModel.plainTextShareFileURL {
                            ShareLink(item: txtURL) {
                                Label("Share Plain Text (.txt)", systemImage: "doc.plaintext")
                            }
                        }

                        if let htmlURL = viewModel.htmlShareFileURL {
                            ShareLink(item: htmlURL) {
                                Label("Share HTML Document (.html)", systemImage: "safari")
                            }
                        }

                        if let pdfURL = viewModel.pdfShareFileURL {
                            ShareLink(item: pdfURL) {
                                Label("Share PDF Document (.pdf)", systemImage: "doc.richtext")
                            }
                        }

                        if let audioURL = viewModel.audioFileURL {
                            ShareLink(item: audioURL) {
                                Label("Share Audio File (.m4a)", systemImage: "waveform")
                            }
                        }

                        Button {
                            viewModel.copyRichText()
                            copiedNotificationText = "Copied Formatted Note"
                            showingCopiedNotification = true
                        } label: {
                            Label("Copy Formatted Rich Text", systemImage: "doc.on.clipboard")
                        }

                        if !viewModel.note.actionItems.isEmpty {
                            Button {
                                Task {
                                    do {
                                        let count = try await viewModel.exportActionItemsToReminders()
                                        remindersExportMessage = "Successfully exported \(count) action items to Apple Reminders."
                                        showingRemindersAlert = true
                                    } catch {
                                        remindersExportMessage = error.localizedDescription
                                        showingRemindersAlert = true
                                    }
                                }
                            } label: {
                                Label("Export to Apple Reminders", systemImage: "checklist")
                            }
                        }

                        Button {
                            Task {
                                do {
                                    try await viewModel.exportToCalendar()
                                    calendarExportMessage = "Successfully added note to Apple Calendar."
                                    showingCalendarAlert = true
                                } catch {
                                    calendarExportMessage = error.localizedDescription
                                    showingCalendarAlert = true
                                }
                            }
                        } label: {
                            Label("Add to Apple Calendar", systemImage: "calendar.badge.plus")
                        }
                    }

                    Section("Actions") {
                        Button {
                            appendMemoText = ""
                            appendMemoTitle = ""
                            showingAppendSheet = true
                        } label: {
                            Label("Append Text Memo…", systemImage: "note.text.badge.plus")
                        }

                        Button {
                            viewModel.reprocessNote()
                        } label: {
                            Label("Re-run LLM Cleanup", systemImage: "sparkles")
                        }
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                }
            }
        }
        .alert("Couldn't Change Template", isPresented: Binding(
            get: { viewModel.templateChangeError != nil },
            set: { if !$0 { viewModel.templateChangeError = nil } }
        )) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(viewModel.templateChangeError ?? "")
        }
        .alert("Apple Reminders", isPresented: $showingRemindersAlert) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(remindersExportMessage)
        }
        .alert("Apple Calendar", isPresented: $showingCalendarAlert) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(calendarExportMessage)
        }
        .alert("Add Tag", isPresented: $showingAddTagAlert) {
            TextField("#tag", text: $newTagText)
            Button("Add") {
                let trimmed = newTagText.trimmingCharacters(in: .whitespacesAndNewlines)
                if !trimmed.isEmpty {
                    viewModel.addTag(trimmed)
                    newTagText = ""
                }
            }
            Button("Cancel", role: .cancel) {
                newTagText = ""
            }
        }
        .sheet(isPresented: $viewModel.isEditing) {
            editSheet
        }
        .sheet(isPresented: $showingAddRecording) {
            #if os(iOS)
            QuickRecordSheet(appendingToNoteId: viewModel.note.id) {}
            #elseif os(macOS)
            MacAddRecordingSheet(noteId: viewModel.note.id)
            #endif
        }
        .sheet(isPresented: $showingAppendSheet) {
            NavigationStack {
                Form {
                    Section("Memo Title (Optional)") {
                        TextField("e.g. Follow-up Notes", text: $appendMemoTitle)
                    }
                    Section("Memo Content") {
                        TextEditor(text: $appendMemoText)
                            .frame(minHeight: 140)
                    }
                }
                .navigationTitle("Append to Note")
                #if os(iOS)
                .navigationBarTitleDisplayMode(.inline)
                #endif
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Cancel") {
                            showingAppendSheet = false
                        }
                    }
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Append") {
                            viewModel.appendContent(text: appendMemoText, title: appendMemoTitle)
                            showingAppendSheet = false
                        }
                        .disabled(appendMemoText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    }
                }
            }
            #if os(iOS)
            .presentationDetents([.medium, .large])
            .presentationDragIndicator(.visible)
            #endif
        }
            .blur(radius: (viewModel.note.isLocked && !isUnlocked) ? 20 : 0)
            .allowsHitTesting(!viewModel.note.isLocked || isUnlocked)

            if viewModel.note.isLocked && !isUnlocked {
                privacyShieldOverlay
            }
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .background {
                isUnlocked = false
            }
        }
        .trackFeedbackScreen("NoteDetail")
        .onAppear {
            if viewModel.selectedTab == .lightCleanup {
                viewModel.ensureLightCleanupGenerated()
            }
        }
        .onChange(of: viewModel.selectedTab) { _, newTab in
            if newTab == .lightCleanup {
                viewModel.ensureLightCleanupGenerated()
            }
        }
    }

    private var privacyShieldOverlay: some View {
        VStack(spacing: 16) {
            ZStack {
                Circle()
                    .fill(Color.secondary.opacity(0.12))
                    .frame(width: 76, height: 76)
                Image(systemName: "lock.shield.fill")
                    .font(.system(size: 38))
                    .foregroundColor(Color.accentColor)
            }

            Text("Protected Voice Note")
                .font(.title3.bold())

            Text("This note is protected with biometric authentication.")
                .font(.subheadline)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)

            Button {
                Task {
                    let success = await BiometricAuthService.shared.authenticate(reason: "Unlock protected note")
                    if success {
                        withAnimation(.easeInOut(duration: 0.25)) {
                            isUnlocked = true
                        }
                    }
                }
            } label: {
                HStack(spacing: 8) {
                    Image(systemName: BiometricAuthService.shared.biometricType == .faceID ? "faceid" : "touchid")
                        .font(.headline)
                    Text("Unlock Note")
                        .fontWeight(.semibold)
                }
                .padding(.horizontal, 22)
                .padding(.vertical, 10)
                .background(Color.accentColor)
                .foregroundColor(.white)
                .clipShape(Capsule())
            }
            .buttonStyle(.plain)
            .padding(.top, 6)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.appGroupedBackground.opacity(0.92))
    }

    // MARK: - Header

    private var header: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 6) {
                if let colorName = viewModel.note.colorTag, let color = colorForName(colorName) {
                    Circle()
                        .fill(color)
                        .frame(width: 8, height: 8)
                }

                if viewModel.note.isPinned {
                    Image(systemName: "pin.fill")
                        .font(.caption2)
                        .foregroundStyle(Color.accentColor)
                }

                if viewModel.note.isLocked {
                    Image(systemName: "lock.fill")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }

                Label(viewModel.note.source.displayName, systemImage: viewModel.note.source.iconName)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)

                if viewModel.note.duration > 0 {
                    Text("·")
                        .font(.caption)
                        .foregroundStyle(.tertiary)
                    Text(viewModel.note.duration.formattedDuration)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Spacer()

                Text(viewModel.note.createdAt.relativeOrFormattedString)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Text(viewModel.note.title)
                .font(.title2.bold())
                .foregroundStyle(.primary)

            templateMenu

            // Reading stats & action items progress pill row
            HStack(spacing: 10) {
                Label("\(viewModel.note.wordCount) words", systemImage: "doc.text")
                    .font(.caption2)
                    .foregroundStyle(.secondary)

                Text("·")
                    .font(.caption2)
                    .foregroundStyle(.tertiary)

                Label(viewModel.note.formattedReadingTime, systemImage: "clock")
                    .font(.caption2)
                    .foregroundStyle(.secondary)

                if !viewModel.note.actionItems.isEmpty {
                    let progress = viewModel.note.actionItemsProgress
                    Text("·")
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                    Label("\(progress.completed)/\(progress.total) tasks done", systemImage: "checklist")
                        .font(.caption2)
                        .foregroundStyle(progress.completed == progress.total ? .green : .secondary)
                }
            }

            if !viewModel.note.summary.isEmpty {
                Text(viewModel.note.summary)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            // Tags row with interactive remove and add tag button
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 6) {
                    ForEach(viewModel.note.tags, id: \.self) { tag in
                        HStack(spacing: 4) {
                            Text(tag)
                            Button {
                                viewModel.removeTag(tag)
                            } label: {
                                Image(systemName: "xmark")
                                    .font(.system(size: 8, weight: .bold))
                            }
                            .buttonStyle(.plain)
                        }
                        .font(.caption.weight(.medium))
                        .padding(.horizontal, 10)
                        .padding(.vertical, 5)
                        .background(Color.appTertiaryFill, in: Capsule())
                        .foregroundStyle(.secondary)
                    }

                    Button {
                        showingAddTagAlert = true
                    } label: {
                        Label("Add Tag", systemImage: "plus")
                            .font(.caption.weight(.medium))
                            .padding(.horizontal, 10)
                            .padding(.vertical, 5)
                            .background(Color.accentColor.opacity(0.12), in: Capsule())
                            .foregroundStyle(Color.accentColor)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.top, 2)
        }
    }

    /// The note's template, as a chip: picking another (or Auto-detect) regenerates the note
    /// from its transcript.
    private var templateMenu: some View {
        Menu {
            Section("Regenerate As") {
                Button {
                    viewModel.changeTemplate(to: nil)
                } label: {
                    Label("Auto-detect", systemImage: "sparkles")
                }

                ForEach(viewModel.templateChoices) { template in
                    Button {
                        viewModel.changeTemplate(to: template)
                    } label: {
                        if template.id == viewModel.note.templateId {
                            Label(template.name, systemImage: "checkmark")
                        } else {
                            Text(template.name)
                        }
                    }
                }
            }
        } label: {
            HStack(spacing: 5) {
                if viewModel.isReprocessing {
                    ProgressView()
                        .controlSize(.mini)
                } else {
                    Image(systemName: "rectangle.3.group")
                }
                Text(viewModel.isReprocessing ? "Regenerating…" : viewModel.templateLabel)
                Image(systemName: "chevron.down")
                    .font(.system(size: 8, weight: .bold))
            }
            .font(.caption.weight(.medium))
            .padding(.horizontal, 10)
            .padding(.vertical, 5)
            .background(Color.accentColor.opacity(0.12), in: Capsule())
            .foregroundStyle(Color.accentColor)
        }
        .menuStyle(.button)
        .buttonStyle(.plain)
        .menuIndicator(.hidden)
        .fixedSize()
        .disabled(!viewModel.canChangeTemplate)
        .accessibilityLabel("Template: \(viewModel.templateLabel)")
    }

    private func colorForName(_ name: String) -> Color? {
        switch name.lowercased() {
        case "blue": return .blue
        case "purple": return .purple
        case "green": return .green
        case "orange": return .orange
        case "pink": return .pink
        case "teal": return .teal
        case "red": return .red
        default: return nil
        }
    }

    // MARK: - Failure Banner

    private var failureBanner: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(.red)

            VStack(alignment: .leading, spacing: 6) {
                Text(viewModel.note.errorMessage ?? "Processing failed.")
                    .font(.subheadline)
                    .foregroundStyle(.primary)

                if viewModel.isReprocessing {
                    HStack(spacing: 6) {
                        ProgressView()
                            .scaleEffect(0.7)
                        Text("Retrying…")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                } else {
                    Button("Retry") {
                        viewModel.retry()
                    }
                    .font(.caption.weight(.semibold))
                }
            }

            Spacer(minLength: 0)
        }
        .padding(14)
        .background(Color.red.opacity(0.1), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    // MARK: - Fallback Cleanup Banner

    private var fallbackCleanupBanner: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: "exclamationmark.circle.fill")
                .foregroundStyle(.orange)

            VStack(alignment: .leading, spacing: 6) {
                Text("Basic cleanup only — the AI engine wasn't available when this note was made, so a simpler rule-based pass formatted it instead.")
                    .font(.subheadline)
                    .foregroundStyle(.primary)

                if viewModel.isReprocessing {
                    HStack(spacing: 6) {
                        ProgressView()
                            .scaleEffect(0.7)
                        Text("Retrying…")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                } else {
                    Button("Try the AI Engine Again") {
                        viewModel.reprocessNote()
                    }
                    .font(.caption.weight(.semibold))
                }
            }

            Spacer(minLength: 0)
        }
        .padding(14)
        .background(Color.orange.opacity(0.1), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    // MARK: - Edit Sheet

    private var editSheet: some View {
        NavigationStack {
            Form {
                Section(header: Text("Title")) {
                    TextField("Note title", text: $viewModel.editedTitle)
                }

                Section(header: Text("Cleaned Note (Markdown)")) {
                    TextEditor(text: $viewModel.editedCleanedNote)
                        .frame(minHeight: 300)
                        .font(.body.monospaced())
                }
            }
            .navigationTitle("Edit Note")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        viewModel.cancelEditing()
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        viewModel.saveEdits()
                    }
                    .fontWeight(.semibold)
                }
            }
        }
    }

    // MARK: - Audio Player Card

    private var audioPlayerCard: some View {
        let playback = viewModel.playbackService
        let isCurrentTrack = playback.currentlyPlayingFileName == viewModel.note.audioFileName
        let isPlaying = playback.isPlaying && isCurrentTrack

        return HStack(spacing: 10) {
            VStack(spacing: 3) {
                Button {
                    viewModel.skipBackward()
                } label: {
                    Image(systemName: "gobackward.15")
                        .font(.system(size: 17))
                        .foregroundStyle(.secondary)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Skip backward 15 seconds")

                Button {
                    viewModel.playbackService.skipBackward(seconds: 5)
                } label: {
                    Text("-5s")
                        .font(.system(size: 9, weight: .bold))
                        .foregroundStyle(.secondary)
                        .padding(.horizontal, 4)
                        .padding(.vertical, 1)
                        .background(Color.appTertiaryFill, in: Capsule())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Skip backward 5 seconds")
            }

            Button {
                viewModel.togglePlayback()
            } label: {
                Image(systemName: isPlaying ? "pause.circle.fill" : "play.circle.fill")
                    .font(.system(size: 38))
                    .foregroundStyle(Color.accentColor)
            }
            .buttonStyle(.plain)

            VStack(spacing: 3) {
                Button {
                    viewModel.skipForward()
                } label: {
                    Image(systemName: "goforward.15")
                        .font(.system(size: 17))
                        .foregroundStyle(.secondary)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Skip forward 15 seconds")

                Button {
                    viewModel.playbackService.skipForward(seconds: 5)
                } label: {
                    Text("+5s")
                        .font(.system(size: 9, weight: .bold))
                        .foregroundStyle(.secondary)
                        .padding(.horizontal, 4)
                        .padding(.vertical, 1)
                        .background(Color.appTertiaryFill, in: Capsule())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Skip forward 5 seconds")
            }

            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 8) {
                    Text(isScrubbing ? scrubbedTime.formattedDuration : (isCurrentTrack ? playback.currentTime.formattedDuration : "00:00"))
                        .font(.caption.monospacedDigit())
                        .foregroundStyle(isScrubbing ? Color.accentColor : .primary)
                    Spacer()
                    Button {
                        viewModel.cyclePlaybackRate()
                    } label: {
                        Text(playback.playbackRate == 1.0 ? "1x" : String(format: "%.2gx", playback.playbackRate))
                            .font(.caption2.bold())
                            .foregroundStyle(Color.accentColor)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color.appTertiaryFill, in: Capsule())
                    }
                    .buttonStyle(.plain)

                    Button {
                        viewModel.toggleLooping()
                    } label: {
                        Image(systemName: playback.isLooping ? "repeat.1" : "repeat")
                            .font(.caption2.bold())
                            .foregroundStyle(playback.isLooping ? Color.accentColor : .secondary)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(playback.isLooping ? Color.accentColor.opacity(0.15) : Color.appTertiaryFill, in: Capsule())
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(playback.isLooping ? "Disable loop" : "Enable loop")

                    Button {
                        playback.toggleTrimSilence()
                    } label: {
                        Image(systemName: playback.trimSilence ? "waveform.badge.minus" : "waveform")
                            .font(.caption2.bold())
                            .foregroundStyle(playback.trimSilence ? Color.accentColor : .secondary)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(playback.trimSilence ? Color.accentColor.opacity(0.15) : Color.appTertiaryFill, in: Capsule())
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(playback.trimSilence ? "Disable silence trimming" : "Enable silence trimming")

                    Text(viewModel.note.duration.formattedDuration)
                        .font(.caption.monospacedDigit())
                        .foregroundStyle(.secondary)
                }

                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        Capsule()
                            .fill(Color.appTertiaryFill)
                            .frame(height: 4)

                        let progress = isCurrentTrack && playback.duration > 0 ? (playback.currentTime / playback.duration) : 0.0
                        Capsule()
                            .fill(Color.accentColor)
                            .frame(width: geo.size.width * CGFloat(progress), height: 4)
                    }
                    .contentShape(Rectangle())
                    .frame(maxHeight: .infinity)
                    .gesture(
                        DragGesture(minimumDistance: 0)
                            .onChanged { value in
                                guard geo.size.width > 0 else { return }
                                let progress = min(max(0, value.location.x / geo.size.width), 1)
                                isScrubbing = true
                                scrubbedTime = Double(progress) * (playback.duration > 0 ? playback.duration : viewModel.note.duration)
                                viewModel.seek(to: Double(progress))
                            }
                            .onEnded { _ in
                                isScrubbing = false
                            }
                    )
                }
                .frame(height: 20)
            }
        }
        .padding(14)
        .background(Color.appSecondaryBackground, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    // MARK: - Recordings Section (multi-segment notes)

    /// Shown instead of `audioPlayerCard` once a note has more than one recording folded into it
    /// (see "Add Recording" and "Append To…"), so each take stays individually playable rather
    /// than only exposing whichever one happens to be `note.audioFileName` (the latest).
    private var recordingsSection: some View {
        let playback = viewModel.playbackService
        let sortedSegments = viewModel.note.segments.sorted(by: { $0.createdAt < $1.createdAt })

        return VStack(alignment: .leading, spacing: 12) {
            sectionHeader(icon: "mic", tint: .accentColor, title: "Recordings (\(sortedSegments.count))")

            VStack(spacing: 10) {
                ForEach(sortedSegments) { segment in
                    let isCurrentTrack = playback.currentlyPlayingFileName == segment.audioFileName
                    let isPlaying = playback.isPlaying && isCurrentTrack

                    HStack(spacing: 12) {
                        Button {
                            viewModel.togglePlayback(fileName: segment.audioFileName)
                        } label: {
                            Image(systemName: isPlaying ? "pause.circle.fill" : "play.circle.fill")
                                .font(.system(size: 28))
                                .foregroundStyle(Color.accentColor)
                        }
                        .buttonStyle(.plain)

                        VStack(alignment: .leading, spacing: 2) {
                            Text(segment.createdAt.relativeOrFormattedString)
                                .font(.subheadline)
                                .foregroundStyle(.primary)
                            Text(segment.duration.formattedDuration)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }

                        Spacer(minLength: 0)
                    }
                }
            }
        }
        .padding(16)
        .background(Color.appSecondaryBackground, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    // MARK: - Cleaned Note Section

    private var cleanedNoteSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            if !viewModel.note.longMemoParts.isEmpty {
                longMemoPartsCard
            }

            ForEach(Array(viewModel.note.effectiveTemplateSections.enumerated()), id: \.offset) { _, section in
                infoCard(
                    icon: icon(for: section.style),
                    tint: tint(for: section.style),
                    title: section.title,
                    items: section.items,
                    marker: marker(for: section.style)
                )
            }

            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    sectionHeader(icon: "doc.plaintext", tint: .accentColor, title: "Formatted Note")
                    Spacer()
                    if let engine = viewModel.note.cleanupEngine, engine != CleanupEngineLabel.notApplicable {
                        Text(CleanupEngineLabel.displayName(for: engine))
                            .font(.caption2.weight(.medium))
                            .foregroundStyle(.secondary)
                    }
                    copyButton(text: viewModel.note.cleanedNote, field: .fullRewrite)
                }

                MarkdownLiteText(viewModel.note.cleanedNote) { lineIndex in
                    viewModel.toggleChecklistAt(lineIndex: lineIndex)
                }
                    .foregroundStyle(.primary)
            }
            .padding(16)
            .background(Color.appSecondaryBackground, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        }
    }

    /// Shown when Stage 2 read a long memo in parts (`VoiceNote.longMemoParts`): says so, and
    /// lists each part's start time and summary. Tapping a part seeks the audio there, for a
    /// single-recording note (a multi-recording note's parts span several files).
    private var longMemoPartsCard: some View {
        let parts = viewModel.note.longMemoParts
        let canSeek = viewModel.hasAudio && viewModel.note.segments.count <= 1
        return VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top, spacing: 10) {
                Image(systemName: "doc.on.doc")
                    .foregroundStyle(Color.accentColor)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Long memo, read in \(parts.count) parts")
                        .font(.subheadline.weight(.semibold))
                    Text("Each part was summarized on its own, then merged, so nothing past the first few minutes is dropped.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }

            ForEach(Array(parts.enumerated()), id: \.offset) { _, part in
                let time = part.startFraction * viewModel.note.duration
                Button {
                    viewModel.seek(toTime: time)
                } label: {
                    HStack(alignment: .firstTextBaseline, spacing: 12) {
                        Text(time.formattedDuration)
                            .font(.subheadline.weight(.semibold).monospacedDigit())
                            .foregroundStyle(canSeek ? Color.accentColor : .secondary)
                            .frame(minWidth: 44, alignment: .leading)
                        Text(part.summary.isEmpty ? "Part summary unavailable" : part.summary)
                            .font(.subheadline)
                            .foregroundStyle(.primary)
                            .multilineTextAlignment(.leading)
                        Spacer(minLength: 0)
                    }
                }
                .buttonStyle(.plain)
                .disabled(!canSeek)
            }
        }
        .padding(16)
        .background(Color.accentColor.opacity(0.08), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    // MARK: - Light Cleanup Section

    private var lightCleanupSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                sectionHeader(icon: "wand.and.stars", tint: .blue, title: "Light Cleanup")
                Spacer()
                if let engine = viewModel.note.lightCleanupEngine, engine != CleanupEngineLabel.notApplicable {
                    Text(CleanupEngineLabel.displayName(for: engine))
                        .font(.caption2.weight(.medium))
                        .foregroundStyle(.secondary)
                }
                copyButton(text: viewModel.note.lightCleanedNote ?? "", field: .lightCleanup)
            }

            Text("Typos, grammar, and filler words fixed -- original wording and order kept, nothing restructured.")
                .font(.caption)
                .foregroundStyle(.secondary)

            if let lightNote = viewModel.note.lightCleanedNote, !lightNote.isEmpty {
                MarkdownLiteText(lightNote)
                    .foregroundStyle(.primary)
            } else if viewModel.isGeneratingLightCleanup {
                HStack(spacing: 8) {
                    ProgressView()
                        .controlSize(.small)
                    Text("Generating light cleanup…")
                        .font(.body)
                        .foregroundStyle(.secondary)
                }
            } else if viewModel.note.status == .ready {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Light cleanup hasn't been generated for this note yet.")
                        .font(.body)
                        .foregroundStyle(.secondary)
                    Button("Generate Light Cleanup") {
                        viewModel.ensureLightCleanupGenerated()
                    }
                    .font(.subheadline.weight(.semibold))
                }
            } else {
                Text("Light cleanup will be available once this note finishes processing.")
                    .font(.body)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(16)
        .background(Color.appSecondaryBackground, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    private enum ItemMarker {
        case bullet, number, checkbox, plain
    }

    /// Maps a `TemplateSectionStyle` (from `viewModel.note.effectiveTemplateSections`) to this
    /// view's own icon/tint/marker scheme -- kept as a separate small mapping rather than storing
    /// icon/tint/marker directly on `TemplateSectionContent`, since those are presentation
    /// concerns specific to this one view, not part of what Stage 2 actually generates. The
    /// Design Doc template's three sections map to exactly the icons/tints/markers this view used
    /// before multi-template support existed, so its visual output is unchanged.
    private func icon(for style: TemplateSectionStyle) -> String {
        switch style {
        case .bullet: return "target"
        case .numbered: return "list.number"
        case .checklist: return "checkmark"
        case .paragraph: return "text.alignleft"
        }
    }

    private func tint(for style: TemplateSectionStyle) -> Color {
        switch style {
        case .bullet: return .purple
        case .numbered: return .orange
        case .checklist: return .green
        case .paragraph: return .blue
        }
    }

    private func marker(for style: TemplateSectionStyle) -> ItemMarker {
        switch style {
        case .bullet: return .bullet
        case .numbered: return .number
        case .checklist: return .checkbox
        case .paragraph: return .plain
        }
    }

    private func copyButton(text: String, field: CopyField) -> some View {
        Button {
            PlatformPasteboard.copy(text)
            withAnimation(.easeInOut(duration: 0.15)) {
                copiedField = field
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
                if copiedField == field {
                    withAnimation(.easeInOut(duration: 0.15)) {
                        copiedField = nil
                    }
                }
            }
        } label: {
            Image(systemName: copiedField == field ? "checkmark" : "doc.on.doc")
                .font(.caption)
                .foregroundStyle(copiedField == field ? Color.green : Color.secondary)
        }
        .buttonStyle(.plain)
        .disabled(text.isEmpty)
        .accessibilityLabel("Copy")
    }

    private func sectionHeader(icon: String, tint: Color, title: String) -> some View {
        HStack(spacing: 8) {
            ZStack {
                Circle()
                    .fill(tint)
                    .frame(width: 22, height: 22)
                Image(systemName: icon)
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(.white)
            }
            Text(title)
                .font(.subheadline.weight(.semibold))
        }
    }

    private func infoCard(icon: String, tint: Color, title: String, items: [String], marker: ItemMarker) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            sectionHeader(icon: icon, tint: tint, title: title)

            VStack(alignment: .leading, spacing: 10) {
                ForEach(Array(items.enumerated()), id: \.offset) { index, item in
                    if marker == .checkbox {
                        let isDone = viewModel.isActionItemCompleted(item)
                        HStack(alignment: .top, spacing: 8) {
                            Button {
                                #if os(iOS)
                                UIImpactFeedbackGenerator(style: .light).impactOccurred()
                                #endif
                                withAnimation(.easeInOut(duration: 0.2)) {
                                    viewModel.toggleActionItem(item)
                                }
                            } label: {
                                HStack(alignment: .top, spacing: 10) {
                                    Image(systemName: isDone ? "checkmark.square.fill" : "square")
                                        .font(.system(size: 16))
                                        .foregroundStyle(isDone ? Color.secondary : tint)
                                        .padding(.top, 1)

                                    Text(item)
                                        .font(.body)
                                        .strikethrough(isDone, color: .secondary)
                                        .foregroundStyle(isDone ? .secondary : .primary)
                                        .fixedSize(horizontal: false, vertical: true)
                                        .multilineTextAlignment(.leading)
                                }
                            }
                            .buttonStyle(.plain)

                            Spacer(minLength: 4)

                            let priority = viewModel.note.priority(for: item)
                            Button {
                                withAnimation(.easeInOut(duration: 0.15)) {
                                    viewModel.cycleActionItemPriority(item: item)
                                }
                            } label: {
                                Text(priorityLabel(priority))
                                    .font(.system(size: 9, weight: .bold))
                                    .padding(.horizontal, 6)
                                    .padding(.vertical, 2)
                                    .background(priorityBackground(priority), in: Capsule())
                                    .foregroundStyle(priorityForeground(priority))
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel("Change priority")
                        }
                    } else {
                        HStack(alignment: .top, spacing: 10) {
                            markerView(marker, index: index, tint: tint)
                            Text(item)
                                .font(.body)
                                .foregroundStyle(.primary)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                }
            }
        }
        .padding(16)
        .background(Color.appSecondaryBackground, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    @ViewBuilder
    private func markerView(_ marker: ItemMarker, index: Int, tint: Color) -> some View {
        switch marker {
        case .bullet:
            Circle()
                .fill(tint)
                .frame(width: 5, height: 5)
                .padding(.top, 7)
        case .number:
            Text("\(index + 1)")
                .font(.caption.weight(.bold))
                .foregroundStyle(tint)
                .frame(width: 16, alignment: .leading)
                .padding(.top, 2)
        case .checkbox:
            Image(systemName: "square")
                .font(.system(size: 15))
                .foregroundStyle(tint)
                .padding(.top, 1)
        case .plain:
            EmptyView()
        }
    }

    private func priorityLabel(_ priority: String?) -> String {
        switch priority {
        case "high": return "HIGH"
        case "medium": return "MED"
        case "low": return "LOW"
        default: return "PRIORITY"
        }
    }

    private func priorityBackground(_ priority: String?) -> Color {
        switch priority {
        case "high": return Color.red.opacity(0.18)
        case "medium": return Color.orange.opacity(0.18)
        case "low": return Color.blue.opacity(0.18)
        default: return Color.appTertiaryFill
        }
    }

    private func priorityForeground(_ priority: String?) -> Color {
        switch priority {
        case "high": return Color.red
        case "medium": return Color.orange
        case "low": return Color.blue
        default: return Color.secondary
        }
    }

    // MARK: - Raw Transcript Section

    private var rawTranscriptSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                sectionHeader(icon: "waveform", tint: .secondary, title: "Verbatim ASR Output")
                Spacer()
                copyButton(text: viewModel.note.rawTranscript, field: .rawTranscript)
            }

            // In-transcript keyword search
            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                TextField("Search transcript...", text: $transcriptSearchText)
                    .font(.subheadline)
                    .autocorrectionDisabled()
                if !transcriptSearchText.isEmpty {
                    Button {
                        transcriptSearchText = ""
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(Color.appTertiaryFill, in: RoundedRectangle(cornerRadius: 10, style: .continuous))

            let query = transcriptSearchText.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()

            if !viewModel.note.transcriptSegments.isEmpty {
                let matching = query.isEmpty ? viewModel.note.transcriptSegments : viewModel.note.transcriptSegments.filter { $0.displayText.lowercased().contains(query) }

                if !query.isEmpty {
                    Text("\(matching.count) matches found")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }

                if matching.isEmpty {
                    Text("No matching speech segments found.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .padding(.vertical, 8)
                } else {
                    VStack(alignment: .leading, spacing: 10) {
                        ForEach(matching) { segment in
                            Button {
                                viewModel.seek(toTime: segment.start)
                            } label: {
                                HStack(alignment: .top, spacing: 10) {
                                    Text(segment.formattedRange)
                                        .font(.caption.monospacedDigit())
                                        .foregroundStyle(Color.accentColor)
                                        .padding(.horizontal, 6)
                                        .padding(.vertical, 3)
                                        .background(Color.accentColor.opacity(0.12), in: Capsule())

                                    TranscriptSegmentText(segment: segment)
                                        .frame(maxWidth: .infinity, alignment: .leading)
                                }
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            } else {
                Text(viewModel.note.rawTranscript.isEmpty ? "No raw transcript available." : viewModel.note.rawTranscript)
                    .font(.body)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(16)
        .background(Color.appSecondaryBackground, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    // MARK: - 2-Stage Pipeline Diagnostics Section

    private enum PipelineStepState {
        case pending, active, done
    }

    /// Stage 1 only ever runs during a full retry (`retryFullProcessing`) -- a plain Stage-2-only
    /// reprocess (`reprocessNote`) starts from an existing transcript and never revisits ASR.
    private var asrStepState: PipelineStepState {
        if viewModel.note.status == .transcribingASR { return .active }
        return viewModel.note.rawTranscript.isEmpty ? .pending : .done
    }

    private var llmStepState: PipelineStepState {
        if viewModel.note.status == .cleaningLLM { return .active }
        if viewModel.isReprocessing && asrStepState == .done { return .pending }
        return viewModel.note.cleanedNote.isEmpty ? .pending : .done
    }

    private var pipelineSection: some View {
        VStack(alignment: .leading, spacing: 0) {
            pipelineStep(
                number: 1,
                title: "Speech-to-Text (ASR)",
                description: "Converts audio into a verbatim text transcript.",
                icon: "waveform",
                state: asrStepState
            )

            connectorLine(filled: asrStepState == .done)

            pipelineStep(
                number: 2,
                title: "On-Device LLM Cleanup",
                description: "Formats requirements into bullets, conditions into numbered steps, and fixes grammar.",
                icon: "sparkles",
                state: llmStepState
            )

            if !viewModel.note.processingTimings.isEmpty {
                timingsCard
                    .padding(.top, 12)
            }

            if viewModel.isReprocessing {
                liveProgressBanner
            } else {
                Button {
                    viewModel.reprocessNote()
                } label: {
                    Label("Re-process With On-Device LLM", systemImage: "arrow.triangle.2.circlepath")
                        .font(.subheadline.weight(.semibold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 4)
                }
                .buttonStyle(.borderedProminent)
                .padding(.top, 12)
            }
        }
    }

    /// How long each step of the last run took on this device (`VoiceNote.processingTimings`),
    /// as bars against the slowest step.
    private var timingsCard: some View {
        let timings = viewModel.note.processingTimings
        let longest = max(timings.map(\.seconds).max() ?? 1, 0.001)
        let total = timings.map(\.seconds).reduce(0, +)
        return VStack(alignment: .leading, spacing: 10) {
            HStack {
                sectionHeader(icon: "stopwatch", tint: .teal, title: "Last Run")
                Spacer()
                Text("Ready after \(Self.formatSeconds(total))")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
            }
            ForEach(Array(timings.enumerated()), id: \.offset) { _, timing in
                HStack(spacing: 10) {
                    Text(timing.name)
                        .font(.caption)
                        .frame(width: 104, alignment: .leading)
                        .lineLimit(1)
                    GeometryReader { proxy in
                        Capsule()
                            .fill(Color.teal.opacity(0.75))
                            .frame(width: max(4, proxy.size.width * timing.seconds / longest))
                    }
                    .frame(height: 8)
                    Text(Self.formatSeconds(timing.seconds))
                        .font(.caption.monospacedDigit())
                        .foregroundStyle(.secondary)
                        .frame(width: 48, alignment: .trailing)
                }
            }
            if let engine = viewModel.note.cleanupEngine {
                Text("Stage 2 on \(CleanupEngineLabel.displayName(for: engine)), on this device.")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(16)
        .background(Color.appSecondaryBackground, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    private static func formatSeconds(_ seconds: Double) -> String {
        seconds < 10 ? String(format: "%.1f s", seconds) : String(format: "%.0f s", seconds)
    }

    /// Live status card shown while a reprocess/retry is in flight -- reflects the note's actual
    /// `NoteProcessingStatus` (not a fake timer), with an animated icon so progress reads as
    /// "alive" rather than a bare spinner.
    private var liveProgressBanner: some View {
        let status = viewModel.note.status
        return VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 10) {
                Image(systemName: status.iconName)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(Color.accentColor)
                    .symbolEffect(.pulse, options: .repeating, isActive: true)
                    .frame(width: 22)

                Text(status.stepDescription)
                    .font(.subheadline.weight(.semibold))
                    .contentTransition(.opacity)
                    .animation(.easeInOut, value: status)

                Spacer(minLength: 0)
            }

            ProgressView()
                .progressViewStyle(.linear)
                .tint(Color.accentColor)
        }
        .padding(14)
        .background(Color.accentColor.opacity(0.08), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .padding(.top, 12)
    }

    private func connectorLine(filled: Bool) -> some View {
        Rectangle()
            .fill(filled ? Color.green : Color.appTertiaryFill)
            .frame(width: 2, height: 16)
            .padding(.leading, 27)
            .animation(.easeInOut(duration: 0.3), value: filled)
    }

    private func pipelineStep(number: Int, title: String, description: String, icon: String, state: PipelineStepState) -> some View {
        HStack(alignment: .top, spacing: 12) {
            ZStack {
                Circle()
                    .fill(stepColor(state))
                    .frame(width: 28, height: 28)

                switch state {
                case .done:
                    Image(systemName: "checkmark")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(.white)
                case .active:
                    Image(systemName: icon)
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(.white)
                        .symbolEffect(.pulse, options: .repeating, isActive: true)
                case .pending:
                    Text("\(number)")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.secondary)
                }
            }
            .animation(.easeInOut(duration: 0.3), value: state)

            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .font(.subheadline.weight(.semibold))
                Text(description)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer(minLength: 0)
        }
        .padding(14)
        .background(Color.appSecondaryBackground, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    private func stepColor(_ state: PipelineStepState) -> Color {
        switch state {
        case .done: return .green
        case .active: return .accentColor
        case .pending: return Color.appTertiaryFill
        }
    }

    // MARK: - Metadata Footer

    private var metadataFooter: some View {
        VStack(spacing: 6) {
            Divider()
                .padding(.top, 12)
                .padding(.bottom, 6)

            HStack(spacing: 6) {
                Label(viewModel.note.source.displayName, systemImage: viewModel.note.source.iconName)

                if viewModel.note.duration > 0 {
                    Text("·")
                    Text(viewModel.note.duration.formattedDuration)
                }

                if viewModel.note.spokenWPM > 0 {
                    Text("·")
                    Text("\(viewModel.note.spokenWPM) WPM (\(viewModel.note.speechCadenceLabel))")
                }

                Text("·")
                Text(viewModel.note.createdAt.fullFormattedString)
            }
            .font(.caption)
            .foregroundStyle(.tertiary)
            .frame(maxWidth: .infinity, alignment: .center)
        }
    }
}

// MARK: - Transcript Segment Text (Whisper token badges)

/// Renders a transcript segment's spoken words inline with its Whisper control tokens
/// (`<|startoftranscript|>`, `<|7.54|>`, ...) shown as compact badges instead of raw markup.
private struct TranscriptSegmentText: View {
    let segment: TranscriptTimingSegment

    var body: some View {
        TranscriptFlowLayout(horizontalSpacing: 4, verticalSpacing: 6) {
            ForEach(Array(items.enumerated()), id: \.offset) { _, item in
                switch item {
                case .word(let word):
                    Text(word)
                        .font(.body)
                        .foregroundStyle(.primary)
                case .token(let token):
                    TranscriptTokenBadge(token: token)
                }
            }
        }
    }

    private enum Item {
        case word(String)
        case token(TranscriptTimingSegment.SpecialToken)
    }

    private var items: [Item] {
        segment.parts.flatMap { part -> [Item] in
            switch part {
            case .text(let text):
                return text.split(whereSeparator: \.isWhitespace).map { .word(String($0)) }
            case .token(let token):
                return [.token(token)]
            }
        }
    }
}

private struct TranscriptTokenBadge: View {
    let token: TranscriptTimingSegment.SpecialToken

    var body: some View {
        Label {
            Text(title)
        } icon: {
            Image(systemName: icon)
                .imageScale(.small)
        }
        .labelStyle(.titleAndIcon)
        .font(.caption2.weight(.semibold).monospacedDigit())
        .foregroundStyle(tint)
        .padding(.horizontal, 6)
        .padding(.vertical, 2)
        .background(tint.opacity(0.12), in: Capsule())
        .overlay(Capsule().strokeBorder(tint.opacity(0.25), lineWidth: 0.5))
        .accessibilityLabel(accessibilityText)
    }

    private var title: String {
        switch token {
        case .timestamp(let seconds): return String(format: "%.2fs", seconds)
        case .startOfTranscript: return "Start"
        case .endOfText: return "End"
        case .language(let code): return code.uppercased()
        case .task(let name): return name.capitalized
        case .noTimestamps: return "No Timestamps"
        case .other(let name): return name
        case .audioEvent(let name): return Self.audioEventTitle(name)
        }
    }

    private var icon: String {
        switch token {
        case .timestamp: return "clock"
        case .startOfTranscript: return "play.fill"
        case .endOfText: return "stop.fill"
        case .language: return "globe"
        case .task: return "waveform"
        case .noTimestamps: return "clock.badge.xmark"
        case .other: return "chevron.left.forwardslash.chevron.right"
        case .audioEvent(let name): return Self.audioEventIcon(name)
        }
    }

    private var tint: Color {
        switch token {
        case .timestamp: return .teal
        case .startOfTranscript: return .green
        case .endOfText: return .red
        case .language: return .purple
        case .task: return .indigo
        case .noTimestamps, .other: return .gray
        case .audioEvent: return .orange
        }
    }

    private var accessibilityText: String {
        switch token {
        case .timestamp(let seconds): return String(format: "Timestamp %.2f seconds", seconds)
        case .startOfTranscript: return "Start of transcript"
        case .endOfText: return "End of text"
        case .audioEvent: return "Sound: \(title)"
        default: return title
        }
    }

    /// Whisper's audio-event tags, as a person would say them: "blank audio" -> "Silence".
    static func audioEventTitle(_ name: String) -> String {
        switch name {
        case "blank audio", "silence", "no speech": return "Silence"
        case "inaudible", "inaudible remark", "inaudible speech": return "Inaudible"
        default: return name.prefix(1).uppercased() + name.dropFirst()
        }
    }

    static func audioEventIcon(_ name: String) -> String {
        if ["blank", "silence", "no speech"].contains(where: name.contains) { return "speaker.slash" }
        if name.contains("music") || name.contains("singing") { return "music.note" }
        if name.contains("laugh") || name.contains("chuckl") { return "face.smiling" }
        if name.contains("applause") || name.contains("clap") { return "hands.clap" }
        if name.contains("inaudible") || name.contains("unclear") { return "ear.trianglebadge.exclamationmark" }
        return "waveform"
    }
}

/// Wraps subviews left-to-right onto as many lines as needed, vertically centering each line.
private struct TranscriptFlowLayout: Layout {
    var horizontalSpacing: CGFloat
    var verticalSpacing: CGFloat

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let rows = arrange(subviews: subviews, maxWidth: proposal.width ?? .infinity)
        let width = rows.map(\.width).max() ?? 0
        let height = rows.map(\.height).reduce(0, +) + verticalSpacing * CGFloat(max(rows.count - 1, 0))
        return CGSize(width: proposal.width ?? width, height: height)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var y = bounds.minY
        for row in arrange(subviews: subviews, maxWidth: bounds.width) {
            var x = bounds.minX
            for index in row.indices {
                let size = subviews[index].sizeThatFits(.unspecified)
                subviews[index].place(
                    at: CGPoint(x: x, y: y + (row.height - size.height) / 2),
                    proposal: ProposedViewSize(size)
                )
                x += size.width + horizontalSpacing
            }
            y += row.height + verticalSpacing
        }
    }

    private struct Row {
        var indices: [Int] = []
        var width: CGFloat = 0
        var height: CGFloat = 0
    }

    private func arrange(subviews: Subviews, maxWidth: CGFloat) -> [Row] {
        var rows: [Row] = []
        var current = Row()
        for index in subviews.indices {
            let size = subviews[index].sizeThatFits(.unspecified)
            let proposedWidth = current.indices.isEmpty ? size.width : current.width + horizontalSpacing + size.width
            if proposedWidth > maxWidth, !current.indices.isEmpty {
                rows.append(current)
                current = Row()
            }
            current.width = current.indices.isEmpty ? size.width : current.width + horizontalSpacing + size.width
            current.height = max(current.height, size.height)
            current.indices.append(index)
        }
        if !current.indices.isEmpty { rows.append(current) }
        return rows
    }
}

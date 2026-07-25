import AVFoundation
import Combine
import ContempoCore
import ContempoFirestore
import PhotosUI
import SwiftUI
import UniformTypeIdentifiers

struct EntryDetailScreen: View {
    let entryId: String
    @State private var viewModel: EntryDetailViewModel
    @Environment(\.contempoPalette) private var palette
    @Environment(\.dismiss) private var dismiss

    @State private var showPhotosPicker = false
    @State private var photoPickerSelection: [PhotosPickerItem] = []
    @State private var showFileImporter = false
    @State private var previewURL: URL?
    @State private var downloadingAttachmentId: String?
    @State private var downloadError: String?
    @State private var noteEditingTarget: Attachment?

    init(entryId: String) {
        self.entryId = entryId
        _viewModel = State(initialValue: EntryDetailViewModel(entryId: entryId))
    }

    var body: some View {
        Group {
            if let entry = viewModel.entry {
                List {
                    Section {
                        HStack {
                            Text(entry.statusEnum == .confirmed ? "Confirmed" : (entry.inProgress ? "In progress" : "Pending"))
                                .font(ContempoFont.labelSmall())
                                .foregroundStyle(entry.statusEnum == .confirmed ? palette.pine : palette.brass)
                        }
                    }
                    Section("Task") {
                        BulletAwareText(entry.task)
                    }
                    Section("Details") {
                        LabeledContent("Property", value: entry.propertyName.isEmpty ? "—" : entry.propertyName)
                        LabeledContent("Category", value: entry.categoryEnum.firestoreValue.replacingOccurrences(of: "_", with: " ").capitalized)
                        LabeledContent("Duration", value: "\(entry.durationMinutes) min")
                        LabeledContent("Activity date", value: entry.activityDate.dateValue().formatted())
                        LabeledContent("Logged", value: entry.loggedAt.dateValue().formatted())
                        if let confirmedAt = entry.confirmedAt {
                            LabeledContent("Confirmed", value: confirmedAt.dateValue().formatted())
                        }
                        if entry.miles > 0 {
                            LabeledContent("Miles", value: entry.miles.formatted(.number.precision(.fractionLength(1))))
                        }
                        if !entry.photoUrls.isEmpty {
                            LabeledContent("Photos", value: "\(entry.photoUrls.count)")
                        }
                    }
                    Section("Attachments") {
                        attachmentsSectionContent
                    }
                    if !entry.audioUrl.isEmpty {
                        Section("Voice recording") {
                            AudioPlayerRow(audioUrl: entry.audioUrl, rawTranscript: entry.rawTranscript)
                        }
                    } else if !entry.rawTranscript.isEmpty {
                        // Transcript without audio (edge case — audio was purged but
                        // transcript kept, or legacy entries with transcript only).
                        Section("Voice transcript") {
                            Text(entry.rawTranscript).font(ContempoFont.bodyLarge())
                        }
                    }
                }
                .safeAreaInset(edge: .bottom) {
                    NavigationLink(value: confirmRoute(for: entry)) {
                        Text(actionLabel(for: entry)).bold()
                            .frame(maxWidth: .infinity)
                            .padding()
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(palette.pine)
                    .padding()
                    .background(Color(.systemGroupedBackground))
                }
            } else if viewModel.isLoading {
                ProgressView()
            } else {
                Text("Entry not found").foregroundStyle(palette.inkFaint)
            }
        }
        .navigationTitle("Entry")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    viewModel.delete { dismiss() }
                } label: {
                    Image(systemName: "trash")
                        .foregroundStyle(palette.danger)
                }
                .disabled(viewModel.isDeleting)
            }
        }
        .alert("Couldn't delete", isPresented: Binding(
            get: { viewModel.deleteError != nil },
            set: { if !$0 { viewModel.dismissDeleteError() } }
        )) {
            Button("OK") { viewModel.dismissDeleteError() }
        } message: {
            Text(viewModel.deleteError ?? "")
        }
        .alert("Attachment error", isPresented: Binding(
            get: { viewModel.attachmentError != nil },
            set: { if !$0 { viewModel.dismissAttachmentError() } }
        )) {
            Button("OK") { viewModel.dismissAttachmentError() }
        } message: {
            Text(viewModel.attachmentError ?? "")
        }
        .alert("Couldn't open file", isPresented: Binding(
            get: { downloadError != nil },
            set: { if !$0 { downloadError = nil } }
        )) {
            Button("OK") { downloadError = nil }
        } message: {
            Text(downloadError ?? "")
        }
        .photosPicker(
            isPresented: $showPhotosPicker,
            selection: $photoPickerSelection,
            maxSelectionCount: nil,
            matching: .any(of: [.images, .videos])
        )
        .onChange(of: photoPickerSelection) { _, newItems in
            guard !newItems.isEmpty else { return }
            for item in newItems {
                Task { await importPickedPhoto(item) }
            }
            photoPickerSelection = []
        }
        .fileImporter(isPresented: $showFileImporter, allowedContentTypes: [.item], allowsMultipleSelection: true) { result in
            switch result {
            case .success(let urls):
                for url in urls { importPickedFile(url) }
            case .failure(let error):
                viewModel.attachmentError = error.localizedDescription
            }
        }
        .fullScreenCover(isPresented: Binding(
            get: { previewURL != nil },
            set: { if !$0 { previewURL = nil } }
        )) {
            if let previewURL {
                QuickLookPreview(url: previewURL)
            }
        }
        .sheet(item: $noteEditingTarget) { attachment in
            AttachmentNoteEditor(attachment: attachment) { note in
                viewModel.updateNote(attachment, note: note)
            }
        }
    }

    // Split out of `body` — SwiftUI's ViewBuilder type-checker times out
    // combining this many rows/modifiers inline inside the enclosing List.
    @ViewBuilder
    private var attachmentsSectionContent: some View {
        HStack {
            Text(viewModel.attachments.isEmpty ? "No files yet" : "\(viewModel.attachments.count) file\(viewModel.attachments.count == 1 ? "" : "s")")
                .font(ContempoFont.labelSmall())
                .foregroundStyle(palette.inkFaint)
            Spacer()
            Menu {
                Button {
                    showPhotosPicker = true
                } label: {
                    Label("Photo or Video", systemImage: "photo.on.rectangle")
                }
                Button {
                    showFileImporter = true
                } label: {
                    Label("Browse Files", systemImage: "folder")
                }
            } label: {
                Label("Add", systemImage: "plus.circle.fill")
            }
        }
        ForEach(viewModel.uploadingItems) { item in
            AttachmentUploadRow(item: item)
        }
        ForEach(viewModel.attachments) { attachment in
            Button {
                previewAttachment(attachment)
            } label: {
                AttachmentRow(attachment: attachment, isDownloading: downloadingAttachmentId == attachment.id)
            }
            .buttonStyle(.plain)
            .swipeActions {
                Button(role: .destructive) {
                    viewModel.deleteAttachment(attachment)
                } label: {
                    Label("Delete", systemImage: "trash")
                }
                Button {
                    noteEditingTarget = attachment
                } label: {
                    Label(attachment.note?.isEmpty == false ? "Edit Note" : "Add Note", systemImage: "note.text")
                }
                .tint(palette.pine)
            }
        }
    }

    private func previewAttachment(_ attachment: Attachment) {
        guard downloadingAttachmentId == nil else { return }
        downloadingAttachmentId = attachment.id
        Task {
            do {
                let url = try await viewModel.localFileURL(for: attachment)
                downloadingAttachmentId = nil
                previewURL = url
            } catch {
                downloadingAttachmentId = nil
                downloadError = error.localizedDescription
            }
        }
    }

    private func importPickedPhoto(_ item: PhotosPickerItem) async {
        guard let data = try? await item.loadTransferable(type: Data.self) else { return }
        let utType = item.supportedContentTypes.first
        let fileExtension = utType?.preferredFilenameExtension ?? "dat"
        let contentType = utType?.preferredMIMEType ?? "application/octet-stream"
        let fileName = "\(UUID().uuidString).\(fileExtension)"
        let tempURL = FileManager.default.temporaryDirectory.appendingPathComponent(fileName)
        do {
            try data.write(to: tempURL)
            viewModel.addAttachment(fileURL: tempURL, fileName: fileName, contentType: contentType)
        } catch {
            viewModel.attachmentError = error.localizedDescription
        }
    }

    /// fileImporter's URLs are only readable within the security scope, which
    /// doesn't outlive this synchronous block — copy into our own temp dir
    /// before handing off to the async upload.
    private func importPickedFile(_ url: URL) {
        guard url.startAccessingSecurityScopedResource() else { return }
        defer { url.stopAccessingSecurityScopedResource() }
        let fileName = url.lastPathComponent
        let contentType = UTType(filenameExtension: url.pathExtension)?.preferredMIMEType ?? "application/octet-stream"
        let tempURL = FileManager.default.temporaryDirectory.appendingPathComponent("\(UUID().uuidString)_\(fileName)")
        do {
            try FileManager.default.copyItem(at: url, to: tempURL)
            viewModel.addAttachment(fileURL: tempURL, fileName: fileName, contentType: contentType)
        } catch {
            viewModel.attachmentError = error.localizedDescription
        }
    }

    private func actionLabel(for entry: Entry) -> String {
        if entry.inProgress { return "Stop timer" }
        if entry.statusEnum == .pendingReview { return "Complete" }
        return "Edit"
    }

    private func confirmRoute(for entry: Entry) -> AppRoute {
        var durationMinutes = entry.durationMinutes
        if entry.inProgress {
            durationMinutes = max(0, Int(Date().timeIntervalSince(entry.activityDate.dateValue()) / 60))
        }
        let params = ConfirmParams(
            property: entry.propertyName,
            task: entry.task,
            durationMinutes: durationMinutes,
            category: entry.category,
            captureSource: entry.sourceEnum,
            miles: entry.miles,
            resolvedActivityDateIso: nil,
            photoData: nil,
            entryId: entry.id ?? "",
            captureLat: entry.captureLat,
            captureLng: entry.captureLng
        )
        return .confirm(params)
    }
}

// MARK: - Audio Player

private enum AudioPlaybackState {
    case idle, loading, playing, paused, error
}

/// Streams audio from a Firebase Storage download URL using AVPlayer.
/// Lifecycle is tied to the List row: the player is paused and cleaned up
/// when the view disappears, matching the Android MediaPlayer.release()
/// behaviour in DisposableEffect.
private struct AudioPlayerRow: View {
    let audioUrl: String
    let rawTranscript: String

    @State private var playbackState: AudioPlaybackState = .idle
    @State private var showTranscript = false
    @State private var player: AVPlayer?
    @State private var statusCancellable: AnyCancellable?
    @Environment(\.contempoPalette) private var palette

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 4) {
                // Play / Pause / Loading button
                Button {
                    if playbackState == .playing {
                        pause()
                    } else {
                        play()
                    }
                } label: {
                    Group {
                        if playbackState == .loading {
                            ProgressView()
                                .controlSize(.small)
                                .frame(width: 22, height: 22)
                        } else {
                            Image(systemName: playbackState == .playing ? "pause.circle.fill" : "play.circle.fill")
                                .font(.system(size: 32))
                                .foregroundStyle(palette.pine)
                        }
                    }
                    .frame(width: 36, height: 36)
                }
                .buttonStyle(.plain)
                .disabled(playbackState == .loading)

                // Status label
                Text(statusLabel)
                    .font(ContempoFont.labelSmall())
                    .foregroundStyle(playbackState == .error ? palette.danger : palette.inkSoft)
                    .frame(maxWidth: .infinity, alignment: .leading)

                // Transcript toggle — only shown when a transcript exists
                if !rawTranscript.isEmpty {
                    Button {
                        withAnimation(.easeInOut(duration: 0.2)) {
                            showTranscript.toggle()
                        }
                    } label: {
                        Image(systemName: showTranscript ? "doc.text.fill" : "doc.text")
                            .font(.system(size: 16))
                            .foregroundStyle(showTranscript ? palette.pine : palette.inkSoft)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(showTranscript ? "Hide transcript" : "Show transcript")
                }
            }

            // Expandable transcript
            if showTranscript && !rawTranscript.isEmpty {
                Text(rawTranscript)
                    .font(ContempoFont.bodyLarge())
                    .foregroundStyle(palette.ink)
                    .padding(12)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(palette.paper)
                    .clipShape(RoundedRectangle(cornerRadius: ContempoRadius.small))
                    .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
        .onDisappear {
            // Release the player when the row leaves the screen, exactly as
            // Android's DisposableEffect/onDispose calls mediaPlayer.release().
            statusCancellable?.cancel()
            player?.pause()
            player = nil
            playbackState = .idle
        }
    }

    private var statusLabel: String {
        switch playbackState {
        case .idle:    return "Voice recording"
        case .loading: return "Loading…"
        case .playing: return "Playing"
        case .paused:  return "Paused"
        case .error:   return "Couldn't load audio"
        }
    }

    private func play() {
        switch playbackState {
        case .paused:
            player?.play()
            playbackState = .playing

        case .idle, .error:
            guard let url = URL(string: audioUrl) else {
                playbackState = .error
                return
            }
            playbackState = .loading
            let item = AVPlayerItem(url: url)
            let newPlayer = AVPlayer(playerItem: item)

            // KVO via Combine — fires once when status leaves .unknown.
            statusCancellable?.cancel()
            statusCancellable = item.publisher(for: \.status)
                .filter { $0 != .unknown }
                .prefix(1)
                .receive(on: DispatchQueue.main)
                .sink { [weak newPlayer] status in
                    if status == .readyToPlay {
                        newPlayer?.play()
                        playbackState = .playing
                    } else {
                        playbackState = .error
                    }
                }

            // Reset to idle when playback reaches the end.
            NotificationCenter.default.addObserver(
                forName: AVPlayerItem.didPlayToEndTimeNotification,
                object: item,
                queue: .main
            ) { _ in playbackState = .idle }

            player = newPlayer

        case .loading, .playing:
            break
        }
    }

    private func pause() {
        player?.pause()
        playbackState = .paused
    }
}

// MARK: - Attachment Upload Row

private struct AttachmentUploadRow: View {
    let item: UploadingAttachment

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(item.fileName)
                .font(ContempoFont.bodySmall())
                .lineLimit(1)
            ProgressView(value: item.progress)
        }
    }
}

// MARK: - Attachment Row

private struct AttachmentRow: View {
    let attachment: Attachment
    let isDownloading: Bool
    @Environment(\.contempoPalette) private var palette

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: iconName)
                .foregroundStyle(palette.pine)
                .frame(width: 24)
            VStack(alignment: .leading, spacing: 2) {
                Text(attachment.fileName)
                    .font(ContempoFont.bodyLarge())
                    .foregroundStyle(palette.ink)
                    .lineLimit(1)
                Text("\(sizeLabel) · \(timeLabel)")
                    .font(ContempoFont.labelSmall())
                    .foregroundStyle(palette.inkFaint)
                if let note = attachment.note, !note.isEmpty {
                    Text(note)
                        .font(ContempoFont.labelSmall())
                        .foregroundStyle(palette.inkSoft)
                        .lineLimit(2)
                }
            }
            Spacer()
            if isDownloading {
                ProgressView()
            }
        }
    }

    private var iconName: String {
        if attachment.contentType.hasPrefix("image/") { return "photo" }
        if attachment.contentType.hasPrefix("video/") { return "video" }
        if attachment.contentType == "application/pdf" { return "doc.richtext" }
        return "doc"
    }

    private var sizeLabel: String {
        ByteCountFormatter.string(fromByteCount: attachment.fileSize, countStyle: .file)
    }

    private var timeLabel: String {
        attachment.uploadedAt.dateValue().formatted(.relative(presentation: .named))
    }
}

// MARK: - Attachment Note Editor

private struct AttachmentNoteEditor: View {
    let attachment: Attachment
    let onSave: (String) -> Void

    @Environment(\.dismiss) private var dismiss
    @Environment(\.contempoPalette) private var palette
    @State private var noteText: String

    init(attachment: Attachment, onSave: @escaping (String) -> Void) {
        self.attachment = attachment
        self.onSave = onSave
        _noteText = State(initialValue: attachment.note ?? "")
    }

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 12) {
                Text(attachment.fileName)
                    .font(ContempoFont.labelSmall())
                    .foregroundStyle(palette.inkFaint)
                    .lineLimit(1)
                TextEditor(text: $noteText)
                    .frame(minHeight: 160)
                    .padding(8)
                    .background(palette.paperRaised)
                    .clipShape(RoundedRectangle(cornerRadius: ContempoRadius.medium))
                    .overlay(
                        RoundedRectangle(cornerRadius: ContempoRadius.medium)
                            .stroke(palette.hairline, lineWidth: 1)
                    )
                Spacer()
            }
            .padding(20)
            .navigationTitle("Note")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        onSave(noteText.trimmingCharacters(in: .whitespacesAndNewlines))
                        dismiss()
                    }
                }
            }
        }
    }
}

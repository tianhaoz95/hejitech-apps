import AVFoundation
import Combine
import ContempoCore
import ContempoFirestore
import SwiftUI

struct EntryDetailScreen: View {
    let entryId: String
    @State private var viewModel: EntryDetailViewModel
    @Environment(\.contempoPalette) private var palette
    @Environment(\.dismiss) private var dismiss

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

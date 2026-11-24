import AppKit
import SwiftUI
#if canImport(FeedbackKit)
import FeedbackKit
#endif

@main
struct VoxbriefMacApp: App {
    @StateObject private var accessibility = AccessibilityPermissionManager.shared
    @StateObject private var repository: NoteRepository
    @StateObject private var recorder: MacAudioRecorderService
    @StateObject private var coordinator: CaptureCoordinator
    @StateObject private var meetingRecorder: MacMeetingRecorderService
    @StateObject private var updateChecker = UpdateChecker.shared

    private let pipeline: NoteProcessingPipeline
    private let playbackService: AudioPlaybackService
    private let dictionaryStore = PersonalDictionaryStore.shared
    private let hotkeyManager = GlobalHotkeyManager()
    private let overlayController: OverlayWindowController

    init() {
        let appSupportRoot = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("Voxbrief Mac", isDirectory: true)
        try? FileManager.default.createDirectory(at: appSupportRoot, withIntermediateDirectories: true)

        let audioFileManager = AudioFileManager(baseDirectoryOverride: appSupportRoot)
        let repository = NoteRepository(
            audioFileManager: audioFileManager,
            customStorageURL: appSupportRoot.appendingPathComponent("notes_store.json")
        )
        repository.autoExportService = AutoExportService.shared
        CloudSyncService.shared.attach(
            repository: repository,
            audioFileManager: audioFileManager,
            dictionaryStore: PersonalDictionaryStore.shared,
            templateStore: TemplateStore.shared
        )

        let recorder = MacAudioRecorderService(audioFileManager: audioFileManager)
        let pipeline = NoteProcessingPipeline(
            repository: repository,
            audioFileManager: audioFileManager,
            speakerDetector: SpeakerDiarizationService.shared
        )
        let coordinator = CaptureCoordinator(
            recorder: recorder,
            repository: repository,
            pipeline: pipeline,
            pasteInjector: PasteInjector()
        )
        let meetingRecorder = MacMeetingRecorderService(
            repository: repository,
            pipeline: pipeline,
            audioFileManager: audioFileManager
        )

        _repository = StateObject(wrappedValue: repository)
        _recorder = StateObject(wrappedValue: recorder)
        _coordinator = StateObject(wrappedValue: coordinator)
        _meetingRecorder = StateObject(wrappedValue: meetingRecorder)
        self.pipeline = pipeline
        self.playbackService = AudioPlaybackService(audioFileManager: audioFileManager)
        overlayController = OverlayWindowController(coordinator: coordinator, recorder: recorder)

        hotkeyManager.onBothCommandKeysPressed = { [weak coordinator] in
            coordinator?.beginCapture()
        }

        hotkeyManager.onFeedbackShortcutPressed = {
            MacFeedbackPresenter.openFeedback()
        }

        FeedbackShortcutStore.shared.startLocalMonitor {
            MacFeedbackPresenter.openFeedback()
        }

        #if canImport(FeedbackKit)
        FeedbackKit.configure(.init(
            endpointURL: URL(string: "https://gpucoladcyvijefdjudf.supabase.co/functions/v1/ingest-feedback")!,
            projectKey: "pk_ffa7308d843fd670a9bbd1d67ad0ebf54597"
        ))
        #endif

        if UserDefaults.standard.object(forKey: "auto_check_for_updates") as? Bool ?? true {
            Task { await UpdateChecker.shared.checkNow() }
        }
    }

    var body: some Scene {
        MenuBarExtra("Voxbrief", systemImage: menuBarSymbolName) {
            MenuBarContentView(
                accessibility: accessibility,
                coordinator: coordinator,
                meetingRecorder: meetingRecorder,
                hotkeyManager: hotkeyManager,
                updateChecker: updateChecker
            )
        }
        .menuBarExtraStyle(.menu)

        Window("Voxbrief Notes", id: "notes") {
            NotesBrowserView(
                repository: repository,
                pipeline: pipeline,
                playbackService: playbackService,
                meetingRecorder: meetingRecorder
            )
            .environmentObject(coordinator)
            .environmentObject(recorder)
        }

        Window("Ask Voxbrief", id: "ask") {
            AskView(playbackService: playbackService)
                .environmentObject(repository)
                .frame(minWidth: 520, minHeight: 560)
        }

        Window("Personal Dictionary", id: "dictionary") {
            NavigationStack {
                PersonalDictionaryView(store: dictionaryStore)
            }
            .frame(width: 420, height: 480)
        }

        Settings {
            PreferencesView(accessibility: accessibility, repository: repository)
        }
    }

    private var menuBarSymbolName: String {
        if meetingRecorder.isRecording {
            return meetingRecorder.isPaused ? "pause.circle.fill" : "record.circle.fill"
        }
        switch coordinator.state {
        case .idle: return "waveform"
        case .listening: return "waveform.circle.fill"
        case .processing: return "sparkles"
        case .success: return "checkmark.circle.fill"
        case .failed: return "exclamationmark.triangle.fill"
        }
    }
}

/// Menu bar dropdown content: permission gate, hotkey reminder, and navigation. Requesting
/// Accessibility and starting the hotkey tap both happen from here (on first appearance and
/// whenever the trust state flips) rather than unconditionally at launch, since `start()` is a
/// no-op until the user has actually granted Accessibility.
private struct MenuBarContentView: View {
    @ObservedObject var accessibility: AccessibilityPermissionManager
    @ObservedObject var coordinator: CaptureCoordinator
    @ObservedObject var meetingRecorder: MacMeetingRecorderService
    let hotkeyManager: GlobalHotkeyManager
    @ObservedObject var updateChecker: UpdateChecker

    @Environment(\.openWindow) private var openWindow
    @Environment(\.openURL) private var openURL

    var body: some View {
        Group {
            if accessibility.isTrusted {
                Text("Press both ⌘ keys to capture")
            } else {
                Button("Grant Accessibility Access…") {
                    accessibility.requestAccessOrOpenSettings()
                }
                Text("Required for the global hotkey and paste.")
            }

            Divider()

            if meetingRecorder.isRecording {
                Text("Meeting Recording · \(meetingRecorder.recordingDuration.formattedDuration)")
                Button(meetingRecorder.isPaused ? "Resume Meeting Recording" : "Pause Meeting Recording") {
                    meetingRecorder.togglePause()
                }
                Button("Stop & Save Meeting") {
                    Task {
                        _ = await meetingRecorder.stopAndProcess()
                        openWindow(id: "notes")
                    }
                }
                Button("Cancel Meeting Recording") {
                    meetingRecorder.cancelRecording()
                }
            } else {
                Button("Record Meeting (Mic + System Audio)") {
                    Task {
                        await meetingRecorder.startMeetingRecording()
                        if meetingRecorder.errorMessage != nil {
                            openWindow(id: "notes")
                        }
                    }
                }
            }

            Divider()

            Button("Open Notes…") { openWindow(id: "notes") }
            Button("Ask Voxbrief…") { openWindow(id: "ask") }

            if case .updateAvailable(let update) = updateChecker.state {
                Divider()
                Button("Update Available (v\(update.version))…") {
                    openURL(update.downloadURL)
                }
            }

            Divider()

            SettingsLink {
                Text("Settings…")
            }
            Button("Quit Voxbrief") {
                NSApplication.shared.terminate(nil)
            }
        }
        .onAppear { syncHotkeyState() }
        .onChange(of: accessibility.isTrusted) { _, _ in syncHotkeyState() }
    }

    private func syncHotkeyState() {
        if accessibility.isTrusted {
            hotkeyManager.start()
        } else {
            hotkeyManager.stop()
        }
    }
}

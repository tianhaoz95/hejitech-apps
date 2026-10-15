import SwiftUI
import WatchKit

public enum WatchCaptureTag: String, CaseIterable, Identifiable, Sendable {
    case auto = "✨ Auto"
    case idea = "💡 Idea"
    case task = "✅ Task"
    case meeting = "👥 Meeting"

    public var id: String { rawValue }
}

public struct WatchMainRecordView: View {
    @StateObject private var recorder = WatchAudioRecorder.shared
    @StateObject private var syncService = WatchSyncService.shared
    @StateObject private var storage = WatchStorage.shared

    @State private var selectedPage: Int = 0
    @State private var selectedTag: WatchCaptureTag = .auto
    @State private var currentSource: NoteSource = .watchApp
    @State private var showingSavedToast = false
    @State private var savedNoteDuration: String = ""

    public init() {}

    public var body: some View {
        TabView(selection: $selectedPage) {
            // MARK: - Page 0: Auto-First Capture
            capturePageView
                .tag(0)

            // MARK: - Page 1: Vault / Saved Memos
            NavigationStack {
                WatchNotesListView()
            }
            .tag(1)
        }
        .tabViewStyle(.page)
        .onAppear {
            let args = ProcessInfo.processInfo.arguments
            if args.contains("-voxbriefWatchRecording") {
                selectedPage = 0
                recorder.setSimulatedRecording(active: true, duration: 18.0, level: 0.7)
            } else if args.contains("-voxbriefWatchNotes") {
                selectedPage = 1
            }
        }
        .onOpenURL { url in
            handleDeepLink(url: url)
        }
    }

    // MARK: - Capture Page View (Page 0)
    private var capturePageView: some View {
        VStack(spacing: 4) {
            if recorder.isRecording {
                // MARK: Active Recording State
                VStack(spacing: 3) {
                    HStack(spacing: 4) {
                        Circle()
                            .fill(recorder.isPaused ? Color.yellow : Color.red)
                            .frame(width: 6, height: 6)
                        Text(recorder.isPaused ? "PAUSED" : "RECORDING")
                            .font(.system(size: 10, weight: .bold, design: .rounded))
                            .tracking(0.8)
                            .foregroundColor(recorder.isPaused ? .yellow : .red)
                    }
                    .padding(.top, 2)

                    Text(recorder.recordingDuration.formattedDuration)
                        .font(.system(size: 24, weight: .bold, design: .monospaced))
                        .foregroundColor(.primary)
                        .monospacedDigit()

                    HStack(spacing: 12) {
                        Button {
                            if recorder.isPaused {
                                recorder.resumeRecording()
                                WKInterfaceDevice.current().play(.start)
                            } else {
                                recorder.pauseRecording()
                                WKInterfaceDevice.current().play(.stop)
                            }
                        } label: {
                            Image(systemName: recorder.isPaused ? "play.fill" : "pause.fill")
                                .font(.system(size: 15, weight: .semibold))
                                .foregroundColor(recorder.isPaused ? .green : .yellow)
                                .frame(width: 36, height: 36)
                                .background(Color.white.opacity(0.14), in: Circle())
                        }
                        .buttonStyle(.plain)

                        Button {
                            stopAndSave()
                        } label: {
                            CaptureWaveformView(
                                isRecording: !recorder.isPaused,
                                audioLevel: recorder.audioLevel,
                                diameter: 42,
                                systemImage: "stop.fill"
                            )
                        }
                        .buttonStyle(.plain)
                    }

                    Text(recorder.isPaused ? "Tap play to resume" : "Tap stop to save")
                        .font(.system(size: 10, weight: .medium))
                        .foregroundColor(.secondary)
                }
            } else {
                // MARK: Resting Idle State (Zero waveform before recording!)
                VStack(spacing: 4) {
                    VoxbriefLogoView(size: .watch)
                        .padding(.top, 2)

                    // Tag Selector Pill (Defaults to ✨ Auto, tap to triage)
                    Button {
                        cycleTag()
                    } label: {
                        HStack(spacing: 4) {
                            Text(selectedTag.rawValue)
                                .font(.system(size: 10, weight: .semibold, design: .rounded))
                        }
                        .foregroundColor(selectedTag == .auto ? Color.accentColor : .primary)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(Color.white.opacity(0.12), in: Capsule())
                    }
                    .buttonStyle(.plain)

                    if showingSavedToast {
                        HStack(spacing: 4) {
                            Image(systemName: "checkmark.circle.fill")
                                .font(.system(size: 10))
                                .foregroundColor(.green)
                            Text("Saved (\(savedNoteDuration))")
                                .font(.system(size: 10, weight: .semibold))
                                .foregroundColor(.green)
                        }
                        .padding(.horizontal, 8)
                        .padding(.vertical, 2)
                        .background(Color.green.opacity(0.15), in: Capsule())
                    }

                    // Flat Hero Record Button (Clean microphone, no pre-capture waveform)
                    Button {
                        startRecording(source: .watchApp)
                    } label: {
                        CaptureWaveformView(
                            isRecording: false,
                            audioLevel: 0,
                            diameter: 44,
                            systemImage: "mic.fill"
                        )
                    }
                    .buttonStyle(.plain)

                    Text("Tap to record")
                        .font(.system(size: 10, weight: .medium))
                        .foregroundColor(.secondary)
                }
            }

            Spacer(minLength: 0)

            // Bottom Navigation Hint (Swipe to Vault)
            HStack(spacing: 4) {
                Spacer()
                Button {
                    withAnimation {
                        selectedPage = 1
                    }
                } label: {
                    HStack(spacing: 3) {
                        Image(systemName: "tray.full.fill")
                            .font(.system(size: 9))
                        Text("Vault (\(storage.notes.count))")
                            .font(.system(size: 9, weight: .semibold, design: .rounded))
                        Image(systemName: "chevron.right")
                            .font(.system(size: 7, weight: .bold))
                    }
                    .foregroundColor(.secondary)
                    .padding(.horizontal, 7)
                    .padding(.vertical, 3)
                    .background(Color.white.opacity(0.08), in: Capsule())
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 6)
            .padding(.bottom, 1)
        }
        .padding(.horizontal, 4)
    }

    private func cycleTag() {
        if let idx = WatchCaptureTag.allCases.firstIndex(of: selectedTag) {
            let nextIdx = (idx + 1) % WatchCaptureTag.allCases.count
            selectedTag = WatchCaptureTag.allCases[nextIdx]
            WKInterfaceDevice.current().play(.click)
        }
    }

    private func startRecording(source: NoteSource) {
        currentSource = source
        Task {
            let granted = await recorder.requestPermission()
            if granted {
                if (try? recorder.startRecording(source: source)) != nil {
                    WKInterfaceDevice.current().play(.start)
                }
            }
        }
    }

    private func stopAndSave() {
        if let savedNote = recorder.stopRecording(source: currentSource) {
            WKInterfaceDevice.current().play(.success)
            savedNoteDuration = savedNote.duration.formattedDuration
            showingSavedToast = true

            // Queue sync immediately
            syncService.syncPendingNotes()

            // Hide toast after 2 seconds
            DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
                showingSavedToast = false
            }
        }
    }

    private func handleDeepLink(url: URL) {
        if url.host == "record" {
            selectedPage = 0
            let source: NoteSource = url.query?.contains("complication") == true ? .watchComplication : .watchApp
            startRecording(source: source)
        } else if url.host == "navigate" {
            let queryItems = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems ?? []
            let screen = queryItems.first(where: { $0.name == "screen" })?.value
            if screen == "notes" {
                selectedPage = 1
            } else if screen == "record" {
                selectedPage = 0
                startRecording(source: .watchApp)
            }
        }
    }
}

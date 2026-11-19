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

    @State private var selectedPage: Int = 0
    @State private var selectedTag: WatchCaptureTag = .auto
    @State private var currentSource: NoteSource = .watchApp
    @State private var showingSavedToast = false
    @State private var savedNoteDuration: String = ""

    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.isLuminanceReduced) private var isLuminanceReduced

    /// Someone is looking: the app is in front and the screen is not dimmed.
    private var isScreenLive: Bool { scenePhase == .active && !isLuminanceReduced }

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
            } else if args.contains("-voxbriefWatchAutoRecord") {
                // Scripted runs: start a real recording without a tap.
                selectedPage = 0
                startRecording(source: .watchApp)
            }
        }
        .onOpenURL { url in
            handleDeepLink(url: url)
        }
        .onAppear { recorder.setLiveUI(isScreenLive) }
        .onChange(of: isScreenLive) { _, live in
            recorder.setLiveUI(live)
        }
    }

    // MARK: - Dimmed recording screen (wrist down): nothing here changes, so nothing redraws
    private var dimmedRecordingView: some View {
        VStack(spacing: 6) {
            HStack(spacing: 5) {
                Circle()
                    .fill(recorder.isInterrupted || recorder.isPaused ? Color.yellow : Color.red)
                    .frame(width: 6, height: 6)
                Text(recorder.isInterrupted || recorder.isPaused ? "PAUSED" : "RECORDING")
                    .font(.system(size: 11, weight: .bold, design: .rounded))
                    .tracking(0.8)
                    .foregroundColor(recorder.isInterrupted || recorder.isPaused ? .yellow : .red)
            }
            if let started = recorder.sessionStartedAt {
                Text("since \(started.formatted(date: .omitted, time: .shortened))")
                    .font(.system(size: 18, weight: .semibold, design: .rounded))
                    .foregroundColor(.primary)
            }
            Text("Raise to stop")
                .font(.system(size: 10, weight: .medium))
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Interrupted (a call or Siri took the microphone)
    private var interruptedRecordingView: some View {
        VStack(spacing: 6) {
            Text("PAUSED")
                .font(.system(size: 11, weight: .bold, design: .rounded))
                .tracking(0.8)
                .foregroundColor(.yellow)
            Text("A call or Siri took the microphone.")
                .font(.system(size: 11))
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
            HStack(spacing: 16) {
                Button {
                    recorder.resumeAfterInterruption()
                } label: {
                    Image(systemName: "play.fill")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundColor(.green)
                        .frame(width: 44, height: 44)
                        .background(Color.white.opacity(0.14), in: Circle())
                }
                .buttonStyle(.plain)

                Button {
                    stopAndSave()
                } label: {
                    Image(systemName: "stop.fill")
                        .font(.system(size: 18, weight: .bold))
                        .foregroundColor(.white)
                        .frame(width: 50, height: 50)
                        .background(Color.red, in: Circle())
                }
                .buttonStyle(.plain)
            }
            Text("Tap play to keep recording")
                .font(.system(size: 10, weight: .medium))
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Capture Page View (Page 0)
    private var capturePageView: some View {
        VStack(spacing: 0) {
            if recorder.isRecording && !isScreenLive {
                dimmedRecordingView
            } else if recorder.isRecording && recorder.isInterrupted {
                interruptedRecordingView
            } else if recorder.isRecording {
                // MARK: Active Recording State
                VStack(spacing: 4) {
                    HStack(spacing: 5) {
                        Circle()
                            .fill(recorder.isPaused ? Color.yellow : Color.red)
                            .frame(width: 6, height: 6)
                        Text(recorder.isPaused ? "PAUSED" : "RECORDING")
                            .font(.system(size: 11, weight: .bold, design: .rounded))
                            .tracking(0.8)
                            .foregroundColor(recorder.isPaused ? .yellow : .red)
                    }
                    .padding(.top, 2)

                    Text(recorder.recordingDuration.formattedDuration)
                        .font(.system(size: 26, weight: .bold, design: .monospaced))
                        .foregroundColor(.primary)
                        .monospacedDigit()

                    CaptureWaveformView(
                        isRecording: !recorder.isPaused,
                        audioLevel: recorder.audioLevel,
                        diameter: 46,
                        systemImage: "stop.fill",
                        waveformWidth: 140,
                        showsCore: false
                    )
                    .frame(height: 32)
                    .padding(.vertical, 4)

                    Spacer(minLength: 2)

                    HStack(spacing: 16) {
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
                                .font(.system(size: 16, weight: .semibold))
                                .foregroundColor(recorder.isPaused ? .green : .yellow)
                                .frame(width: 44, height: 44)
                                .background(Color.white.opacity(0.14), in: Circle())
                        }
                        .buttonStyle(.plain)

                        Button {
                            stopAndSave()
                        } label: {
                            Image(systemName: "stop.fill")
                                .font(.system(size: 18, weight: .bold))
                                .foregroundColor(.white)
                                .frame(width: 50, height: 50)
                                .background(Color.red, in: Circle())
                        }
                        .buttonStyle(.plain)
                    }

                    Text(recorder.isPaused ? "Tap play to resume" : "Tap stop to save")
                        .font(.system(size: 10, weight: .medium))
                        .foregroundColor(.secondary)
                        .padding(.bottom, 2)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                // MARK: Resting Idle State (Full-bleed Hero Auto-First Capture)
                VStack(spacing: 0) {
                    // Top Bar: Logo on left, Tag selector on right
                    HStack(alignment: .center) {
                        VoxbriefLogoView(size: .watch)

                        Spacer()

                        Button {
                            cycleTag()
                        } label: {
                            HStack(spacing: 3) {
                                Text(selectedTag.rawValue)
                                    .font(.system(size: 10, weight: .semibold, design: .rounded))
                            }
                            .foregroundColor(selectedTag == .auto ? Color.accentColor : .primary)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 3)
                            .background(Color.white.opacity(0.12), in: Capsule())
                        }
                        .buttonStyle(.plain)
                    }
                    .padding(.horizontal, 6)
                    .padding(.top, 2)

                    Spacer(minLength: 4)

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
                        .padding(.vertical, 3)
                        .background(Color.green.opacity(0.16), in: Capsule())
                        .padding(.bottom, 4)
                    }

                    // Large Hero Record Button (Prominent tactile target, zero empty margins)
                    Button {
                        startRecording(source: .watchApp)
                    } label: {
                        ZStack {
                            Circle()
                                .fill(Color.accentColor)
                                .frame(width: 96, height: 96)

                            Image(systemName: "mic.fill")
                                .font(.system(size: 40, weight: .semibold))
                                .foregroundColor(.white)
                        }
                    }
                    .buttonStyle(.plain)

                    Text("Tap to record")
                        .font(.system(size: 11, weight: .medium))
                        .foregroundColor(.secondary)
                        .padding(.top, 6)

                    Spacer(minLength: 4)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
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

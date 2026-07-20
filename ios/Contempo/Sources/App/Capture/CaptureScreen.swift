import ContempoCore
import ContempoFirestore
import SwiftUI

struct CaptureScreen: View {
    let onDrafted: (ConfirmParams) -> Void
    @State private var viewModel = CaptureViewModel()
    @Environment(\.contempoPalette) private var palette

    var body: some View {
        VStack(spacing: 20) {
            Eyebrow("Capture")

            if let tripEntry = viewModel.openTripEntry {
                OngoingTripBanner(entry: tripEntry, isGps: viewModel.gpsTripOpen) {
                    viewModel.toggleGpsTrip()
                }
            }

            if let timerEntry = viewModel.openTimerEntry {
                OngoingWorkBanner(entry: timerEntry) {
                    viewModel.completeOpenTimer()
                }
            }

            if viewModel.showLanguageSelector {
                Picker("Language", selection: Binding(
                    get: { viewModel.selectedCaptureLanguage },
                    set: { viewModel.selectedCaptureLanguage = $0 }
                )) {
                    Text("English").tag(CaptureLanguage.english)
                    Text("中文").tag(CaptureLanguage.chinese)
                    Text("Auto").tag(CaptureLanguage.auto)
                }
                .pickerStyle(.segmented)
            }

            // Photo capture needs a camera-driven UI still — shown as a
            // disabled, honest placeholder. Voice is wired to the real
            // on-device Whisper + Gemma stack below.
            HStack(spacing: 24) {
                Button {
                    Task {
                        if viewModel.isRecording {
                            await viewModel.stopRecordingAndProcess()
                        } else {
                            await viewModel.startRecording()
                        }
                    }
                } label: {
                    VStack(spacing: 6) {
                        Image(systemName: viewModel.isRecording ? "waveform" : "mic.fill")
                            .font(.system(size: 32))
                            .frame(width: 72, height: 72)
                            .contempoGlass(tint: viewModel.isRecording ? palette.pine : nil, in: Circle())
                            .overlay(
                                Circle().stroke(palette.pine, lineWidth: viewModel.isRecording ? 2 : 0)
                            )
                            .foregroundStyle(palette.pine)
                            .scaleEffect(viewModel.isRecording ? 1 + CGFloat(viewModel.recordingAmplitude) * 0.3 : 1)
                            .animation(.easeOut(duration: 0.1), value: viewModel.recordingAmplitude)
                        Text(viewModel.isRecording ? "Stop" : "Voice")
                            .font(ContempoFont.labelSmall())
                            .foregroundStyle(palette.inkFaint)
                    }
                }
                .buttonStyle(.plain)
                .disabled(viewModel.isTranscribing || viewModel.isParsing)

                CaptureAffordance(systemImage: "camera.fill", label: "Photo", available: false)
            }

            if viewModel.isTranscribing {
                HStack(spacing: 8) {
                    ProgressView()
                    Text("Transcribing…")
                        .font(ContempoFont.labelSmall())
                        .foregroundStyle(palette.inkFaint)
                }
            }

            if let finalizedTranscript = viewModel.finalizedTranscript {
                VStack(alignment: .leading, spacing: 10) {
                    Text("Here's what we heard")
                        .font(ContempoFont.titleMedium())
                    Text(finalizedTranscript)
                        .font(ContempoFont.bodyLarge())

                    if viewModel.isParsing {
                        HStack(spacing: 8) {
                            ProgressView()
                            Text(stageLabel(viewModel.parsingStage))
                                .font(ContempoFont.labelSmall())
                                .foregroundStyle(palette.inkFaint)
                        }
                    }

                    HStack {
                        Button("Try again") { viewModel.discardTranscript() }
                            .buttonStyle(.bordered)
                        Spacer()
                        Button("Looks good — continue") {
                            viewModel.confirmTranscript(onDrafted: onDrafted)
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(palette.pine)
                        .disabled(viewModel.isParsing)
                    }
                }
                .padding()
                .background(palette.paperRaised)
                .clipShape(RoundedRectangle(cornerRadius: ContempoRadius.large))
            }

            VStack(alignment: .leading, spacing: 8) {
                Text("Type what you did")
                    .font(ContempoFont.titleMedium())
                TextEditor(text: $viewModel.inputText)
                    .frame(minHeight: 120)
                    .padding(8)
                    .background(palette.paperRaised)
                    .clipShape(RoundedRectangle(cornerRadius: ContempoRadius.medium))
                    .overlay(
                        RoundedRectangle(cornerRadius: ContempoRadius.medium)
                            .stroke(palette.hairline, lineWidth: 1)
                    )

                if viewModel.isParsing {
                    HStack(spacing: 8) {
                        ProgressView()
                        Text(stageLabel(viewModel.parsingStage))
                            .font(ContempoFont.labelSmall())
                            .foregroundStyle(palette.inkFaint)
                    }
                }

                if let errorMessage = viewModel.errorMessage {
                    Text(errorMessage).foregroundStyle(palette.danger)
                }

                HStack {
                    Button("Enter manually") {
                        viewModel.manualEntry(onDrafted: onDrafted)
                    }
                    .buttonStyle(.bordered)

                    Spacer()

                    Button {
                        viewModel.submit(onDrafted: onDrafted)
                    } label: {
                        Text("Parse & Continue").bold()
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(palette.pine)
                    .disabled(viewModel.isParsing || viewModel.inputText.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
            .padding()
            .background(palette.paperRaised)
            .clipShape(RoundedRectangle(cornerRadius: ContempoRadius.large))

            Spacer()
        }
        .padding()
        .navigationTitle("Capture")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Menu {
                    Button {
                        viewModel.startNewWork()
                    } label: {
                        Label("Start new work", systemImage: "timer")
                    }
                    Button {
                        viewModel.toggleGpsTrip()
                    } label: {
                        Label(viewModel.gpsTripOpen ? "Stop GPS trip" : "Start GPS trip", systemImage: "location.fill")
                    }
                } label: {
                    Label("Other", systemImage: "ellipsis.circle")
                }
            }
        }
    }

    private func stageLabel(_ stage: ParsingStage) -> String {
        switch stage {
        case .idle: return ""
        case .reading: return "Reading…"
        case .tryingOnDevice: return "Trying on-device…"
        case .fallingBackToCloud: return "Falling back to cloud…"
        case .structuring: return "Structuring…"
        }
    }
}

/// The tap-to-complete equivalent of Android's `OngoingWorkBanner` — shown
/// whenever a work timer is open, driven live by `CaptureViewModel.openTimerEntry`.
private struct OngoingWorkBanner: View {
    let entry: Entry
    let onTapToComplete: () -> Void
    @Environment(\.contempoPalette) private var palette

    var body: some View {
        Button(action: onTapToComplete) {
            HStack(spacing: 12) {
                Image(systemName: "timer")
                    .foregroundStyle(palette.pine)
                VStack(alignment: .leading, spacing: 2) {
                    Text(entry.task.isEmpty ? (entry.propertyName.isEmpty ? "Work in progress" : entry.propertyName) : entry.task)
                        .font(ContempoFont.labelLarge())
                    Text(entry.activityDate.dateValue(), style: .timer)
                        .font(ContempoFont.labelSmall())
                        .foregroundStyle(palette.inkFaint)
                }
                Spacer()
                Text("Tap to complete")
                    .font(ContempoFont.labelSmall())
                    .foregroundStyle(palette.pine)
            }
            .padding()
            .contempoGlass(tint: palette.pine, in: RoundedRectangle(cornerRadius: ContempoRadius.medium))
        }
        .buttonStyle(.plain)
    }
}

/// The tap-to-stop equivalent of Android's `OngoingTripBanner`, GPS trips
/// only — an odometer-photo trip has no toggle here since photo capture
/// itself is still a disabled placeholder (see `CaptureAffordance`).
private struct OngoingTripBanner: View {
    let entry: Entry
    let isGps: Bool
    let onTap: () -> Void
    @Environment(\.contempoPalette) private var palette

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 12) {
                Image(systemName: "location.fill")
                    .foregroundStyle(palette.pine)
                Text(String(format: "Trip in progress — %.2f mi", entry.miles))
                    .font(ContempoFont.labelLarge())
                Spacer()
                if isGps {
                    Text("Tap to stop")
                        .font(ContempoFont.labelSmall())
                        .foregroundStyle(palette.pine)
                }
            }
            .padding()
            .contempoGlass(tint: palette.pine, in: RoundedRectangle(cornerRadius: ContempoRadius.medium))
        }
        .buttonStyle(.plain)
        .disabled(!isGps)
    }
}

private struct CaptureAffordance: View {
    let systemImage: String
    let label: String
    let available: Bool
    @Environment(\.contempoPalette) private var palette

    var body: some View {
        VStack(spacing: 6) {
            Image(systemName: systemImage)
                .font(.system(size: 32))
                .frame(width: 72, height: 72)
                .background(.ultraThinMaterial, in: Circle())
                .foregroundStyle(available ? palette.pine : palette.inkFaint)
            Text(label)
                .font(ContempoFont.labelSmall())
                .foregroundStyle(palette.inkFaint)
        }
        .opacity(available ? 1 : 0.5)
    }
}

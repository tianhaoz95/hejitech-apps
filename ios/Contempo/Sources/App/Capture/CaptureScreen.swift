import ContempoCore
import ContempoFirestore
import SwiftUI

struct CaptureScreen: View {
    let onDrafted: (ConfirmParams) -> Void
    @State private var viewModel = CaptureViewModel()
    @State private var typeExpanded = false
    @State private var showQuickCaptureExplanation = false
    @Environment(\.contempoPalette) private var palette

    private var busy: Bool {
        viewModel.isRecording || viewModel.isTranscribing || viewModel.isParsing || viewModel.finalizedTranscript != nil
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                HStack {
                    Eyebrow("Capture")
                    Spacer()
                }

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

                if typeExpanded {
                    // Typed Mode Escape Hatch
                    VStack(alignment: .leading, spacing: 12) {
                        HStack {
                            Button {
                                typeExpanded = false
                            } label: {
                                Image(systemName: "arrow.left")
                                    .font(.title3)
                                    .foregroundStyle(palette.inkSoft)
                            }
                            .buttonStyle(.plain)
                            .disabled(busy)

                            Text("Type what you did")
                                .font(ContempoFont.titleMedium())
                                .foregroundStyle(palette.ink)
                            Spacer()
                        }

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
                            Text(errorMessage).foregroundStyle(palette.danger).font(ContempoFont.labelSmall())
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
                    .padding(20)
                    .background(palette.paperRaised)
                    .clipShape(RoundedRectangle(cornerRadius: ContempoRadius.large))
                    .overlay(
                        RoundedRectangle(cornerRadius: ContempoRadius.large)
                            .stroke(palette.hairline, lineWidth: 1)
                    )
                } else {
                    // Voice Primary Mode
                    VStack(spacing: 20) {
                        VoiceButton(
                            isRecording: viewModel.isRecording,
                            isThinking: viewModel.isTranscribing || viewModel.isParsing,
                            amplitude: viewModel.recordingAmplitude
                        ) {
                            Task {
                                if viewModel.isRecording {
                                    if viewModel.quickCaptureEnabled {
                                        viewModel.stopQuickCaptureAndSave()
                                    } else {
                                        await viewModel.stopRecordingAndProcess()
                                    }
                                } else {
                                    await viewModel.startRecording()
                                }
                            }
                        }
                        .disabled(viewModel.isTranscribing || viewModel.isParsing)

                        if viewModel.isRecording {
                            RecordingIndicator("Listening…")
                        } else if viewModel.isTranscribing {
                            ThinkingIndicator("Transcribing…")
                        } else if viewModel.isParsing {
                            ThinkingIndicator(stageLabel(viewModel.parsingStage))
                        } else {
                            Text("Tap to speak")
                                .font(ContempoFont.titleMedium())
                                .foregroundStyle(palette.inkSoft)
                        }

                        if let finalizedTranscript = viewModel.finalizedTranscript {
                            VStack(alignment: .leading, spacing: 10) {
                                Text("Here's what we heard")
                                    .font(ContempoFont.titleMedium())
                                Text(finalizedTranscript)
                                    .font(ContempoFont.bodyLarge())

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
                            .overlay(
                                RoundedRectangle(cornerRadius: ContempoRadius.large)
                                    .stroke(palette.hairline, lineWidth: 1)
                            )
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
                            .padding(.horizontal)
                        }

                        // Controls Bar
                        VStack(spacing: 14) {
                            HStack {
                                HStack(spacing: 6) {
                                    Text("Quick Capture")
                                        .font(ContempoFont.labelLarge())
                                        .foregroundStyle(palette.ink)

                                    Button {
                                        showQuickCaptureExplanation = true
                                    } label: {
                                        Image(systemName: "info.circle")
                                            .foregroundStyle(palette.inkSoft)
                                    }
                                    .buttonStyle(.plain)
                                }

                                Spacer()

                                Toggle("", isOn: Binding(
                                    get: { viewModel.quickCaptureEnabled },
                                    set: { viewModel.quickCaptureEnabled = $0 }
                                ))
                                .labelsHidden()
                                .tint(palette.pine)
                            }

                            if viewModel.quickCaptureEnabled || viewModel.quickCaptureStatus.hasAnything {
                                QuickCaptureStatusRow(
                                    status: viewModel.quickCaptureStatus,
                                    onProcessNow: { viewModel.processQuickCaptureBacklogNow() }
                                )
                            }

                            HStack(spacing: 20) {
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
                                    HStack(spacing: 6) {
                                        Image(systemName: "ellipsis.circle")
                                        Text(viewModel.gpsTripOpen ? "Trip in progress" : "Other options")
                                            .font(ContempoFont.labelSmall())
                                    }
                                    .foregroundStyle(viewModel.gpsTripOpen ? palette.pine : palette.inkSoft)
                                }

                                Spacer()

                                Button {
                                    typeExpanded = true
                                } label: {
                                    HStack(spacing: 6) {
                                        Image(systemName: "keyboard")
                                        Text("Type instead")
                                            .font(ContempoFont.labelSmall())
                                    }
                                    .foregroundStyle(palette.inkSoft)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        .padding()
                        .background(palette.paperRaised)
                        .clipShape(RoundedRectangle(cornerRadius: ContempoRadius.medium))
                        .overlay(
                            RoundedRectangle(cornerRadius: ContempoRadius.medium)
                                .stroke(palette.hairline, lineWidth: 1)
                        )
                    }
                }

                if let errorMessage = viewModel.errorMessage {
                    Text(errorMessage)
                        .font(ContempoFont.labelSmall())
                        .foregroundStyle(palette.danger)
                }

                Spacer()
            }
            .padding(20)
        }
        .navigationTitle("Capture")
        .sheet(isPresented: $showQuickCaptureExplanation) {
            QuickCaptureExplanationSheet()
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

private struct QuickCaptureStatusRow: View {
    let status: QuickCaptureStatusUiState
    let onProcessNow: () -> Void

    @Environment(\.contempoPalette) private var palette

    var body: some View {
        HStack(spacing: 12) {
            if let stage = status.processingStage {
                ProgressView()
                    .controlSize(.small)
                Text(stage.rawValue)
                    .font(ContempoFont.labelSmall())
                    .foregroundStyle(palette.pine)
            } else {
                HStack(spacing: 8) {
                    if status.pendingCount > 0 {
                        Text("Pending: \(status.pendingCount)")
                            .font(ContempoFont.labelSmall())
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(palette.brass.opacity(0.15))
                            .foregroundStyle(palette.brass)
                            .clipShape(Capsule())
                    }
                    if status.completedTodayCount > 0 {
                        Text("Done today: \(status.completedTodayCount)")
                            .font(ContempoFont.labelSmall())
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(palette.pine.opacity(0.15))
                            .foregroundStyle(palette.pine)
                            .clipShape(Capsule())
                    }
                }
            }

            Spacer()

            if status.pendingCount > 0 && status.processingStage == nil {
                Button("Sync now", action: onProcessNow)
                    .font(ContempoFont.labelSmall())
                    .foregroundStyle(palette.pine)
            }
        }
        .padding(10)
        .background(palette.paperRaised)
        .clipShape(RoundedRectangle(cornerRadius: ContempoRadius.medium))
    }
}

private struct QuickCaptureExplanationSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.contempoPalette) private var palette

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Text("About Quick Capture")
                    .font(ContempoFont.titleLarge())
                    .foregroundStyle(palette.ink)
                Spacer()
                Button {
                    dismiss()
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.title2)
                        .foregroundStyle(palette.inkSoft)
                }
                .buttonStyle(.plain)
            }

            Text("Quick Capture lets you record multiple voice notes in rapid succession without waiting for on-device transcription or AI structuring.")
                .font(ContempoFont.bodyMedium())
                .foregroundStyle(palette.ink)

            VStack(alignment: .leading, spacing: 12) {
                Label("Recorded notes are saved locally to disk instantly.", systemImage: "bolt.fill")
                Label("Notes are uploaded in the background to your queue.", systemImage: "arrow.clockwise.icloud")
                Label("On-device AI transcribes and converts notes into entries asynchronously.", systemImage: "sparkles")
            }
            .font(ContempoFont.bodySmall())
            .foregroundStyle(palette.inkSoft)

            Spacer()

            Button("Got it") {
                dismiss()
            }
            .buttonStyle(.borderedProminent)
            .tint(palette.pine)
            .frame(maxWidth: .infinity)
        }
        .padding(24)
        .background(palette.paper)
    }
}

/// Hero VoiceButton: fixed 180pt circular button with animated volume bars during recording
private struct VoiceButton: View {
    let isRecording: Bool
    let isThinking: Bool
    let amplitude: Float
    let onClick: () -> Void

    @Environment(\.contempoPalette) private var palette

    private var buttonColor: Color {
        if isRecording { return palette.danger }
        if isThinking { return palette.brass }
        return palette.pine
    }

    var body: some View {
        ZStack {
            if isThinking {
                ProgressView()
                    .scaleEffect(2.2)
                    .frame(width: 200, height: 200)
            }

            Button(action: onClick) {
                ZStack {
                    Circle()
                        .fill(buttonColor)
                        .frame(width: 180, height: 180)
                        .shadow(color: buttonColor.opacity(0.3), radius: 12, x: 0, y: 6)

                    if isRecording {
                        VolumeBars(amplitude: amplitude, color: .white)
                    } else {
                        Image(systemName: "mic.fill")
                            .font(.system(size: 64, weight: .semibold))
                            .foregroundStyle(.white)
                    }
                }
            }
            .buttonStyle(.plain)
            .disabled(isThinking)
        }
    }
}

private struct VolumeBars: View {
    let amplitude: Float
    let color: Color

    var body: some View {
        HStack(alignment: .bottom, spacing: 6) {
            ForEach(0..<5, id: \.self) { index in
                VolumeBar(amplitude: amplitude, index: index, color: color)
            }
        }
        .frame(height: 48)
    }
}

private struct VolumeBar: View {
    let amplitude: Float
    let index: Int
    let color: Color
    @State private var phase: CGFloat = 0.25

    var body: some View {
        let fraction = min(1.0, max(0.15, phase * (0.45 + CGFloat(amplitude) * 0.75)))
        RoundedRectangle(cornerRadius: 3)
            .fill(color)
            .frame(width: 6, height: 48 * fraction)
            .onAppear {
                let duration = 0.42 + Double(index) * 0.09
                withAnimation(.linear(duration: duration).repeatForever(autoreverses: true)) {
                    phase = 1.0
                }
            }
    }
}

private struct ThinkingIndicator: View {
    let text: String
    @Environment(\.contempoPalette) private var palette

    init(_ text: String) { self.text = text }

    var body: some View {
        HStack(spacing: 8) {
            ProgressView()
            Text(text)
                .font(ContempoFont.labelSmall())
                .foregroundStyle(palette.brass)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 6)
        .background(palette.brassTint, in: Capsule())
    }
}

private struct OngoingWorkBanner: View {
    let entry: Entry
    let onTapToComplete: () -> Void
    @Environment(\.contempoPalette) private var palette

    var body: some View {
        Button(action: onTapToComplete) {
            HStack(spacing: 12) {
                Image(systemName: "timer")
                    .font(.title2)
                    .foregroundStyle(palette.pine)
                VStack(alignment: .leading, spacing: 2) {
                    Text(entry.task.isEmpty ? (entry.propertyName.isEmpty ? "Work in progress" : entry.propertyName) : entry.task)
                        .font(ContempoFont.labelLarge())
                        .foregroundStyle(palette.ink)
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
            .background(palette.pineTint)
            .clipShape(RoundedRectangle(cornerRadius: ContempoRadius.medium))
            .overlay(
                RoundedRectangle(cornerRadius: ContempoRadius.medium)
                    .stroke(palette.pine.opacity(0.3), lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }
}

private struct OngoingTripBanner: View {
    let entry: Entry
    let isGps: Bool
    let onTap: () -> Void
    @Environment(\.contempoPalette) private var palette

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 12) {
                Image(systemName: "location.fill")
                    .font(.title2)
                    .foregroundStyle(palette.pine)
                Text(String(format: "Trip in progress — %.2f mi", entry.miles))
                    .font(ContempoFont.labelLarge())
                    .foregroundStyle(palette.ink)
                Spacer()
                if isGps {
                    Text("Tap to stop")
                        .font(ContempoFont.labelSmall())
                        .foregroundStyle(palette.pine)
                }
            }
            .padding()
            .background(palette.pineTint)
            .clipShape(RoundedRectangle(cornerRadius: ContempoRadius.medium))
            .overlay(
                RoundedRectangle(cornerRadius: ContempoRadius.medium)
                    .stroke(palette.pine.opacity(0.3), lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .disabled(!isGps)
    }
}

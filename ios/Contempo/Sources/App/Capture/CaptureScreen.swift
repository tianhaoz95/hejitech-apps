import ContempoCore
import ContempoFirestore
import SwiftUI

struct CaptureScreen: View {
    let onDrafted: (ConfirmParams) -> Void
    @State private var viewModel = CaptureViewModel()
    @State private var typeExpanded = false
    @State private var showQuickCaptureExplanation = false
    @State private var showHelpWalkthrough = false
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
                    Button {
                        showHelpWalkthrough = true
                    } label: {
                        Image(systemName: "questionmark.circle")
                            .font(.title3)
                            .foregroundStyle(palette.inkSoft)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Help & walkthrough")
                }

                if let tripEntry = viewModel.openTripEntry {
                    OngoingTripBanner(
                        entry: tripEntry,
                        isGps: viewModel.gpsTripOpen,
                        onTap: { viewModel.toggleGpsTrip() },
                        onPauseToggle: {
                            if tripEntry.isPaused == true { viewModel.resumeTrip() } else { viewModel.pauseTrip() }
                        }
                    )
                }

                if let timerEntry = viewModel.openTimerEntry {
                    OngoingWorkBanner(
                        entry: timerEntry,
                        onTapToComplete: { viewModel.completeOpenTimer() },
                        onPauseToggle: {
                            if timerEntry.isPaused == true { viewModel.resumeWork() } else { viewModel.pauseWork() }
                        }
                    )
                }

                if typeExpanded {
                    // Typed Mode Escape Hatch — ContempoCard rather than
                    // hand-rolled background/clipShape/overlay, so this stays
                    // in sync with every other card on the app automatically.
                    ContempoCard {
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

                            ZStack(alignment: .topLeading) {
                                // TextEditor has no built-in placeholder —
                                // overlay one manually, matching Android's
                                // capture_hint copy/behavior.
                                if viewModel.inputText.isEmpty {
                                    Text("Say or type what you did…")
                                        .font(ContempoFont.bodyLarge())
                                        .foregroundStyle(palette.inkFaint)
                                        .padding(.horizontal, 13)
                                        .padding(.vertical, 16)
                                        .allowsHitTesting(false)
                                }
                                TextEditor(text: $viewModel.inputText)
                                    .font(ContempoFont.bodyLarge())
                                    .frame(minHeight: 120)
                                    .padding(8)
                                    .scrollContentBackground(.hidden)
                            }
                            // A recessed tone (paper, not paperRaised) so the
                            // field reads as inset within the card rather than
                            // blending into it.
                            .background(palette.paper)
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
                                    typeExpanded = false
                                    viewModel.manualEntry(onDrafted: onDrafted)
                                }
                                .buttonStyle(.bordered)

                                Spacer()

                                Button {
                                    typeExpanded = false
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
                    }
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

                        // Quick actions for the two other primary capture modes
                        // — promoted out of the "Other options" menu so they're
                        // discoverable without an extra tap, but sized well
                        // below the hero VoiceButton so voice stays visually
                        // primary. Each hides once its own ongoing-session
                        // banner is showing above, since the banner already
                        // owns that mode's stop/complete affordance.
                        HStack(spacing: 24) {
                            if viewModel.openTimerEntry == nil {
                                QuickActionButton(icon: "timer", label: "Start Work") {
                                    viewModel.startNewWork()
                                }
                                .disabled(viewModel.isTranscribing || viewModel.isParsing)
                            }
                            if viewModel.openTripEntry == nil {
                                QuickActionButton(icon: "location.fill", label: "Start Trip") {
                                    viewModel.toggleGpsTrip()
                                }
                                .disabled(viewModel.isTranscribing || viewModel.isParsing)
                            }

                            // Same size/shape as the buttons above so it
                            // reads as part of the same row, but left in its
                            // original neutral tint rather than the pine
                            // accent — this is an escape hatch out of voice
                            // capture, not another primary capture mode.
                            QuickActionButton(
                                icon: "keyboard",
                                label: "Type instead",
                                tint: palette.inkSoft,
                                tintBackground: palette.paperRaised
                            ) {
                                typeExpanded = true
                            }
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
        .sheet(isPresented: $showHelpWalkthrough) {
            HelpWalkthroughSheet()
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

/// Smaller companion to `VoiceButton` (64pt vs. its 180pt) for the two other
/// primary capture modes — big enough to read as a main action, not a
/// secondary/overflow one, while still keeping voice capture visually
/// dominant.
private struct QuickActionButton: View {
    let icon: String
    let label: String
    var tint: Color?
    var tintBackground: Color?
    let action: () -> Void

    @Environment(\.contempoPalette) private var palette

    var body: some View {
        Button(action: action) {
            // Fixed width (rather than sizing to the label's own text) so all
            // three buttons in the row line up as a uniform, centered group
            // regardless of label length — "Type instead" is wider than
            // "Start Work"/"Start Trip", so without this the icon circles
            // read as unevenly placed even though the HStack itself is
            // already centered in its parent.
            VStack(spacing: 6) {
                ZStack {
                    Circle()
                        .fill(tintBackground ?? palette.pineTint)
                        .frame(width: 64, height: 64)
                    Image(systemName: icon)
                        .font(.system(size: 24, weight: .semibold))
                        .foregroundStyle(tint ?? palette.pine)
                }
                Text(label)
                    .font(ContempoFont.labelSmall())
                    .foregroundStyle(palette.inkSoft)
                    .multilineTextAlignment(.center)
                    .lineLimit(2)
            }
            .frame(width: 84)
        }
        .buttonStyle(.plain)
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
    let onPauseToggle: () -> Void
    @Environment(\.contempoPalette) private var palette

    private var isPaused: Bool { entry.isPaused == true }

    var body: some View {
        // A plain container with `.onTapGesture` (rather than wrapping the
        // whole thing in a `Button`, as before) so the trailing pause/resume
        // `Button` can be a normal sibling control — nesting a real `Button`
        // inside another `Button`'s label is unsupported/flaky in SwiftUI.
        HStack(spacing: 12) {
            Image(systemName: "timer")
                .font(.title2)
                .foregroundStyle(palette.pine)
            VStack(alignment: .leading, spacing: 2) {
                Text(entry.task.isEmpty ? (entry.propertyName.isEmpty ? "Work in progress" : entry.propertyName) : entry.task)
                    .font(ContempoFont.labelLarge())
                    .foregroundStyle(palette.ink)
                elapsedText
                    .font(ContempoFont.labelSmall())
                    .foregroundStyle(palette.inkFaint)
            }
            Spacer()
            if isPaused {
                Text("Paused")
                    .font(ContempoFont.labelSmall())
                    .foregroundStyle(palette.pine)
            } else {
                Text("Tap to complete")
                    .font(ContempoFont.labelSmall())
                    .foregroundStyle(palette.pine)
            }
            Button(action: onPauseToggle) {
                Image(systemName: isPaused ? "play.fill" : "pause.fill")
                    .foregroundStyle(palette.pine)
            }
            .buttonStyle(.plain)
        }
        .padding()
        .background(palette.pineTint)
        .clipShape(RoundedRectangle(cornerRadius: ContempoRadius.medium))
        .overlay(
            RoundedRectangle(cornerRadius: ContempoRadius.medium)
                .stroke(palette.pine.opacity(0.3), lineWidth: 1)
        )
        .contentShape(Rectangle())
        .onTapGesture(perform: onTapToComplete)
    }

    /// Ticks live via `Text(date, style: .timer)` when running (the anchor is
    /// shifted forward by the accumulated paused duration so it reads correct
    /// *active* elapsed time). Frozen as static text while paused, mirroring
    /// TimerLiveActivity's same calculation.
    @ViewBuilder
    private var elapsedText: some View {
        let pausedDurationSeconds = Double(entry.pausedDurationSeconds ?? 0)
        if isPaused, let pausedAt = entry.pausedAt?.dateValue() {
            let frozen = max(0, pausedAt.timeIntervalSince(entry.activityDate.dateValue()) - pausedDurationSeconds)
            Text(formatElapsedDuration(frozen))
        } else {
            Text(entry.activityDate.dateValue().addingTimeInterval(pausedDurationSeconds), style: .timer)
        }
    }
}

private func formatElapsedDuration(_ seconds: TimeInterval) -> String {
    let total = Int(seconds)
    let hours = total / 3600
    let minutes = (total % 3600) / 60
    let secs = total % 60
    return hours > 0 ? String(format: "%d:%02d:%02d", hours, minutes, secs) : String(format: "%d:%02d", minutes, secs)
}

private struct OngoingTripBanner: View {
    let entry: Entry
    let isGps: Bool
    let onTap: () -> Void
    let onPauseToggle: () -> Void
    @Environment(\.contempoPalette) private var palette

    private var isPaused: Bool { entry.isPaused == true }

    var body: some View {
        // Same restructuring as OngoingWorkBanner — a plain container with
        // `.onTapGesture` plus a sibling pause/resume `Button`, not a Button
        // wrapping everything.
        HStack(spacing: 12) {
            Image(systemName: "location.fill")
                .font(.title2)
                .foregroundStyle(palette.pine)
            Text(String(format: "Trip in progress — %.2f mi", entry.miles))
                .font(ContempoFont.labelLarge())
                .foregroundStyle(palette.ink)
            Spacer()
            if isPaused {
                Text("Paused")
                    .font(ContempoFont.labelSmall())
                    .foregroundStyle(palette.pine)
            } else if isGps {
                Text("Tap to stop")
                    .font(ContempoFont.labelSmall())
                    .foregroundStyle(palette.pine)
            }
            Button(action: onPauseToggle) {
                Image(systemName: isPaused ? "play.fill" : "pause.fill")
                    .foregroundStyle(palette.pine)
            }
            .buttonStyle(.plain)
        }
        .padding()
        .background(palette.pineTint)
        .clipShape(RoundedRectangle(cornerRadius: ContempoRadius.medium))
        .overlay(
            RoundedRectangle(cornerRadius: ContempoRadius.medium)
                .stroke(palette.pine.opacity(0.3), lineWidth: 1)
        )
        .contentShape(Rectangle())
        .onTapGesture {
            if isGps { onTap() }
        }
    }
}

import ContempoCore
import SwiftUI

/// A small, self-contained "dictate into this field" mic button — reused
/// anywhere plain typed text needs a voice shortcut (TypedCaptureHero here,
/// and EntryDetailScreen's property/task fields), distinct from the main
/// VoiceButton's full record -> transcribe -> LLM-parse-into-entry flow:
/// this only ever produces raw transcript text, appended into whatever's
/// already typed, and never touches CaptureViewModel's parse pipeline. Owns
/// its own recording lifecycle locally (via ServiceLocator's shared
/// AudioRecorder/WhisperTranscriber singletons) rather than routing through
/// a view model, since it needs to work identically from two unrelated view
/// models (CaptureViewModel, EntryDetailViewModel) — see
/// CaptureViewModel.stopRecordingAndProcess for the equivalent record/
/// transcribe call sequence this mirrors, minus the parse step.
struct DictationButton: View {
    @Binding var text: String
    let language: CaptureLanguage
    var enabled: Bool = true

    @State private var isRecording = false
    @State private var isTranscribing = false
    @State private var showPermissionAlert = false
    @State private var showEmptyTranscriptAlert = false
    @Environment(\.contempoPalette) private var palette

    private let audioRecorder = ServiceLocator.audioRecorder
    private let whisperTranscriber = ServiceLocator.whisperTranscriber

    var body: some View {
        Button {
            Task { await toggle() }
        } label: {
            if isTranscribing {
                ProgressView()
                    .controlSize(.small)
            } else {
                Image(systemName: "mic.fill")
                    .foregroundStyle(isRecording ? palette.danger : palette.inkSoft)
            }
        }
        .buttonStyle(.plain)
        .disabled(!enabled || isTranscribing)
        .accessibilityLabel(isRecording ? "Stop voice dictation" : "Start voice dictation")
        .alert("Microphone access is off", isPresented: $showPermissionAlert) {
            Button("OK") {}
        } message: {
            Text("Enable microphone access in Settings to dictate.")
        }
        .alert("Didn't catch any words", isPresented: $showEmptyTranscriptAlert) {
            Button("OK") {}
        } message: {
            Text("Try again.")
        }
    }

    private func toggle() async {
        if isRecording {
            isRecording = false
            isTranscribing = true
            let samples = audioRecorder.stop()
            let transcript = await whisperTranscriber.transcribe(samples: samples, language: language)
            isTranscribing = false
            guard !transcript.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
                showEmptyTranscriptAlert = true
                return
            }
            let separator = (text.isEmpty || text.hasSuffix(" ") || text.hasSuffix("\n")) ? "" : " "
            text += separator + transcript
        } else {
            guard await audioRecorder.hasPermission() else {
                showPermissionAlert = true
                return
            }
            do {
                try audioRecorder.start()
                isRecording = true
            } catch {
                // Best-effort — button just stays idle; the main VoiceButton
                // flow has the same silent-failure behavior for a start()
                // throw (see CaptureViewModel.startRecording's errorMessage,
                // which this small inline button has no room to surface).
            }
        }
    }
}

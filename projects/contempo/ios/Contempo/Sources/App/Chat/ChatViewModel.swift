import ContempoCore
import ContempoData
import Foundation
import Observation

/// The legal-question copilot. Voice input auto-sends with no confirm step
/// (unlike Capture's "here's what we heard" card) — a chat question is much
/// lower-stakes than a work-log entry, so there's nothing worth holding for
/// review. History is in-memory only, never persisted.
@Observable
@MainActor
final class ChatViewModel {
    private let agentClient = ServiceLocator.agentClient
    private let entryRepository = ServiceLocator.entryRepository
    private let audioRecorder = ServiceLocator.audioRecorder
    private let whisperTranscriber = ServiceLocator.whisperTranscriber
    private let captureLanguageStore = ServiceLocator.captureLanguageStore
    private let onDeviceLlm = ServiceLocator.onDeviceLlm

    var messages: [ChatMessage] = []
    /// Typing "@" opens the same entry picker the attach menu's "Attach
    /// entry" item does — detected as "@" newly appearing as the single
    /// just-typed character (length grew by exactly one and it wasn't the
    /// last character a moment ago), so pasting a longer string containing
    /// "@" mid-text or backspacing into one doesn't retrigger it.
    var inputText = "" {
        didSet {
            guard inputText.count == oldValue.count + 1, inputText.hasSuffix("@"), !oldValue.hasSuffix("@") else { return }
            openEntryPicker(triggeredByAtSymbol: true)
        }
    }
    var isRecording = false
    var isTranscribing = false
    var isSending = false
    /// The in-progress answer bubble while an on-device stream is running — nil once it finishes and joins `messages`.
    var streamingText: String?
    var streamingChunkCount = 0
    var pendingImageData: Data?
    /// Entries the host attached via the "@ Attach entry" picker to ask an entry-specific question — cleared after send, same as pendingImageData.
    var pendingEntries: [Entry] = []
    var showEntryPicker = false
    var availableEntries: [Entry] = []
    /// True when showEntryPicker was opened by typing "@" rather than
    /// tapping the attach menu's "Attach entry" item — only then does
    /// attachEntry strip the trailing "@" back out of inputText, so a
    /// deliberately-typed "@" left untouched (picker dismissed without
    /// picking) isn't silently eaten.
    private var entryPickerTriggeredByAtSymbol = false
    var errorMessage: String?

    var recordingAmplitude: Float { audioRecorder.amplitude }
    var currentAiAvailability: AiAvailability {
        aiAvailability(bundledModelReady: onDeviceLlm.bundledModelReady, onDeviceStatus: onDeviceLlm.status)
    }
    var canSend: Bool {
        (!inputText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || pendingImageData != nil || !pendingEntries.isEmpty)
            && !isSending && !isRecording && !isTranscribing && currentAiAvailability == .ready
    }

    func attachImage(_ data: Data) {
        pendingImageData = data
    }

    func removeAttachedImage() {
        pendingImageData = nil
    }

    /// Loads the host's entries fresh each time so a just-logged entry is selectable immediately.
    func openEntryPicker(triggeredByAtSymbol: Bool = false) {
        showEntryPicker = true
        entryPickerTriggeredByAtSymbol = triggeredByAtSymbol
        Task {
            availableEntries = (try? await entryRepository.observeEntries().first { _ in true }) ?? []
        }
    }

    func dismissEntryPicker() {
        // Deliberately leaves inputText untouched — a typed "@" only gets
        // stripped on a successful attach (see attachEntry), not on dismiss,
        // so backing out of the picker never silently eats what was typed.
        showEntryPicker = false
        entryPickerTriggeredByAtSymbol = false
    }

    func attachEntry(_ entry: Entry) {
        if entryPickerTriggeredByAtSymbol, inputText.hasSuffix("@") {
            inputText.removeLast()
        }
        entryPickerTriggeredByAtSymbol = false
        showEntryPicker = false
        guard !pendingEntries.contains(where: { $0.id == entry.id }) else { return }
        pendingEntries.append(entry)
    }

    func removeAttachedEntry(_ entry: Entry) {
        pendingEntries.removeAll { $0.id == entry.id }
    }

    func startRecording() async {
        guard !isRecording, await audioRecorder.hasPermission() else { return }
        errorMessage = nil
        do {
            try audioRecorder.start()
            isRecording = true
        } catch {
            errorMessage = "Couldn't start recording — try again."
        }
    }

    /// Stop -> transcribe -> cleanup -> send immediately, no confirm step.
    func stopRecordingAndSend() async {
        guard isRecording else { return }
        isRecording = false
        isTranscribing = true
        let samples = audioRecorder.stop()
        let rawTranscript = await whisperTranscriber.transcribe(samples: samples, language: captureLanguageStore.selected)
        guard !rawTranscript.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            isTranscribing = false
            errorMessage = "Didn't catch that — try again."
            return
        }
        let cleaned = await agentClient.cleanupTranscript(rawTranscript)
        isTranscribing = false
        inputText = cleaned
        send()
    }

    func sendPrompt(_ prompt: String) {
        inputText = prompt
        send()
    }

    func send() {
        let text = inputText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty || pendingImageData != nil || !pendingEntries.isEmpty else { return }
        let imageData = pendingImageData
        let attachedEntries = pendingEntries
        // A photo/attached-entries-only send with no typed question is still
        // valid (e.g. "what's this?" implied by the photo, or "how many
        // hours is this?" implied by the attached entry) — give the model
        // something to answer.
        let effectiveText = text.isEmpty && !attachedEntries.isEmpty
            ? "Tell me about the attached entr\(attachedEntries.count == 1 ? "y" : "ies")."
            : text
        messages.append(ChatMessage(role: .user, text: effectiveText, imageData: imageData))
        inputText = ""
        pendingImageData = nil
        pendingEntries = []
        isSending = true
        errorMessage = nil

        Task {
            let stats = await currentStats()
            let history = messages
            if let imageData {
                let outcome = await agentClient.askQuestion(history: history, question: effectiveText, stats: stats, imageData: imageData, attachedEntries: attachedEntries)
                apply(outcome)
                return
            }
            // Streaming is on-device/local generation only — cloud askAgent
            // is single-shot, so a cloud answer just appears whole once it
            // returns rather than growing token by token.
            streamingText = ""
            streamingChunkCount = 0
            let outcome = await agentClient.askQuestionStream(history: history, question: effectiveText, stats: stats, attachedEntries: attachedEntries) { [weak self] event in
                guard let self else { return }
                switch event {
                case .prefilling:
                    self.streamingText = ""
                case .streaming(let textSoFar, let chunkCount):
                    self.streamingText = textSoFar
                    self.streamingChunkCount = chunkCount
                }
            }
            streamingText = nil
            apply(outcome)
        }
    }

    private func apply(_ outcome: AskOutcome) {
        isSending = false
        switch outcome {
        case .success(let answer, _):
            messages.append(ChatMessage(role: .agent, text: answer))
        case .failure(let message):
            errorMessage = message
        }
    }

    private func currentStats() async -> UserStats {
        let entries = (try? await entryRepository.observeEntries().first { _ in true }) ?? []
        // The same figure as the Dashboard: the owner's confirmed hours this tax year.
        let confirmedHours = TestYearProgress.compute(from: entries).ownerHours
        return UserStats(confirmedHours: confirmedHours, thresholdHours: MaterialParticipationTest.thresholdHours, testName: MaterialParticipationTest.name)
    }

    func clearHistory() {
        messages = []
    }
}

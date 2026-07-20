import ContempoCore
import ContempoFirestore
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
    private let aiSettingsStore = ServiceLocator.aiSettingsStore
    private let onDeviceLlm = ServiceLocator.onDeviceLlm

    var messages: [ChatMessage] = []
    var inputText = ""
    var isRecording = false
    var isTranscribing = false
    var isSending = false
    /// The in-progress answer bubble while an on-device stream is running — nil once it finishes and joins `messages`.
    var streamingText: String?
    var streamingChunkCount = 0
    var pendingImageData: Data?
    var errorMessage: String?

    var recordingAmplitude: Float { audioRecorder.amplitude }
    var currentAiAvailability: AiAvailability {
        aiAvailability(preference: aiSettingsStore.preference, onDeviceStatus: onDeviceLlm.status)
    }
    var canSend: Bool {
        (!inputText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || pendingImageData != nil)
            && !isSending && !isRecording && !isTranscribing && currentAiAvailability == .ready
    }

    func attachImage(_ data: Data) {
        pendingImageData = data
    }

    func removeAttachedImage() {
        pendingImageData = nil
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

    func send() {
        let text = inputText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty || pendingImageData != nil else { return }
        let imageData = pendingImageData
        messages.append(ChatMessage(role: .user, text: text, imageData: imageData))
        inputText = ""
        pendingImageData = nil
        isSending = true
        errorMessage = nil

        Task {
            let stats = await currentStats()
            let history = messages
            if let imageData {
                let outcome = await agentClient.askQuestion(history: history, question: text, stats: stats, imageData: imageData)
                apply(outcome)
                return
            }
            // Streaming is on-device/local generation only — cloud askAgent
            // is single-shot, so a cloud answer just appears whole once it
            // returns rather than growing token by token.
            streamingText = ""
            streamingChunkCount = 0
            let outcome = await agentClient.askQuestionStream(history: history, question: text, stats: stats) { [weak self] event in
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
        let confirmedHours = entries.filter { $0.statusEnum == .confirmed }.reduce(0.0) { $0 + Double($1.durationMinutes) } / 60.0
        return UserStats(confirmedHours: confirmedHours, thresholdHours: MaterialParticipationTest.thresholdHours, testName: MaterialParticipationTest.name)
    }

    func clearHistory() {
        messages = []
    }
}

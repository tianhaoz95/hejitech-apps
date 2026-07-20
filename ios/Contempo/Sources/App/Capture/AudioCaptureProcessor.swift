import ContempoCore
import ContempoFirestore
import FirebaseFirestore
import FirebaseStorage
import Foundation
import Observation

public enum AudioProcessingStage: String, Sendable {
    case downloading = "Downloading audio"
    case transcribing = "Transcribing voice note"
    case parsing = "Structuring entry"
    case saving = "Saving entry"
}

/// Drains `AudioCaptureQueue` on iOS — processes background voice recordings,
/// runs on-device Whisper transcription + LLM parsing, creates entries,
/// and updates Quick Capture completion statistics.
@Observable
@MainActor
public final class AudioCaptureProcessor {
    public static let shared = AudioCaptureProcessor()

    public private(set) var currentlyProcessingStage: AudioProcessingStage?

    private init() {}

    public func processPendingCaptures() async {
        guard let pending = try? await ServiceLocator.audioCaptureQueue.listPending() else { return }

        for capture in pending {
            do {
                try await processOne(capture)
            } catch {
                // Log and continue to next item in queue
            }
            self.currentlyProcessingStage = nil
        }
    }

    private func processOne(_ capture: PendingAudioCapture) async throws {
        self.currentlyProcessingStage = .downloading
        let storageRef = Storage.storage().reference(withPath: capture.storagePath)

        let maxAudioBytes: Int64 = 50_000_000
        guard let wavBytes = try? await storageRef.data(maxSize: maxAudioBytes) else {
            return
        }

        self.currentlyProcessingStage = .transcribing
        let samples = WavAudio.decode(wavBytes)
        let rawText = (try? await ServiceLocator.whisperTranscriber.transcribe(samples: samples, language: capture.language)) ?? ""

        if rawText.trimmingCharacters(in: CharacterSet.whitespacesAndNewlines).isEmpty {
            try? await removeFromQueue(captureId: capture.id)
            return
        }

        self.currentlyProcessingStage = .parsing
        let audioUrl = (try? await storageRef.downloadURL())?.absoluteString ?? ""
        let knownProperties = (try? await ServiceLocator.entryRepository.observeProperties().first(where: { _ in true }))?.map { $0.name } ?? []

        let outcome = await ServiceLocator.agentClient.parseEntry(rawText: rawText, knownProperties: knownProperties)

        self.currentlyProcessingStage = .saving
        switch outcome {
        case .success(let result):
            await saveFromDraft(result.draft, rawText: rawText, capture: capture, audioUrl: audioUrl)
        case .failure:
            await saveFallback(rawText: rawText, capture: capture, audioUrl: audioUrl)
        }

        try? await removeFromQueue(captureId: capture.id)
    }

    private func saveFromDraft(_ draft: EntryDraft, rawText: String, capture: PendingAudioCapture, audioUrl: String) async {
        let intent = TimerIntentClassifier.classify(rawText) ?? (draft.eventType == "start" ? .start : (draft.eventType == "stop" ? .stop : nil))

        if intent == .start {
            _ = try? await ServiceLocator.timerEntryCoordinator.handleStart(
                property: draft.property,
                task: draft.task,
                category: draft.category,
                source: .voice,
                startedAt: capture.capturedAt
            )
            return
        }

        if intent == .stop {
            let stopped = try? await ServiceLocator.timerEntryCoordinator.handleStop(
                property: draft.property,
                task: draft.task,
                stoppedAt: capture.capturedAt,
                stopLat: capture.lat,
                stopLng: capture.lng
            )
            if stopped != nil { return }
        }

        let duration = draft.durationMinutes ?? 0
        let isComplete = !(draft.property?.isEmpty ?? true) && !(draft.task?.isEmpty ?? true) && duration > 0

        let entry = Entry(
            propertyName: draft.property ?? "",
            task: (draft.task?.isEmpty == false) ? draft.task! : rawText,
            durationMinutes: duration,
            category: draft.category.map { EntryCategory(firestoreValue: $0).firestoreValue } ?? EntryCategory.other.firestoreValue,
            status: isComplete ? EntryStatus.confirmed.firestoreValue : EntryStatus.pendingReview.firestoreValue,
            source: CaptureSource.voice.firestoreValue,
            activityDate: capture.capturedAt,
            loggedAt: Timestamp(),
            confirmedAt: isComplete ? Timestamp() : nil,
            miles: draft.miles ?? 0.0,
            captureLat: capture.lat,
            captureLng: capture.lng,
            audioUrl: audioUrl,
            rawTranscript: rawText
        )
        try? await ServiceLocator.entryRepository.createEntry(entry)
    }

    private func saveFallback(rawText: String, capture: PendingAudioCapture, audioUrl: String) async {
        let entry = Entry(
            task: rawText,
            status: EntryStatus.pendingReview.firestoreValue,
            source: CaptureSource.voice.firestoreValue,
            activityDate: capture.capturedAt,
            loggedAt: Timestamp(),
            captureLat: capture.lat,
            captureLng: capture.lng,
            audioUrl: audioUrl,
            rawTranscript: rawText
        )
        try? await ServiceLocator.entryRepository.createEntry(entry)
    }

    private func removeFromQueue(captureId: String) async throws {
        try await ServiceLocator.audioCaptureQueue.remove(captureId: captureId)
        ServiceLocator.quickCaptureStatsStore.recordCompleted()
    }
}

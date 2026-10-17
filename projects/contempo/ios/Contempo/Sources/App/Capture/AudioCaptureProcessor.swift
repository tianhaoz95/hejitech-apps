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

    @discardableResult
    public func processPendingCaptures(onProgress: ((_ current: Int, _ total: Int, _ stage: AudioProcessingStage) -> Void)? = nil) async -> Int {
        guard let pending = try? await ServiceLocator.audioCaptureQueue.listPending() else { return 0 }
        var processedCount = 0
        let total = pending.count

        for (index, capture) in pending.enumerated() {
            do {
                try await processOne(capture) { stage in
                    onProgress?(index + 1, total, stage)
                }
                processedCount += 1
            } catch {
                // Log and continue to next item in queue
            }
            self.currentlyProcessingStage = nil
        }
        return processedCount
    }

    private func processOne(_ capture: PendingAudioCapture, onStageChange: ((AudioProcessingStage) -> Void)? = nil) async throws {
        self.currentlyProcessingStage = .downloading
        onStageChange?(.downloading)
        let storageRef = Storage.storage().reference(withPath: capture.storagePath)

        let maxAudioBytes: Int64 = 50_000_000
        guard let wavBytes = try? await storageRef.data(maxSize: maxAudioBytes) else {
            return
        }

        self.currentlyProcessingStage = .transcribing
        onStageChange?(.transcribing)
        let samples = WavAudio.decode(wavBytes)
        let rawText = (try? await ServiceLocator.whisperTranscriber.transcribe(samples: samples, language: capture.language)) ?? ""

        if rawText.trimmingCharacters(in: CharacterSet.whitespacesAndNewlines).isEmpty {
            try? await removeFromQueue(captureId: capture.id)
            return
        }

        self.currentlyProcessingStage = .parsing
        onStageChange?(.parsing)
        let audioUrl = (try? await storageRef.downloadURL())?.absoluteString ?? ""
        let knownProperties = (try? await ServiceLocator.entryRepository.observeProperties().first(where: { _ in true }))?.map { $0.name } ?? []

        let outcome = await parseWithRetry(rawText: rawText, knownProperties: knownProperties)

        self.currentlyProcessingStage = .saving
        onStageChange?(.saving)
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
                startedAt: capture.capturedAt,
                captureLat: capture.lat,
                captureLng: capture.lng
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

    /// One bounded retry on top of `AgentClient.parseEntry` — background
    /// Quick Capture processing has no user watching a spinner, so it's
    /// worth spending a couple extra seconds to avoid permanently writing a
    /// degraded fallback entry (task = raw text, no duration) over a
    /// transient failure. Two real transient windows this closes: the
    /// on-device `Conversation.sendMessage()` call has been observed to
    /// wedge with no exception on some devices (see `LiteRtLlm`'s
    /// `onDeviceResponseTimeoutSeconds` comment), and a cloud call made
    /// moments after app launch can be rejected before Firebase
    /// Auth/App Check finish initializing — both far more likely to hit
    /// this call right after typing (near-instant, no natural warm-up
    /// delay) than after voice capture's slower upload/transcribe pipeline
    /// incidentally gives those systems time to be ready.
    private func parseWithRetry(rawText: String, knownProperties: [String]) async -> ParseOutcome {
        let first = await ServiceLocator.agentClient.parseEntry(rawText: rawText, knownProperties: knownProperties)
        guard case .failure = first else { return first }
        try? await Task.sleep(nanoseconds: 2_000_000_000)
        return await ServiceLocator.agentClient.parseEntry(rawText: rawText, knownProperties: knownProperties)
    }

    // MARK: - Typed-text Quick Capture

    /// Drains `TextCaptureQueue` — Quick Capture's typed-text counterpart to
    /// `processPendingCaptures()` above. Same parse -> save tail
    /// (`saveFromDraftText`/`saveFallbackText` below mirror
    /// `saveFromDraft`/`saveFallback` field-for-field, just without the
    /// audio-transcription steps or `audioUrl`), so a typed Quick Capture
    /// entry is indistinguishable in shape from a voice one except for
    /// `source` and the absence of `audioUrl`.
    @discardableResult
    public func processPendingTextCaptures() async -> Int {
        guard let pending = try? await ServiceLocator.textCaptureQueue.listPending() else { return 0 }
        var processedCount = 0

        for capture in pending {
            do {
                try await processOneText(capture)
                processedCount += 1
            } catch {
                // Log and continue to next item in queue
            }
            self.currentlyProcessingStage = nil
        }
        return processedCount
    }

    private func processOneText(_ capture: PendingTextCapture) async throws {
        self.currentlyProcessingStage = .parsing
        let knownProperties = (try? await ServiceLocator.entryRepository.observeProperties().first(where: { _ in true }))?.map { $0.name } ?? []

        let outcome = await parseWithRetry(rawText: capture.rawText, knownProperties: knownProperties)

        self.currentlyProcessingStage = .saving
        switch outcome {
        case .success(let result):
            await saveFromDraftText(result.draft, rawText: capture.rawText, capture: capture)
        case .failure:
            await saveFallbackText(rawText: capture.rawText, capture: capture)
        }

        try await ServiceLocator.textCaptureQueue.remove(captureId: capture.id)
        ServiceLocator.quickCaptureStatsStore.recordCompleted()
    }

    private func saveFromDraftText(_ draft: EntryDraft, rawText: String, capture: PendingTextCapture) async {
        let intent = TimerIntentClassifier.classify(rawText) ?? (draft.eventType == "start" ? .start : (draft.eventType == "stop" ? .stop : nil))

        if intent == .start {
            _ = try? await ServiceLocator.timerEntryCoordinator.handleStart(
                property: draft.property,
                task: draft.task,
                category: draft.category,
                source: .text,
                startedAt: capture.capturedAt,
                captureLat: capture.lat,
                captureLng: capture.lng
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
            source: CaptureSource.text.firestoreValue,
            activityDate: capture.capturedAt,
            loggedAt: Timestamp(),
            confirmedAt: isComplete ? Timestamp() : nil,
            miles: draft.miles ?? 0.0,
            captureLat: capture.lat,
            captureLng: capture.lng,
            rawTranscript: rawText
        )
        try? await ServiceLocator.entryRepository.createEntry(entry)
    }

    private func saveFallbackText(rawText: String, capture: PendingTextCapture) async {
        let entry = Entry(
            task: rawText,
            status: EntryStatus.pendingReview.firestoreValue,
            source: CaptureSource.text.firestoreValue,
            activityDate: capture.capturedAt,
            loggedAt: Timestamp(),
            captureLat: capture.lat,
            captureLng: capture.lng,
            rawTranscript: rawText
        )
        try? await ServiceLocator.entryRepository.createEntry(entry)
    }
}

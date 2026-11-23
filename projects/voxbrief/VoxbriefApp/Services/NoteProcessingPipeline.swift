import Foundation

/// Finds who speaks when in a recording (SpeakerKit on the iPhone, see
/// `SpeakerDiarizationService`): spans with speaker numbers shared across the whole recording.
public protocol SpeakerDetecting: Sendable {
    func speakerSpans(forAudioAt url: URL) async throws -> [SpeakerSpan]
}

@MainActor
public final class NoteProcessingPipeline: ObservableObject {
    #if os(iOS)
    public static let shared = NoteProcessingPipeline(speakerDetector: SpeakerDiarizationService.shared)
    #else
    public static let shared = NoteProcessingPipeline()
    #endif
    
    private let asrService: ASRServiceProtocol
    private let llmService: LLMCopywriterServiceProtocol
    private let repository: NoteRepository
    private let audioFileManager: AudioFileManager
    private let dictionaryStore: PersonalDictionaryStore
    private let templateStore: TemplateStore
    /// nil: no speaker detection (the Mac, tests that don't set one).
    private let speakerDetector: SpeakerDetecting?
    /// Where each note's `ProcessingCheckpoint` is saved while it's processed.
    private let checkpointDirectory: URL
    /// Pieces of a watch recording still waiting on this device (see `WatchSessionStore`). A note
    /// whose id has pieces there is a watch recording that arrived in pieces.
    var sessionStore: WatchSessionStore = .shared

    @Published public private(set) var activeProcessingCount: Int = 0
    /// Holds the live, progressive transcript for any notes actively undergoing Stage 1 ASR transcription.
    /// Cleared once processing completes or fails.
    @Published public private(set) var streamingTranscripts: [UUID: String] = [:]
    /// The step each note being processed is on, counted in its pieces or parts, for the
    /// Pipeline tab (see `progress(for:)`).
    @Published public private(set) var chunkProgress: [UUID: ChunkProgress] = [:]
    /// Notes whose Stage 2 was stopped in the background because its next step needs the
    /// on-device model's GPU: not retried until the app is active again (`foregroundReturned`),
    /// or a background task would pick them up and stop them over and over.
    @Published public private(set) var waitingForForeground: Set<UUID> = []

    /// The app is active again: every note can run.
    public func foregroundReturned() {
        waitingForForeground.removeAll()
    }

    /// Notes whose progress is being published (a late update after a run ends is dropped).
    private var progressNoteIds: Set<UUID> = []

    /// Notes currently mid-pipeline. Guards against double-processing the same note when a
    /// retry, a pull-to-refresh, and the original sync-triggered run could otherwise overlap.
    private var inFlightNoteIds: Set<UUID> = []
    /// Dictation captures (the Mac's hotkey) that skip the brief and speaker
    /// detection: they're pasted as soon as the cleanup is done, so neither is worth the wait.
    private var briefSkippedNoteIds: Set<UUID> = []

    /// Settings / Preferences: the format a new note gets on top of its light cleanup when
    /// nothing was picked before recording (a `TemplateChoice` raw value). Defaults to none: the
    /// light cleanup alone, which a small on-device model does well; a structured rewrite is
    /// asked for per note, or made the default here.
    public nonisolated static let defaultTemplateChoiceKey = "default_template_choice"
    public nonisolated static var defaultTemplateChoice: TemplateChoice {
        UserDefaults.standard.string(forKey: defaultTemplateChoiceKey).flatMap(TemplateChoice.init(rawValue:)) ?? .none
    }

    /// Whether the app is in the background right now. The iOS app points this at
    /// `UIApplication.applicationState` (see `BackgroundProcessingManager`); the Mac app keeps the
    /// default, since a Mac app keeps its GPU when it isn't frontmost. A Stage 2 that fails while
    /// backgrounded is left pending instead of failed, because on iOS the cause is almost always
    /// the system withholding the GPU, and it runs fine once the app is back.
    public static var isAppInBackground: @MainActor () -> Bool = { false }

    /// Stage 1 on iPhone goes through the engine picked in Settings (Whisper by default, or Apple
    /// Speech, `TranscriptionRouter`); the Mac app transcribes with Whisper.
    public nonisolated static var defaultASR: ASRServiceProtocol {
        #if os(iOS)
        return TranscriptionRouter.shared
        #else
        return ASRService.shared
        #endif
    }

    public init(
        asrService: ASRServiceProtocol = NoteProcessingPipeline.defaultASR,
        llmService: LLMCopywriterServiceProtocol = LLMCopywriterService.shared,
        repository: NoteRepository = .shared,
        audioFileManager: AudioFileManager = .shared,
        dictionaryStore: PersonalDictionaryStore = .shared,
        templateStore: TemplateStore = .shared,
        speakerDetector: SpeakerDetecting? = nil,
        checkpointDirectory: URL? = nil
    ) {
        self.speakerDetector = speakerDetector
        self.checkpointDirectory = checkpointDirectory ?? ProcessingCheckpoint.defaultDirectory
        self.asrService = asrService
        self.llmService = llmService
        self.repository = repository
        self.audioFileManager = audioFileManager
        self.dictionaryStore = dictionaryStore
        self.templateStore = templateStore
    }

    /// Starts warming Stage 1 (ASR) and Stage 2 (on-device LLM) the moment a recording begins,
    /// so a call already in flight by the time the user stops talking doesn't pay a full cold-load
    /// cost inline with that note's processing. Fire-and-forget by design: callers
    /// (`RecordingCoordinator.beginRecording`/`CaptureCoordinator.beginCapture`) call this without
    /// awaiting it, racing it against however long the recording lasts; errors are swallowed by
    /// the underlying services' own `warmUp()` implementations, which are always safe no-ops if
    /// something isn't applicable (Ollama routing, Simulator, already warm).
    @discardableResult
    public func warmUp() -> Task<Void, Never> {
        Task { [asrService, llmService] in
            async let asr: Void = asrService.warmUp()
            async let llm: Void = llmService.warmUp()
            _ = await (asr, llm)
        }
    }

    /// Marks a note about to be processed as a dictation capture, which skips the brief (the
    /// title and summary step, keeping the light cleanup's) and speaker detection. Applies to
    /// its next `process`.
    public func skipBrief(for noteId: UUID) {
        briefSkippedNoteIds.insert(noteId)
    }

    /// Whether the note being processed is a dictation capture that skips the brief and
    /// speakers (the Pipeline tab leaves those steps out).
    public func skipsBrief(for noteId: UUID) -> Bool {
        briefSkippedNoteIds.contains(noteId)
    }

    /// Executes the two-stage processing pipeline for a given voice note. `liveTranscript`, when
    /// the iPhone's live transcript kept up with the recording (`LiveTranscriber`), stands in for
    /// Stage 1, so the note goes straight to Stage 2.
    public func process(note: VoiceNote, liveTranscript: (transcript: String, segments: [TranscriptTimingSegment])? = nil) async {
        guard !inFlightNoteIds.contains(note.id) else { return }

        guard let audioFileName = note.audioFileName else {
            repository.updateStatus(for: note.id, status: .failed, errorMessage: "Missing audio file.")
            return
        }

        let audioURL = audioFileManager.url(for: audioFileName)
        // A watch recording that arrived in pieces: they are joined into the note's one audio
        // file and transcribed piece by piece, so a recording of hours never has to be held in
        // memory whole. The pieces are dropped once the transcript is saved.
        let sessionPieces = sessionStore.pieces(for: note.id)
        // Set once Stage 1 succeeds, so a Stage 2 failure still saves the transcript.
        var transcribedNote: VoiceNote?
        // What this note's processing has finished, kept until it's ready or failed so a run
        // that's interrupted resumes from there.
        let checkpoint = makeCheckpoint(for: note.id)
        inFlightNoteIds.insert(note.id)
        activeProcessingCount += 1
        defer {
            endProgress(for: note.id)
            inFlightNoteIds.remove(note.id)
            briefSkippedNoteIds.remove(note.id)
            activeProcessingCount -= 1
            streamingTranscripts.removeValue(forKey: note.id)
            if !sessionPieces.isEmpty,
               let saved = repository.note(withId: note.id), !saved.rawTranscript.isEmpty,
               FileManager.default.fileExists(atPath: audioURL.path) {
                sessionStore.remove(pieces: sessionPieces, sessionId: note.id)
            }
        }
        
        do {
            // Personal dictionary (jargon/proper nouns) -- fetched once and threaded through
            // both stages: it biases ASR decoding, deterministically corrects known mishearings,
            // and tells the LLM which terms to preserve verbatim.
            let dictionaryEntries = dictionaryStore.entries

            if !sessionPieces.isEmpty, !FileManager.default.fileExists(atPath: audioURL.path) {
                try await WatchSessionStore.combineAudio(
                    urls: sessionPieces.map { sessionStore.url(for: $0, sessionId: note.id) },
                    to: audioURL
                )
            }

            // Stage 1: ASR Speech-to-Text
            repository.updateStatus(for: note.id, status: .transcribingASR)
            let asrStart = ContinuousClock.now
            let (asrTranscript, timingSegments): (String, [TranscriptTimingSegment])
            if let liveTranscript {
                (asrTranscript, timingSegments) = liveTranscript
            } else if sessionPieces.count > 1 {
                (asrTranscript, timingSegments) = try await transcribe(
                    pieces: sessionPieces,
                    sessionId: note.id,
                    vocabulary: dictionaryEntries.map(\.term),
                    checkpoint: checkpoint
                )
            } else {
                checkpoint.report(ChunkProgress(step: Self.transcribeStep, done: 0, total: 0))
                (asrTranscript, timingSegments) = try await asrService.transcribeAudioWithTimings(
                    at: audioURL,
                    vocabulary: dictionaryEntries.map(\.term),
                    onProgress: { [weak self, noteId = note.id] partialText in
                        Task { @MainActor [weak self] in
                            self?.streamingTranscripts[noteId] = partialText
                        }
                    }
                )
            }
            let rawTranscript = DictionaryCorrector.apply(to: asrTranscript, entries: dictionaryEntries)
            streamingTranscripts[note.id] = rawTranscript
            let transcribeTiming = ProcessingTiming(name: liveTranscript == nil ? "Transcribe" : "Transcribe (live)", seconds: Self.seconds(since: asrStart))

            var transcribed = note
            transcribed.processingTimings = [transcribeTiming]
            transcribed.rawTranscript = rawTranscript
            transcribed.transcriptSegments = timingSegments
            transcribed.segments = [
                NoteSegment(
                    id: note.id,
                    audioFileName: audioFileName,
                    createdAt: note.createdAt,
                    duration: note.duration,
                    source: note.source,
                    rawTranscript: rawTranscript
                )
            ]
            if !briefSkippedNoteIds.contains(note.id) {
                checkpoint.report(ChunkProgress(step: Self.speakersStep, done: 0, total: 0))
            }
            if !briefSkippedNoteIds.contains(note.id),
               let speakerTiming = await detectSpeakers(on: &transcribed, audioURL: audioURL) {
                transcribed.processingTimings.append(speakerTiming)
            }
            let choice = note.templateChoice ?? Self.defaultTemplateChoice
            transcribed.templateChoice = choice == .none ? nil : choice
            transcribedNote = transcribed

            // Saved before Stage 2 so an interruption from here on (the app closed, killed or
            // crashed) only re-runs Stage 2, which `resumeInterruptedNotes` does for a pending
            // note with a transcript.
            var pendingStage2 = transcribed
            pendingStage2.status = .cleaningLLM
            if pendingStage2.title == "Processing Voice Note...", let title = Self.provisionalTitle(from: rawTranscript) {
                pendingStage2.title = title
            }
            repository.save(pendingStage2)

            // Stage 2: the light cleanup, then a structured rewrite only if one was asked for.
            var updatedNote = transcribed
            let stage2Timings = try await ProcessingCheckpoint.$current.withValue(checkpoint) {
                try await runStage2(on: &updatedNote, transcript: rawTranscript, choice: choice, dictionary: dictionaryEntries)
            }
            updatedNote.status = .ready
            updatedNote.errorMessage = nil
            updatedNote.processingTimings = transcribed.processingTimings + stage2Timings

            repository.save(updatedNote)
            checkpoint.remove()

            print("[NoteProcessingPipeline] Successfully processed note: \(note.id) -> '\(updatedNote.title)'")
        } catch {
            if var pending = transcribedNote, Self.isAppInBackground() {
                // Transcribed, but Stage 2 couldn't run in the background: keep it pending so
                // `resumeInterruptedNotes` finishes it (Stage 2 only) when the app is back.
                print("[NoteProcessingPipeline] Stage 2 deferred until foreground for note \(note.id): \(error)")
                pending.status = .cleaningLLM
                pending.errorMessage = nil
                waitingForForeground.insert(note.id)
                if pending.title == "Processing Voice Note...", let title = Self.provisionalTitle(from: pending.rawTranscript) {
                    pending.title = title
                }
                repository.save(pending)
                return
            }
            print("[NoteProcessingPipeline] Processing failed for note \(note.id): \(error)")
            var failedNote = transcribedNote ?? note
            failedNote.status = .failed
            failedNote.errorMessage = error.localizedDescription
            if failedNote.title == "Processing Voice Note..." {
                if transcribedNote != nil, let title = Self.provisionalTitle(from: failedNote.rawTranscript) {
                    failedNote.title = title
                    failedNote.summary = ""
                } else {
                    failedNote.title = "Processing Failed"
                    failedNote.summary = error.localizedDescription
                }
            }
            repository.save(failedNote)
            checkpoint.remove()
        }
    }
    
    /// Stage 1 for a watch recording that arrived in pieces: each piece is transcribed on its
    /// own and its timings moved to where the piece sits in the whole recording. A piece with no
    /// speech in it (common over a day) is skipped; only a recording with no speech at all fails.
    private func transcribe(
        pieces: [WatchSessionPiece],
        sessionId: UUID,
        vocabulary: [String],
        checkpoint: ProcessingCheckpoint? = nil
    ) async throws -> (String, [TranscriptTimingSegment]) {
        var texts: [String] = []
        var timings: [TranscriptTimingSegment] = []
        var offset: TimeInterval = 0
        for (index, piece) in pieces.enumerated() {
            checkpoint?.report(ChunkProgress(step: Self.transcribeStep, done: index, total: pieces.count))
            // A piece transcribed by an interrupted run isn't transcribed again.
            if let saved = checkpoint?.piece(piece.fileName) {
                if !saved.transcript.isEmpty {
                    texts.append(saved.transcript)
                    timings += WatchSessionStore.offset(saved.segments, by: offset)
                }
                offset += piece.duration
                continue
            }
            let soFar = texts.joined(separator: " ")
            do {
                let result = try await asrService.transcribeAudioWithTimings(
                    at: sessionStore.url(for: piece, sessionId: sessionId),
                    vocabulary: vocabulary,
                    onProgress: { [weak self] partialText in
                        Task { @MainActor [weak self] in
                            self?.streamingTranscripts[sessionId] = soFar.isEmpty ? partialText : soFar + " " + partialText
                        }
                    }
                )
                texts.append(result.transcript)
                timings += WatchSessionStore.offset(result.segments, by: offset)
                checkpoint?.record(piece: piece.fileName, .init(transcript: result.transcript, segments: result.segments))
            } catch ASRError.emptyAudio {
                // Nothing was said in this piece.
                checkpoint?.record(piece: piece.fileName, .init(transcript: "", segments: []))
            }
            offset += piece.duration
        }
        guard !texts.isEmpty else { throw ASRError.emptyAudio }
        return (texts.joined(separator: " "), timings)
    }

    /// Re-runs Stage 2 (LLM copywriting) on an existing note's raw transcript. For a multi-segment
    /// note this reprocesses the full accumulated transcript, not just the newest segment.
    public func reprocessWithLLM(noteId: UUID) async {
        guard let note = repository.note(withId: noteId), !note.rawTranscript.isEmpty else { return }

        activeProcessingCount += 1
        defer { activeProcessingCount -= 1 }

        await reprocessStage2MarkingFailure(for: noteId)
    }

    /// Formats a note from its existing transcript with `template`, or with auto-detection among
    /// the enabled templates when `nil` (see `changeFormat`).
    public func changeTemplate(noteId: UUID, to template: NoteTemplate?) async throws {
        try await changeFormat(noteId: noteId, to: template.map { .template($0.id) } ?? .auto)
    }

    /// Changes what a note is formatted into on top of its light cleanup: a template, auto-
    /// detection, or `.none` to keep only the cleaned text. The light cleanup is reused when the
    /// note has one. Appending, merging and re-running keep the template this lands on. On
    /// failure a ready note keeps its content and status, and the error is rethrown to show.
    public func changeFormat(noteId: UUID, to choice: TemplateChoice) async throws {
        guard let note = repository.note(withId: noteId),
              !note.rawTranscript.isEmpty,
              !inFlightNoteIds.contains(noteId) else { return }

        inFlightNoteIds.insert(noteId)
        activeProcessingCount += 1
        defer {
            inFlightNoteIds.remove(noteId)
            activeProcessingCount -= 1
        }

        do {
            try await reprocessStage2(for: noteId, choice: choice, reuseLightCleanup: true)
        } catch {
            if note.status == .ready {
                repository.updateStatus(for: noteId, status: .ready)
            } else {
                repository.updateStatus(for: noteId, status: .failed, errorMessage: error.localizedDescription)
            }
            throw error
        }
    }

    /// Appends a freshly-recorded segment's audio to an existing note: runs Stage 1 (ASR) on just
    /// the new audio (older segments already have their own transcripts, so they're never
    /// re-transcribed), then re-runs Stage 2 over *all* of the note's segments together so the
    /// LLM always sees the note's full history, not just the newest snippet.
    public func appendRecording(
        segmentId: UUID,
        audioFileName: String,
        duration: TimeInterval,
        source: NoteSource,
        toNoteId noteId: UUID
    ) async {
        guard repository.note(withId: noteId) != nil, !inFlightNoteIds.contains(noteId) else { return }

        inFlightNoteIds.insert(noteId)
        activeProcessingCount += 1
        defer {
            inFlightNoteIds.remove(noteId)
            activeProcessingCount -= 1
            streamingTranscripts.removeValue(forKey: noteId)
        }

        repository.updateStatus(for: noteId, status: .transcribingASR)
        do {
            let dictionaryEntries = dictionaryStore.entries
            let audioURL = audioFileManager.url(for: audioFileName)
            let (asrTranscript, timingSegments) = try await asrService.transcribeAudioWithTimings(
                at: audioURL,
                vocabulary: dictionaryEntries.map(\.term),
                onProgress: { [weak self] partialText in
                    Task { @MainActor [weak self] in
                        self?.streamingTranscripts[noteId] = partialText
                    }
                }
            )
            let correctedTranscript = DictionaryCorrector.apply(to: asrTranscript, entries: dictionaryEntries)
            streamingTranscripts[noteId] = correctedTranscript

            guard var note = repository.note(withId: noteId) else { return }
            let segment = NoteSegment(
                id: segmentId,
                audioFileName: audioFileName,
                createdAt: Date(),
                duration: duration,
                source: source,
                rawTranscript: correctedTranscript
            )
            note.segments = (note.segments.isEmpty ? [Self.legacySegment(from: note)] : note.segments) + [segment]
            note.audioFileName = segment.audioFileName
            note.duration = segment.duration
            note.transcriptSegments = note.transcriptSegments + timingSegments
            repository.save(note)

            await reprocessStage2MarkingFailure(for: noteId)
        } catch {
            repository.updateStatus(for: noteId, status: .failed, errorMessage: error.localizedDescription)
        }
    }

    /// Folds `sourceId`'s recording(s) into `targetId`: moves its segment(s) onto the target,
    /// deletes the source note's *record* (its audio files are kept -- the target's segments now
    /// reference them, see `NoteRepository.removeRecordOnly`), and re-runs Stage 2 over the
    /// combined transcript. Both notes must already be `.ready` (i.e. have a transcript to merge).
    public func mergeNote(sourceId: UUID, intoTargetId targetId: UUID) async {
        guard sourceId != targetId,
              let source = repository.note(withId: sourceId),
              var target = repository.note(withId: targetId),
              !source.rawTranscript.isEmpty,
              !inFlightNoteIds.contains(targetId), !inFlightNoteIds.contains(sourceId) else { return }

        inFlightNoteIds.insert(targetId)
        inFlightNoteIds.insert(sourceId)
        activeProcessingCount += 1
        defer {
            inFlightNoteIds.remove(targetId)
            inFlightNoteIds.remove(sourceId)
            activeProcessingCount -= 1
        }

        let incomingSegments = source.segments.isEmpty ? [Self.legacySegment(from: source)] : source.segments
        target.segments = (target.segments.isEmpty ? [Self.legacySegment(from: target)] : target.segments) + incomingSegments
        if let latest = incomingSegments.max(by: { $0.createdAt < $1.createdAt }) {
            target.audioFileName = latest.audioFileName
            target.duration = latest.duration
        }
        repository.save(target)
        repository.removeRecordOnly(id: sourceId)

        await reprocessStage2MarkingFailure(for: targetId)
    }

    // MARK: - Stage 2 Reprocessing (shared by reprocessWithLLM / changeTemplate / appendRecording / mergeNote)

    /// Stage 2 on `note`: the light cleanup (title, summary, tags and the cleaned text), then --
    /// unless `choice` is `.none` -- a structured rewrite with that template or auto-detection,
    /// which replaces the summary and tags but never the title.
    /// A note without a structured rewrite keeps the cleaned text in `cleanedNote` too, for
    /// exports, search and sharing. `reuseLightCleanup` skips the light call when the note
    /// already has one (a format change on an unchanged transcript).
    ///
    /// The light cleanup failing fails Stage 2. The structured rewrite failing leaves the note
    /// with its light cleanup and `templateChoice` still set, so the note can offer to try again
    /// -- unless `structuredFailureThrows` (an explicit format change, shown as an alert) or the
    /// app is in the background (the GPU was withheld; the note is finished later in full).
    /// Returns the Stage 2 timings.
    private func runStage2(
        on note: inout VoiceNote,
        transcript: String,
        choice: TemplateChoice,
        dictionary: [DictionaryEntry],
        reuseLightCleanup: Bool = false,
        structuredFailureThrows: Bool = false
    ) async throws -> [ProcessingTiming] {
        var timings: [ProcessingTiming] = []
        // Whether this run wrote the summary in a step of its own; a structured rewrite then
        // keeps it. On a format change (`reuseLightCleanup`) the note keeps the summary it has.
        var keepsSummary = reuseLightCleanup

        // A conversation: the note's single recording, with two or more speakers detected.
        let rawTurns = note.segments.count <= 1 ? SpeakerTurns.turns(from: note.transcriptSegments) : []
        if note.speakerCount != nil {
            note.speakerCount = max(1, SpeakerTurns.speakerCount(in: note.transcriptSegments))
        }

        if reuseLightCleanup, let existing = note.cleanedText {
            note.lightCleanedNote = existing
        } else {
            let conversation = !rawTurns.isEmpty
            if let spans = topicSpans(for: note) {
                // A long recording about many things: each topic cleaned up and titled on its own.
                timings += try await cleanUpByTopic(on: &note, spans: spans, turns: rawTurns, dictionary: dictionary)
                keepsSummary = true
            } else {
                note.topics = []
                // The cleaned text: a light cleanup of a memo, or for a conversation a readable,
                // lightly condensed account of it (the turns are read with who said them).
                let input = conversation
                    ? rawTurns.map { "Speaker \($0.speaker + 1): \(DictionaryCorrector.apply(to: $0.text, entries: dictionary))" }.joined(separator: "\n\n")
                    : transcript
                let start = ContinuousClock.now
                ProcessingCheckpoint.report(step: LLMCopywriterService.cleanupStep, done: 0, total: 1)
                let light = try await llmService.processTranscript(input, mode: conversation ? .conversation : .light, dictionary: dictionary, templates: [])
                timings.append(ProcessingTiming(name: "Clean up", seconds: Self.seconds(since: start)))
                note.title = light.title
                note.summary = light.summary
                note.tags = light.tags
                note.lightCleanedNote = light.cleanedMarkdown
                note.lightCleanupEngine = light.engine

                // The brief: title and one-line summary from the cleaned text, in a step of their
                // own. When it can't run, the light cleanup's stay.
                if !briefSkippedNoteIds.contains(note.id) {
                    let briefStart = ContinuousClock.now
                    ProcessingCheckpoint.report(step: LLMCopywriterService.briefStep, done: 0, total: 1)
                    do {
                        if let brief = try await llmService.writeBrief(cleanedText: light.cleanedMarkdown) {
                            if light.explicitTitle == nil { note.title = brief.title }
                            note.summary = brief.summary
                            keepsSummary = true
                            let name = brief.partCount > 1 ? "Title & summary (\(brief.partCount) parts)" : "Title & summary"
                            timings.append(ProcessingTiming(name: name, seconds: Self.seconds(since: briefStart)))
                        }
                    } catch let error where error.stopsStageTwo {
                        throw error
                    } catch {
                        print("[NoteProcessingPipeline] Brief failed for note \(note.id); kept the cleanup's title and summary: \(error)")
                    }
                }
            }

            // The Transcript tab's speaker view: each turn proofread on its own. Without a model
            // the turns are tidied (tokens, notes and fillers removed) and still shown.
            if conversation {
                let turnsStart = ContinuousClock.now
                ProcessingCheckpoint.report(step: LLMCopywriterService.turnsStep, done: 0, total: 1)
                var texts = rawTurns.map { TranscriptText.paragraphed(TranscriptText.removingFillerSounds($0.text)) }
                do {
                    let cleaned = try await llmService.cleanUpTurns(
                        rawTurns.map { DictionaryCorrector.apply(to: $0.text, entries: dictionary) },
                        dictionary: dictionary
                    )
                    if cleaned.texts.count == texts.count { texts = cleaned.texts }
                    timings.append(ProcessingTiming(name: "Speaker turns (\(rawTurns.count))", seconds: Self.seconds(since: turnsStart)))
                } catch let error where error.stopsStageTwo {
                    throw error
                } catch {
                    print("[NoteProcessingPipeline] Turn cleanup failed for note \(note.id); kept the tidied turns: \(error)")
                }
                note.speakerTurns = zip(rawTurns, texts).map { turn, text in
                    SpeakerTurn(id: turn.id, speaker: turn.speaker, start: turn.start, text: text)
                }
            } else {
                note.speakerTurns = []
            }
        }

        func clearStructuredRewrite() {
            note.cleanedNote = note.lightCleanedNote ?? ""
            note.cleanupEngine = note.lightCleanupEngine
            note.requirements = []
            note.conditions = []
            note.actionItems = []
            note.templateSections = []
            note.templateId = nil
            note.templateName = nil
            note.longMemoParts = []
        }

        guard let templates = templatesToTry(for: choice) else {
            clearStructuredRewrite()
            note.templateChoice = nil
            return timings
        }

        do {
            ProcessingCheckpoint.report(step: LLMCopywriterService.structureStep, done: 0, total: 1)
            let full = try await llmService.processTranscript(
                Self.structuredRewriteInput(cleanedText: note.lightCleanedNote, transcript: transcript),
                mode: .full,
                dictionary: [],
                templates: templates
            )
            // A template never renames a note, and keeps a summary written in its own step.
            if !keepsSummary { note.summary = full.summary }
            note.tags = full.tags
            note.cleanedNote = full.cleanedMarkdown
            note.requirements = full.requirements
            note.conditions = full.conditions
            note.actionItems = full.actionItems
            note.cleanupEngine = full.engine
            note.templateSections = full.sections
            note.templateId = full.templateId
            note.templateName = full.templateName.isEmpty ? nil : full.templateName
            note.longMemoParts = full.parts
            note.templateChoice = nil
            timings += full.timings
        } catch {
            if structuredFailureThrows || Self.isAppInBackground() { throw error }
            print("[NoteProcessingPipeline] Structured rewrite failed for note \(note.id); kept the light cleanup: \(error)")
            clearStructuredRewrite()
            note.templateChoice = choice
        }
        return timings
    }

    // MARK: - Topics

    /// Where a long recording's subject changes (see `NoteTopics`), or nil for a note to clean
    /// up as one: shorter than `NoteTopics.minimumDuration`, several recordings joined (their
    /// timings don't line up), a dictation capture, or one topic throughout.
    private func topicSpans(for note: VoiceNote) -> [NoteTopics.Span]? {
        guard note.duration >= NoteTopics.minimumDuration,
              note.segments.count <= 1,
              !briefSkippedNoteIds.contains(note.id),
              !note.transcriptSegments.isEmpty else { return nil }
        return NoteTopics.split(note.transcriptSegments)
    }

    /// The cleanup and brief of a long recording, topic by topic: each topic's transcript (its
    /// turns, when two or more people speak in it) gets the light cleanup, then its own title
    /// and summary, with the same prompts as a note. The note is titled with its date, and its
    /// cleaned text is the topics under headings. A topic whose cleanup fails keeps its tidied
    /// transcript; Stage 2 fails only when none could be cleaned.
    private func cleanUpByTopic(
        on note: inout VoiceNote,
        spans: [NoteTopics.Span],
        turns: [SpeakerTurn],
        dictionary: [DictionaryEntry]
    ) async throws -> [ProcessingTiming] {
        var timings = [ProcessingTiming(name: "Topics (\(spans.count))", seconds: 0)]
        let segments = note.transcriptSegments

        let cleanupStart = ContinuousClock.now
        var cleaned: [(text: String, result: LLMProcessingResult?)] = []
        var lastError: Error?
        for (index, span) in spans.enumerated() {
            try Task.checkCancellation()
            ProcessingCheckpoint.report(step: LLMCopywriterService.cleanupStep, done: index, total: spans.count)
            let nextStart = index + 1 < spans.count ? spans[index + 1].start : .infinity
            let topicTurns = turns.filter { $0.start >= (index == 0 ? -.infinity : span.start) && $0.start < nextStart }
            let raw = DictionaryCorrector.apply(to: NoteTopics.text(of: span, in: segments), entries: dictionary)
            let conversation = Set(topicTurns.map(\.speaker)).count >= 2
            let input = conversation
                ? topicTurns.map { "Speaker \($0.speaker + 1): \(DictionaryCorrector.apply(to: $0.text, entries: dictionary))" }.joined(separator: "\n\n")
                : raw
            do {
                let result = try await ProcessingCheckpoint.$reportsProgress.withValue(false) {
                    try await llmService.processTranscript(input, mode: conversation ? .conversation : .light, dictionary: dictionary, templates: [])
                }
                cleaned.append((result.cleanedMarkdown, result))
            } catch let error where error.stopsStageTwo || Self.isEngineUnavailable(error) {
                throw error
            } catch {
                print("[NoteProcessingPipeline] Topic \(index + 1)/\(spans.count) cleanup failed for note \(note.id); kept its transcript: \(error)")
                lastError = error
                cleaned.append((TranscriptText.paragraphed(TranscriptText.removingFillerSounds(raw)), nil))
            }
        }
        if cleaned.allSatisfy({ $0.result == nil }), let lastError { throw lastError }
        timings.append(ProcessingTiming(name: "Clean up", seconds: Self.seconds(since: cleanupStart)))

        let briefStart = ContinuousClock.now
        var briefs = 0
        var topics: [NoteTopic] = []
        var tags: [[String]] = []
        for (index, (span, topic)) in zip(spans, cleaned).enumerated() {
            try Task.checkCancellation()
            ProcessingCheckpoint.report(step: LLMCopywriterService.briefStep, done: index, total: spans.count)
            var title = topic.result?.title ?? ""
            var summary = topic.result?.summary ?? ""
            if let result = topic.result { tags.append(result.tags) }
            do {
                let brief = try await ProcessingCheckpoint.$reportsProgress.withValue(false) {
                    try await llmService.writeBrief(cleanedText: topic.text)
                }
                if let brief {
                    title = brief.title
                    summary = brief.summary
                    tags.append(brief.tags)
                    briefs += 1
                }
            } catch let error where error.stopsStageTwo {
                throw error
            } catch {
                print("[NoteProcessingPipeline] Topic \(index + 1)/\(spans.count) brief failed for note \(note.id): \(error)")
            }
            if title.isEmpty { title = "Topic \(index + 1)" }
            topics.append(NoteTopic(start: span.start, end: span.end, title: title, summary: summary, text: topic.text))
        }
        if briefs > 0 {
            timings.append(ProcessingTiming(name: "Title & summary (\(spans.count) topics)", seconds: Self.seconds(since: briefStart)))
        }

        note.topics = topics
        note.title = NoteTopics.dateTitle(for: note.createdAt)
        note.summary = NoteTopics.summary(of: topics)
        note.tags = LLMCopywriterService.mergedTags(tags)
        note.lightCleanedNote = NoteTopics.markdown(of: topics, recordingStart: note.createdAt)
        note.lightCleanupEngine = cleaned.lazy.compactMap { $0.result?.engine }.first
        return timings
    }

    private static func isEngineUnavailable(_ error: Error) -> Bool {
        if let error = error as? LLMCopywriterError, case .aiEngineUnavailable = error { return true }
        return false
    }

    /// The templates a structured rewrite chooses from, or nil for the light cleanup alone. A
    /// template that has since been deleted falls back to auto-detection.
    private func templatesToTry(for choice: TemplateChoice) -> [NoteTemplate]? {
        switch choice {
        case .none:
            return nil
        case .auto:
            return templateStore.enabledTemplates
        case .template(let id):
            if let template = templateStore.allTemplates.first(where: { $0.id == id }) { return [template] }
            return templateStore.enabledTemplates
        }
    }

    /// Rebuilds `rawTranscript` as the concatenation of every segment (re-applying dictionary
    /// correction to each, so a newly-added dictionary alias retroactively fixes older segments
    /// too), then re-runs Stage 2 over that combined text and saves the result. Does not touch
    /// `activeProcessingCount`/`inFlightNoteIds` -- callers own that.
    ///
    /// `choice` defaults to the note's own (`VoiceNote.regenerationChoice`): the template it was
    /// structured with, or the light cleanup alone. Throws without touching the note's status --
    /// callers decide what a failure means.
    private func reprocessStage2(for noteId: UUID, choice: TemplateChoice? = nil, reuseLightCleanup: Bool = false, checkpoint: ProcessingCheckpoint? = nil) async throws {
        guard var note = repository.note(withId: noteId) else { return }
        let dictionaryEntries = dictionaryStore.entries

        var segments = note.segments.isEmpty ? [Self.legacySegment(from: note)] : note.segments
        for index in segments.indices {
            segments[index].rawTranscript = DictionaryCorrector.apply(to: segments[index].rawTranscript, entries: dictionaryEntries)
        }
        note.segments = segments

        let mergedTranscript = Self.concatenatedTranscript(for: segments)
        let transcriptChanged = mergedTranscript != note.rawTranscript
        note.rawTranscript = mergedTranscript

        repository.updateStatus(for: noteId, status: .cleaningLLM)
        // A note from before speaker detection (or whose detection failed) gets it on a re-run.
        var speakerTiming: ProcessingTiming?
        if !reuseLightCleanup, note.speakerCount == nil, segments.count == 1,
           let audioFileName = note.audioFileName {
            speakerTiming = await detectSpeakers(on: &note, audioURL: audioFileManager.url(for: audioFileName))
        }
        let timings = try await ProcessingCheckpoint.$current.withValue(checkpoint) {
            try await runStage2(
                on: &note,
                transcript: mergedTranscript,
                choice: choice ?? note.regenerationChoice,
                dictionary: dictionaryEntries,
                reuseLightCleanup: reuseLightCleanup && !transcriptChanged,
                structuredFailureThrows: choice != nil
            )
        }
        note.status = .ready
        note.errorMessage = nil
        // Keep the note's last transcription and speaker times; Stage 2's are replaced.
        let kept = note.processingTimings.filter { $0.name.hasPrefix("Transcribe") || ($0.name == Self.speakerTimingName && speakerTiming == nil) }
        note.processingTimings = kept + (speakerTiming.map { [$0] } ?? []) + timings
        repository.save(note)
    }

    static let transcribeStep = "Transcribing"
    static let speakersStep = "Finding speakers"
    static let topicsStep = "Finding topics"

    /// The note's checkpoint, publishing its progress while the note is processed.
    private func makeCheckpoint(for noteId: UUID) -> ProcessingCheckpoint {
        let checkpoint = ProcessingCheckpoint(noteId: noteId, directory: checkpointDirectory)
        progressNoteIds.insert(noteId)
        if let saved = checkpoint.progress { chunkProgress[noteId] = saved }
        checkpoint.onProgress = { [weak self] progress in
            Task { @MainActor [weak self] in
                guard let self, self.progressNoteIds.contains(noteId) else { return }
                self.chunkProgress[noteId] = progress
            }
        }
        return checkpoint
    }

    private func endProgress(for noteId: UUID) {
        progressNoteIds.remove(noteId)
        chunkProgress.removeValue(forKey: noteId)
    }

    /// Where a note's processing has got: live while it runs, else what an interrupted run
    /// saved (so the Pipeline tab shows part 4 of 10 until the note resumes). Nil when there's
    /// nothing to show.
    public func progress(for noteId: UUID) -> ChunkProgress? {
        if let live = chunkProgress[noteId] { return live }
        guard let note = repository.note(withId: noteId), note.status.isProcessing else { return nil }
        return ProcessingCheckpoint(noteId: noteId, directory: checkpointDirectory).progress
    }

    /// `reprocessStage2` with the note's own format, marking the note failed (content kept) on
    /// error -- or leaving it pending when the app is in the background (see `isAppInBackground`).
    /// `resuming` (an interrupted note being finished) reuses what its last run saved in the
    /// note's checkpoint; anything else (Re-run, append, merge) starts a fresh one, so it too
    /// resumes if interrupted.
    private func reprocessStage2MarkingFailure(for noteId: UUID, resuming: Bool = false) async {
        if !resuming { ProcessingCheckpoint(noteId: noteId, directory: checkpointDirectory).remove() }
        let checkpoint = makeCheckpoint(for: noteId)
        defer { endProgress(for: noteId) }
        do {
            try await reprocessStage2(for: noteId, checkpoint: checkpoint)
            checkpoint.remove()
        } catch {
            if Self.isAppInBackground() {
                repository.updateStatus(for: noteId, status: .cleaningLLM)
                waitingForForeground.insert(noteId)
            } else {
                repository.updateStatus(for: noteId, status: .failed, errorMessage: error.localizedDescription)
                checkpoint.remove()
            }
        }
    }

    /// Notes left mid-pipeline by a quit, a crash or the app being suspended, oldest first.
    public var interruptedNotes: [VoiceNote] {
        repository.notes
            .filter { $0.status.isProcessing && !inFlightNoteIds.contains($0.id) }
            .sorted { $0.createdAt < $1.createdAt }
    }

    /// Finishes every interrupted note, one at a time: a note that already has its transcript
    /// and was waiting on Stage 2 re-runs only Stage 2; anything else runs the whole pipeline.
    /// Called at launch and whenever the app becomes active (and by pull-to-refresh).
    public func resumeInterruptedNotes() async {
        ProcessingCheckpoint.prune(
            in: checkpointDirectory,
            keeping: Set(repository.notes.filter { $0.status.isProcessing }.map(\.id))
        )
        let inBackground = Self.isAppInBackground()
        for note in interruptedNotes {
            guard let current = repository.note(withId: note.id),
                  current.status.isProcessing,
                  !inFlightNoteIds.contains(current.id),
                  !(inBackground && waitingForForeground.contains(current.id)) else { continue }
            if current.status == .cleaningLLM && !current.rawTranscript.isEmpty {
                inFlightNoteIds.insert(current.id)
                activeProcessingCount += 1
                await reprocessStage2MarkingFailure(for: current.id, resuming: true)
                inFlightNoteIds.remove(current.id)
                activeProcessingCount -= 1
            } else {
                await process(note: current)
            }
        }
    }

    /// What the structured rewrite reads: the note's cleaned text, which already spells the
    /// personal dictionary's terms and has the fillers out, so it goes in without the dictionary
    /// (like the brief). Given the raw transcript with the dictionary's terms in front of it, Lite
    /// wrote a Chinese errand memo up as a note about a dictionary term ("Weehour is a dictionary
    /// term, but it's not clear what it refers to"). The transcript only when there's no cleaned
    /// text. `internal` for tests.
    static func structuredRewriteInput(cleanedText: String?, transcript: String) -> String {
        if let cleanedText, !cleanedText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return cleanedText
        }
        return transcript
    }

    static func seconds(since start: ContinuousClock.Instant) -> Double {
        let elapsed = ContinuousClock.now - start
        return Double(elapsed.components.seconds) + Double(elapsed.components.attoseconds) / 1e18
    }

    /// A title for a note whose transcript exists but whose Stage 2 failed: its first few words.
    static let speakerTimingName = "Speakers"

    /// Speaker detection on a transcribed note: each transcript segment gets its speaker and the
    /// note its speaker count. Returns the step's timing, or nil when it didn't run (no detector,
    /// no timed transcript) or failed; a failure leaves `speakerCount` nil so a re-run tries
    /// again, and the note is processed as a memo.
    private func detectSpeakers(on note: inout VoiceNote, audioURL: URL) async -> ProcessingTiming? {
        guard let speakerDetector, !note.transcriptSegments.isEmpty,
              FileManager.default.fileExists(atPath: audioURL.path) else { return nil }
        let start = ContinuousClock.now
        do {
            let spans = try await speakerDetector.speakerSpans(forAudioAt: audioURL)
            note.transcriptSegments = SpeakerTurns.assign(note.transcriptSegments, spans: spans)
            note.speakerCount = max(1, SpeakerTurns.speakerCount(in: note.transcriptSegments))
            return ProcessingTiming(name: Self.speakerTimingName, seconds: Self.seconds(since: start))
        } catch {
            print("[NoteProcessingPipeline] Speaker detection failed for note \(note.id): \(error)")
            return nil
        }
    }

    static func provisionalTitle(from transcript: String) -> String? {
        let words = transcript.split(whereSeparator: \.isWhitespace)
        guard !words.isEmpty else { return nil }
        let maxWords = 8
        let title = words.prefix(maxWords).joined(separator: " ")
        return words.count > maxWords ? title + "…" : title
    }

    /// Generates the light cleanup for a note that has none: every note processed since light
    /// cleanup became the default already has it, so this is for older notes, which had only a
    /// structured rewrite (see `NoteDetailViewModel.ensureLightCleanupGenerated`). A no-op if the
    /// note isn't ready yet or already has one.
    public func generateLightCleanup(noteId: UUID) async {
        guard let note = repository.note(withId: noteId),
              note.status == .ready,
              note.cleanedText == nil,
              !inFlightNoteIds.contains(noteId) else { return }

        inFlightNoteIds.insert(noteId)
        activeProcessingCount += 1
        defer {
            inFlightNoteIds.remove(noteId)
            activeProcessingCount -= 1
        }

        do {
            let lightResult = try await llmService.processTranscript(note.rawTranscript, mode: .light, dictionary: dictionaryStore.entries, templates: [])
            guard var updated = repository.note(withId: noteId) else { return }
            updated.lightCleanedNote = lightResult.cleanedMarkdown
            updated.lightCleanupEngine = lightResult.engine
            repository.save(updated)
        } catch {
            // Best-effort: leave lightCleanedNote nil so the UI can offer to retry, without
            // touching the note's overall status -- a failed light pass shouldn't read as the
            // whole note having failed.
            print("[NoteProcessingPipeline] Light cleanup generation failed for note \(noteId): \(error)")
        }
    }

    /// Reconstructs a single `NoteSegment` from a note's top-level fields, for a note persisted
    /// before `segments` existed (see `VoiceNote.segments`'s doc comment).
    private static func legacySegment(from note: VoiceNote) -> NoteSegment {
        NoteSegment(
            id: note.id,
            audioFileName: note.audioFileName ?? "",
            createdAt: note.createdAt,
            duration: note.duration,
            source: note.source,
            rawTranscript: note.rawTranscript
        )
    }

    /// Joins segment transcripts in chronological order. A single segment (the common case) is
    /// returned verbatim with no markers, so today's one-recording notes are byte-identical to
    /// before this feature existed; multiple segments get a per-segment "[Update — ...]" header so
    /// a small on-device model has a temporal cue that later text adds to/revises earlier text
    /// rather than necessarily contradicting it.
    static func concatenatedTranscript(for segments: [NoteSegment]) -> String {
        let sorted = segments.sorted(by: { $0.createdAt < $1.createdAt })
        guard sorted.count > 1 else { return sorted.first?.rawTranscript ?? "" }

        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short

        return sorted.map { segment in
            "[Update — \(formatter.string(from: segment.createdAt))]\n\(segment.rawTranscript)"
        }.joined(separator: "\n\n---\n\n")
    }
}

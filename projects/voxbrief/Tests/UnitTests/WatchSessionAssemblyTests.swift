import XCTest
import AVFoundation
@testable import Voxbrief

/// Returns one scripted result per piece, by file name; "" stands for a piece with no speech.
fileprivate final class PieceASRService: ASRServiceProtocol, @unchecked Sendable {
    var transcripts: [String: String] = [:]
    private(set) var receivedAudioURLs: [URL] = []

    func transcribeAudio(at fileURL: URL, vocabulary: [String], onProgress: (@Sendable (String) -> Void)?) async throws -> String {
        try await transcribeAudioWithTimings(at: fileURL, vocabulary: vocabulary, onProgress: onProgress).transcript
    }

    func transcribeAudioWithTimings(
        at fileURL: URL,
        vocabulary: [String],
        onProgress: (@Sendable (String) -> Void)?
    ) async throws -> (transcript: String, segments: [TranscriptTimingSegment]) {
        receivedAudioURLs.append(fileURL)
        let text = transcripts[fileURL.lastPathComponent] ?? "whole file"
        if text.isEmpty { throw ASRError.emptyAudio }
        return (text, [TranscriptTimingSegment(start: 0.5, end: 1.5, text: text)])
    }

    func warmUp() async {}
}

fileprivate final class StubLLM: LLMCopywriterServiceProtocol, @unchecked Sendable {
    private(set) var receivedTranscripts: [String] = []

    func processTranscript(_ rawTranscript: String, mode: RewriteMode, dictionary: [DictionaryEntry], templates: [NoteTemplate]) async throws -> LLMProcessingResult {
        receivedTranscripts.append(rawTranscript)
        return LLMProcessingResult(
            title: "Day", summary: "", requirements: [], conditions: [], actionItems: [],
            cleanedMarkdown: "md", tags: [], engine: "stub", sections: [], templateId: nil, templateName: ""
        )
    }

    func warmUp() async {}
}

@MainActor
final class WatchSessionAssemblyTests: XCTestCase {

    private var root: URL!
    private var store: WatchSessionStore!

    override func setUp() {
        super.setUp()
        root = FileManager.default.temporaryDirectory.appendingPathComponent("watch-sessions-\(UUID().uuidString)", isDirectory: true)
        try? FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        store = WatchSessionStore(baseDirectory: root.appendingPathComponent("staging", isDirectory: true))
    }

    override func tearDown() {
        try? FileManager.default.removeItem(at: root)
        super.tearDown()
    }

    /// A real AAC file of silence, made the way the watch records.
    private func makeAudio(seconds: Double) throws -> URL {
        let url = root.appendingPathComponent("src-\(UUID().uuidString).m4a")
        let format = try XCTUnwrap(AVAudioFormat(standardFormatWithSampleRate: 16_000, channels: 1))
        let frames = AVAudioFrameCount(seconds * 16_000)
        let buffer = try XCTUnwrap(AVAudioPCMBuffer(pcmFormat: format, frameCapacity: frames))
        buffer.frameLength = frames
        // The file has to be closed (released) before anything reads it.
        try autoreleasepool {
            let file = try AVAudioFile(forWriting: url, settings: WatchRecordingQuality.saver.recorderSettings)
            try file.write(from: buffer)
        }
        return url
    }

    @discardableResult
    private func stage(_ sessionId: UUID, index: Int, seconds: Double, start: Date) throws -> UUID {
        let pieceId = UUID()
        let payload = WatchSyncPayload(
            noteId: pieceId,
            createdAt: start.addingTimeInterval(Double(index) * seconds),
            duration: seconds,
            source: .watchApp,
            audioFileName: "\(pieceId.uuidString).m4a",
            sessionId: sessionId,
            segmentIndex: index
        )
        try store.stagePiece(from: try makeAudio(seconds: seconds), payload: payload, sessionId: sessionId)
        return pieceId
    }

    // MARK: - Wire format

    func testPayloadCarriesTheSessionAndStaysReadableWithoutIt() {
        let sessionId = UUID()
        let payload = WatchSyncPayload(noteId: UUID(), createdAt: Date(), duration: 900, source: .watchApp, audioFileName: "a.m4a", sessionId: sessionId, segmentIndex: 3)
        let restored = WatchSyncPayload.from(dictionary: payload.dictionaryRepresentation)
        XCTAssertEqual(restored?.sessionId, sessionId)
        XCTAssertEqual(restored?.segmentIndex, 3)

        let plain = WatchSyncPayload(noteId: UUID(), createdAt: Date(), duration: 5, source: .watchApp, audioFileName: "b.m4a")
        XCTAssertNil(plain.dictionaryRepresentation[SyncConstants.keySessionId])
        XCTAssertNil(WatchSyncPayload.from(dictionary: plain.dictionaryRepresentation)?.sessionId)
    }

    func testManifestRoundTrip() {
        let manifest = WatchSessionManifest(sessionId: UUID(), pieceIds: [UUID(), UUID()])
        XCTAssertEqual(WatchSessionManifest.from(dictionary: manifest.dictionaryRepresentation), manifest)
        XCTAssertNil(WatchSessionManifest.from(dictionary: [SyncConstants.keyAction: SyncConstants.actionPing]))
    }

    // MARK: - Staging

    func testPiecesAreOrderedAndCompleteOnlyOnceTheListIsMet() throws {
        let sessionId = UUID()
        let start = Date(timeIntervalSince1970: 1_800_000_000)
        let second = try stage(sessionId, index: 1, seconds: 1, start: start)
        let first = try stage(sessionId, index: 0, seconds: 1, start: start)
        XCTAssertEqual(store.pieces(for: sessionId).map(\.id), [first, second])
        XCTAssertFalse(store.isComplete(sessionId), "No list from the watch yet")

        let third = UUID()
        try store.saveManifest(WatchSessionManifest(sessionId: sessionId, pieceIds: [first, second, third]))
        XCTAssertFalse(store.isComplete(sessionId), "One listed piece has not arrived")

        try store.saveManifest(WatchSessionManifest(sessionId: sessionId, pieceIds: [first, second]))
        XCTAssertTrue(store.isComplete(sessionId))
        XCTAssertEqual(store.sessionIds(), [sessionId])
    }

    func testPiecesNotOnTheListAreLeftOutAndSurviveRemoval() throws {
        let sessionId = UUID()
        let start = Date(timeIntervalSince1970: 1_800_000_000)
        let listed = try stage(sessionId, index: 0, seconds: 1, start: start)
        let late = try stage(sessionId, index: 1, seconds: 1, start: start)
        try store.saveManifest(WatchSessionManifest(sessionId: sessionId, pieceIds: [listed]))

        let used = store.pieces(for: sessionId)
        XCTAssertEqual(used.map(\.id), [listed])
        store.remove(pieces: used, sessionId: sessionId)
        XCTAssertEqual(store.stagedPieces(for: sessionId).map(\.id), [late], "A late piece stays to be picked up on its own")

        store.remove(pieces: store.stagedPieces(for: sessionId), sessionId: sessionId)
        XCTAssertTrue(store.sessionIds().isEmpty)
    }

    func testCombineAudioJoinsPiecesEndToEnd() async throws {
        let urls = [try makeAudio(seconds: 2), try makeAudio(seconds: 3), try makeAudio(seconds: 1)]
        let destination = root.appendingPathComponent("joined.m4a")
        try await WatchSessionStore.combineAudio(urls: urls, to: destination)

        let duration = try await AVURLAsset(url: destination).load(.duration).seconds
        XCTAssertEqual(duration, 6, accuracy: 0.5)
        XCTAssertNoThrow(try AVAudioPlayer(contentsOf: destination))
    }

    func testOffsetMovesTimings() {
        let moved = WatchSessionStore.offset([TranscriptTimingSegment(start: 1, end: 2, text: "a")], by: 900)
        XCTAssertEqual(moved.first?.start, 901)
        XCTAssertEqual(moved.first?.end, 902)
        XCTAssertEqual(moved.first?.text, "a")
    }

    // MARK: - Deciding what to do with waiting pieces

    func testSteps() {
        typealias S = WatchSyncService
        func step(pieces: Bool = true, complete: Bool = false, manifest: Bool = false, assembled: Bool = false,
                  note: Bool = false, transcript: Bool = false, waited: TimeInterval = 0) -> S.SessionStep {
            S.step(hasPieces: pieces, isComplete: complete, hasManifest: manifest, alreadyAssembled: assembled,
                   noteExists: note, noteHasTranscript: transcript, waited: waited)
        }
        XCTAssertEqual(step(), .wait, "Pieces without the watch's list wait")
        XCTAssertEqual(step(complete: true, manifest: true), .assemble)
        XCTAssertEqual(step(manifest: true, waited: 100_000), .wait, "A listed piece is still on its way")
        XCTAssertEqual(step(waited: S.incompleteSessionWait + 1), .assemble, "The list never came: use what arrived")
        XCTAssertEqual(step(pieces: false, complete: true, manifest: true), .discard, "A recording with nothing kept")
        XCTAssertEqual(step(complete: true, manifest: true, assembled: true, note: true), .wait, "Being processed")
        XCTAssertEqual(step(assembled: true, note: true, transcript: true), .adoptLatePieces)
        XCTAssertEqual(step(pieces: false, assembled: true, note: true, transcript: true), .discard)
        XCTAssertEqual(step(complete: true, manifest: true, assembled: true), .discard, "The note was deleted: don't rebuild it")
    }

    // MARK: - The pipeline builds one note

    func testPipelineBuildsOneNoteFromThePieces() async throws {
        let sessionId = UUID()
        let start = Date(timeIntervalSince1970: 1_800_000_000)
        let first = try stage(sessionId, index: 0, seconds: 2, start: start)
        let silent = try stage(sessionId, index: 1, seconds: 2, start: start)
        let last = try stage(sessionId, index: 2, seconds: 2, start: start)
        try store.saveManifest(WatchSessionManifest(sessionId: sessionId, pieceIds: [first, silent, last]))

        let asr = PieceASRService()
        asr.transcripts = ["\(first.uuidString).m4a": "morning plan", "\(silent.uuidString).m4a": "", "\(last.uuidString).m4a": "evening recap"]
        let llm = StubLLM()
        let audio = AudioFileManager(baseDirectoryOverride: root.appendingPathComponent("notes", isDirectory: true))
        let repository = NoteRepository(customStorageURL: root.appendingPathComponent("notes.json"))
        let pipeline = NoteProcessingPipeline(
            asrService: asr,
            llmService: llm,
            repository: repository,
            audioFileManager: audio,
            dictionaryStore: PersonalDictionaryStore(customStorageURL: root.appendingPathComponent("dictionary.json")),
            templateStore: TemplateStore(customStorageURL: root.appendingPathComponent("templates.json"))
        )
        pipeline.sessionStore = store

        let note = VoiceNote(id: sessionId, createdAt: start, duration: 6, audioFileName: "\(sessionId.uuidString).m4a", status: .syncing, source: .watchApp)
        repository.save(note)
        await pipeline.process(note: note)

        let saved = try XCTUnwrap(repository.note(withId: sessionId))
        XCTAssertEqual(saved.status, .ready)
        XCTAssertEqual(saved.rawTranscript, "morning plan evening recap")
        XCTAssertEqual(llm.receivedTranscripts, ["morning plan evening recap"], "Stage 2 runs once, over the whole recording")
        XCTAssertEqual(asr.receivedAudioURLs.count, 3, "Each piece is transcribed on its own")
        XCTAssertEqual(saved.transcriptSegments.map(\.start), [0.5, 4.5], "Timings sit where the piece is in the whole recording")
        XCTAssertEqual(saved.segments.count, 1)
        XCTAssertNil(repository.note(withId: first), "Pieces never become notes of their own")
        XCTAssertNil(repository.note(withId: last))

        let joined = audio.url(for: "\(sessionId.uuidString).m4a")
        let duration = try await AVURLAsset(url: joined).load(.duration).seconds
        XCTAssertEqual(duration, 6, accuracy: 0.5)
        XCTAssertTrue(store.stagedPieces(for: sessionId).isEmpty, "Pieces are dropped once the transcript is saved")
    }

    func testAnInterruptedRunSkipsPiecesItAlreadyTranscribed() async throws {
        let sessionId = UUID()
        let start = Date(timeIntervalSince1970: 1_800_000_000)
        let first = try stage(sessionId, index: 0, seconds: 2, start: start)
        let silent = try stage(sessionId, index: 1, seconds: 2, start: start)
        let last = try stage(sessionId, index: 2, seconds: 2, start: start)
        try store.saveManifest(WatchSessionManifest(sessionId: sessionId, pieceIds: [first, silent, last]))

        // The run before was stopped after the first two pieces.
        let checkpoints = root.appendingPathComponent("checkpoints", isDirectory: true)
        let saved = ProcessingCheckpoint(noteId: sessionId, directory: checkpoints)
        saved.record(piece: "\(first.uuidString).m4a", .init(transcript: "morning plan", segments: [TranscriptTimingSegment(start: 0.5, end: 1.5, text: "morning plan")]))
        saved.record(piece: "\(silent.uuidString).m4a", .init(transcript: "", segments: []))

        let asr = PieceASRService()
        asr.transcripts = ["\(last.uuidString).m4a": "evening recap"]
        let repository = NoteRepository(customStorageURL: root.appendingPathComponent("notes.json"))
        let pipeline = NoteProcessingPipeline(
            asrService: asr,
            llmService: StubLLM(),
            repository: repository,
            audioFileManager: AudioFileManager(baseDirectoryOverride: root.appendingPathComponent("notes", isDirectory: true)),
            dictionaryStore: PersonalDictionaryStore(customStorageURL: root.appendingPathComponent("dictionary.json")),
            templateStore: TemplateStore(customStorageURL: root.appendingPathComponent("templates.json")),
            checkpointDirectory: checkpoints
        )
        pipeline.sessionStore = store

        let note = VoiceNote(id: sessionId, createdAt: start, duration: 6, audioFileName: "\(sessionId.uuidString).m4a", status: .syncing, source: .watchApp)
        repository.save(note)
        await pipeline.process(note: note)

        let done = try XCTUnwrap(repository.note(withId: sessionId))
        XCTAssertEqual(done.status, .ready)
        XCTAssertEqual(done.rawTranscript, "morning plan evening recap")
        XCTAssertEqual(asr.receivedAudioURLs.map(\.lastPathComponent), ["\(last.uuidString).m4a"], "Only the piece left is transcribed")
        XCTAssertEqual(done.transcriptSegments.map(\.start), [0.5, 4.5])
        XCTAssertFalse(FileManager.default.fileExists(atPath: saved.fileURL.path), "The checkpoint goes once the note is ready")
        XCTAssertNil(pipeline.progress(for: sessionId), "Nothing left to show once the note is ready")
    }
}

import XCTest
@testable import Voxbrief

/// Saving what a note's processing has finished, and resuming model calls from it.
final class ProcessingCheckpointTests: XCTestCase {

    private var directory: URL!

    override func setUp() {
        super.setUp()
        directory = FileManager.default.temporaryDirectory.appendingPathComponent("checkpoints-\(UUID().uuidString)", isDirectory: true)
    }

    override func tearDown() {
        try? FileManager.default.removeItem(at: directory)
        super.tearDown()
    }

    private final class Counter: @unchecked Sendable {
        private let lock = NSLock()
        private var value = 0
        func next() -> Int { lock.withLock { value += 1; return value } }
        var count: Int { lock.withLock { value } }
    }

    func testWhatIsSavedSurvivesAndCanBeRemoved() {
        let id = UUID()
        let checkpoint = ProcessingCheckpoint(noteId: id, directory: directory)
        checkpoint.record(answer: "part one", for: "k1")
        checkpoint.record(piece: "a.m4a", .init(transcript: "hello", segments: [TranscriptTimingSegment(start: 0, end: 1, text: "hello")]))

        let reopened = ProcessingCheckpoint(noteId: id, directory: directory)
        XCTAssertEqual(reopened.answer(for: "k1"), "part one")
        XCTAssertEqual(reopened.piece("a.m4a")?.transcript, "hello")
        XCTAssertNil(reopened.answer(for: "k2"))

        reopened.remove()
        XCTAssertNil(ProcessingCheckpoint(noteId: id, directory: directory).answer(for: "k1"))
    }

    func testKeysTellCallsApart() {
        let key = ProcessingCheckpoint.key(engine: "Lite", system: "s", user: "u", maxTokens: 10)
        XCTAssertEqual(key, ProcessingCheckpoint.key(engine: "Lite", system: "s", user: "u", maxTokens: 10))
        XCTAssertNotEqual(key, ProcessingCheckpoint.key(engine: "Flash", system: "s", user: "u", maxTokens: 10))
        XCTAssertNotEqual(key, ProcessingCheckpoint.key(engine: "Lite", system: "s", user: "u2", maxTokens: 10))
        XCTAssertNotEqual(key, ProcessingCheckpoint.key(engine: "Lite", system: "su", user: "", maxTokens: 10))
    }

    func testPruneKeepsOnlyNotesStillProcessing() {
        let kept = UUID(), finished = UUID()
        ProcessingCheckpoint(noteId: kept, directory: directory).record(answer: "a", for: "k")
        ProcessingCheckpoint(noteId: finished, directory: directory).record(answer: "a", for: "k")
        ProcessingCheckpoint.prune(in: directory, keeping: [kept])
        XCTAssertEqual(ProcessingCheckpoint(noteId: kept, directory: directory).answerCount, 1)
        XCTAssertEqual(ProcessingCheckpoint(noteId: finished, directory: directory).answerCount, 0)
    }

    /// A long memo stopped after 2 of its parts: the run that resumes asks the model only for
    /// the parts left, and gets the same result as an uninterrupted run.
    func testAStoppedLongMemoResumesAtThePartItStoppedOn() async throws {
        let service = LLMCopywriterService()
        let transcript = (1...4).map { part in
            (1...60).map { "Part \(part) sentence \($0) says something worth keeping." }.joined(separator: " ")
        }.joined(separator: " ")
        let calls = Counter()
        let stopAfter = 2
        let stopping = LLMCopywriterService.StageTwoEngine(label: "Lite") { _, user, _ in
            if calls.next() > stopAfter { throw OnDeviceLLMError.unavailableWhileBackgrounded }
            return #"{"cleanedText": "\#(user.count) chars cleaned.", "title": "Memo", "summary": "A memo.", "tags": []}"#
        }
        let checkpoint = ProcessingCheckpoint(noteId: UUID(), directory: directory)

        do {
            _ = try await ProcessingCheckpoint.$current.withValue(checkpoint) {
                try await service.process(transcript: transcript, mode: .light, dictionary: [], templates: [], engine: stopping)
            }
            XCTFail("Expected the stop")
        } catch {
            XCTAssertTrue(error.stopsStageTwo)
        }
        XCTAssertEqual(checkpoint.answerCount, stopAfter, "The finished parts were saved")

        let resumedCalls = Counter()
        let resuming = LLMCopywriterService.StageTwoEngine(label: "Lite") { _, user, _ in
            _ = resumedCalls.next()
            return #"{"cleanedText": "\#(user.count) chars cleaned.", "title": "Memo", "summary": "A memo.", "tags": []}"#
        }
        let reopened = ProcessingCheckpoint(noteId: checkpoint.noteId, directory: directory)
        let result = try await ProcessingCheckpoint.$current.withValue(reopened) {
            try await service.process(transcript: transcript, mode: .light, dictionary: [], templates: [], engine: resuming)
        }
        let parts = reopened.answerCount
        XCTAssertGreaterThan(parts, stopAfter)
        XCTAssertEqual(resumedCalls.count, parts - stopAfter, "Only the parts left are asked for")

        let fresh = try await service.process(transcript: transcript, mode: .light, dictionary: [], templates: [], engine: resuming)
        XCTAssertEqual(result.cleanedMarkdown, fresh.cleanedMarkdown)
    }

    func testOutsideThePipelineNothingIsSaved() async throws {
        let calls = Counter()
        let engine = LLMCopywriterService.StageTwoEngine(label: "Lite") { _, _, _ in "\(calls.next())" }
        let first = try await engine.generate("s", "u", 10)
        let second = try await engine.generate("s", "u", 10)
        XCTAssertEqual([first, second], ["1", "2"])
    }

    // MARK: - Progress

    private final class Reports: @unchecked Sendable {
        private let lock = NSLock()
        private var items: [ChunkProgress] = []
        func add(_ p: ChunkProgress) { lock.withLock { items.append(p) } }
        var all: [ChunkProgress] { lock.withLock { items } }
        /// The reports without their time stamps.
        var counts: [ChunkProgress] { all.map { ChunkProgress(step: $0.step, done: $0.done, total: $0.total) } }
    }

    func testALongMemoReportsItsPartsAndTheLastOneIsSaved() async throws {
        let service = LLMCopywriterService()
        let transcript = (1...4).map { part in
            (1...60).map { "Part \(part) sentence \($0) says something worth keeping." }.joined(separator: " ")
        }.joined(separator: " ")
        let engine = LLMCopywriterService.StageTwoEngine(label: "Lite") { _, _, _ in
            #"{"cleanedText": "Cleaned.", "title": "Memo", "summary": "A memo.", "tags": []}"#
        }
        let checkpoint = ProcessingCheckpoint(noteId: UUID(), directory: directory)
        let reports = Reports()
        checkpoint.onProgress = { reports.add($0) }

        _ = try await ProcessingCheckpoint.$current.withValue(checkpoint) {
            try await service.process(transcript: transcript, mode: .light, dictionary: [], templates: [], engine: engine)
        }

        let parts = checkpoint.answerCount
        XCTAssertGreaterThan(parts, 1)
        XCTAssertEqual(reports.counts, (0..<parts).map { ChunkProgress(step: "Cleaning up", done: $0, total: parts) })
        XCTAssertEqual(ProcessingCheckpoint(noteId: checkpoint.noteId, directory: directory).progress, reports.all.last, "Kept for the next launch")
    }

    func testAConversationsFallbackDoesNotReplaceItsCount() async throws {
        let service = LLMCopywriterService()
        // Three ~400-word turns: two conversation parts, each redone as a light cleanup by Lite.
        let said = Array(repeating: "we went over the plan for the week and what each of us does next", count: 27).joined(separator: " ")
        let transcript = (1...3).map { "Speaker \($0 % 2 + 1): \(said)" }.joined(separator: "\n\n")
        let engine = LLMCopywriterService.StageTwoEngine(label: "Lite", writesReports: false) { _, _, _ in
            #"{"cleanedText": "Cleaned.", "title": "Plan", "summary": "A plan.", "tags": []}"#
        }
        let checkpoint = ProcessingCheckpoint(noteId: UUID(), directory: directory)
        let reports = Reports()
        checkpoint.onProgress = { reports.add($0) }

        _ = try await ProcessingCheckpoint.$current.withValue(checkpoint) {
            try await service.process(transcript: transcript, mode: .conversation, dictionary: [], templates: [], engine: engine)
        }

        XCTAssertEqual(reports.counts, [ChunkProgress(step: "Cleaning up", done: 0, total: 2), ChunkProgress(step: "Cleaning up", done: 1, total: 2)])
    }

    func testReportsAreStampedWithTheStepsStartAndPace() {
        let checkpoint = ProcessingCheckpoint(noteId: UUID(), directory: directory)
        let start = Date(timeIntervalSince1970: 1_000)
        checkpoint.report(ChunkProgress(step: "Cleaning up", done: 4, total: 10), at: start)
        checkpoint.report(ChunkProgress(step: "Cleaning up", done: 4, total: 10), at: start.addingTimeInterval(5))
        XCTAssertEqual(checkpoint.progress?.updatedAt, start, "The same count again isn't a new report")
        XCTAssertNil(checkpoint.progress?.secondsLeft(at: start), "No pace before a part finishes in this run")

        checkpoint.report(ChunkProgress(step: "Cleaning up", done: 6, total: 10), at: start.addingTimeInterval(40))
        let progress = try! XCTUnwrap(checkpoint.progress)
        XCTAssertEqual(progress.startedAt, start)
        XCTAssertEqual(progress.startDone, 4, "A resumed step measures only this run's parts")
        // 20 s a part, 4 left: 80 s, less 10 s into the current part.
        XCTAssertEqual(try XCTUnwrap(progress.secondsLeft(at: start.addingTimeInterval(50))), 70, accuracy: 0.001)
        XCTAssertEqual(progress.secondsLeft(at: start.addingTimeInterval(500)), 0)

        checkpoint.report(ChunkProgress(step: "Title & summary", done: 0, total: 1), at: start.addingTimeInterval(90))
        XCTAssertEqual(checkpoint.progress?.startedAt, start.addingTimeInterval(90), "A new step starts its own clock")

        let resumed = ProcessingCheckpoint(noteId: checkpoint.noteId, directory: directory)
        resumed.report(ChunkProgress(step: "Title & summary", done: 0, total: 1), at: start.addingTimeInterval(900))
        XCTAssertEqual(resumed.progress?.startedAt, start.addingTimeInterval(900), "A new run starts its own clock")
    }

    func testFraction() {
        XCTAssertEqual(ChunkProgress(step: "x", done: 4, total: 10).fraction, 0.4)
        XCTAssertNil(ChunkProgress(step: "x", done: 0, total: 0).fraction)
    }
}

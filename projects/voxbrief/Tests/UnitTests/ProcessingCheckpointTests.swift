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
}

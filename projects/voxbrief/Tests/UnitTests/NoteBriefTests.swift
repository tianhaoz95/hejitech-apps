import XCTest
@testable import Voxbrief

/// The brief: a note's title and one-line summary written from its cleaned text, in one call or,
/// for a long memo, part by part and then once from the parts' summaries. Driven by a scripted
/// engine (no model runs here).
final class NoteBriefTests: XCTestCase {

    private final class CallLog: @unchecked Sendable {
        private let lock = NSLock()
        private var calls: [(system: String, user: String)] = []
        func record(_ system: String, _ user: String) {
            lock.lock(); defer { lock.unlock() }
            calls.append((system, user))
        }
        var all: [(system: String, user: String)] {
            lock.lock(); defer { lock.unlock() }
            return calls
        }
    }

    private func words(_ count: Int, prefix: String = "word") -> String {
        stride(from: 0, to: count, by: 10).map { start in
            (start..<min(start + 10, count)).map { "\(prefix)\($0)" }.joined(separator: " ") + "."
        }.joined(separator: " ")
    }

    func testShortTextIsBriefedInOneCall() async throws {
        let service = LLMCopywriterService()
        let log = CallLog()
        let engine = LLMCopywriterService.StageTwoEngine(label: "Test") { system, user, _ in
            log.record(system, user)
            return #"{"summary": "Cut cold start by caching the model. Also measure it.", "title": "\"Cold Start Plan.\""}"#
        }

        let brief = try await service.writeBrief("We should cache the model to cut cold start.", engine: engine)

        XCTAssertEqual(log.all.count, 1)
        XCTAssertEqual(log.all[0].system, service.buildBriefSystemPrompt())
        XCTAssertEqual(log.all[0].user, "Memo text:\nWe should cache the model to cut cold start.")
        XCTAssertEqual(brief, NoteBrief(title: "Cold Start Plan", summary: "Cut cold start by caching the model.", partCount: 1))
    }

    func testLongTextIsSummarizedPartByPartThenOnce() async throws {
        let service = LLMCopywriterService()
        let log = CallLog()
        let engine = LLMCopywriterService.StageTwoEngine(label: "Test") { system, user, _ in
            log.record(system, user)
            if system == service.buildBriefPartSystemPrompt() {
                // The first part is all silence: an empty summary is skipped.
                return user.hasPrefix("Part 1 of") ? #"{"summary": ""}"# : #"{"summary": "A point about kernels."}"#
            }
            return #"{"summary": "Kernel work and the team's plans.", "title": "Kernel Plans"}"#
        }

        let brief = try await service.writeBrief(words(3000), engine: engine)

        let calls = log.all
        XCTAssertEqual(calls.count, 4, "Three parts, then the overview")
        XCTAssertEqual(calls.last?.system, service.buildBriefOverviewSystemPrompt())
        XCTAssertEqual(calls.last?.user, "Part summaries:\n1. A point about kernels.\n2. A point about kernels.")
        XCTAssertEqual(brief.title, "Kernel Plans")
        XCTAssertEqual(brief.summary, "Kernel work and the team's plans.")
        XCTAssertEqual(brief.partCount, 3)
    }

    func testVeryLongTextSummarizesAtMostTheCapOfParts() async throws {
        let service = LLMCopywriterService()
        let log = CallLog()
        let engine = LLMCopywriterService.StageTwoEngine(label: "Test") { system, user, _ in
            log.record(system, user)
            return system == service.buildBriefPartSystemPrompt()
                ? #"{"summary": "Something said."}"#
                : #"{"summary": "A long day of notes.", "title": "Day Notes"}"#
        }

        let brief = try await service.writeBrief(words(40_000), engine: engine)

        XCTAssertEqual(brief.partCount, LLMCopywriterService.briefMaxParts)
        XCTAssertEqual(log.all.count, LLMCopywriterService.briefMaxParts + 1)
    }

    func testNoReadablePartFailsTheBrief() async {
        let service = LLMCopywriterService()
        let engine = LLMCopywriterService.StageTwoEngine(label: "Test") { _, _, _ in "not json" }
        do {
            _ = try await service.writeBrief(words(3000), engine: engine)
            XCTFail("Expected the brief to fail")
        } catch {}
    }

    func testTagsAreHashtagsWithoutRepeats() throws {
        let brief = try LLMCopywriterService().parseBrief(##"{"summary": "Errands.", "title": "To Do", "tags": ["#shopping", "Shopping", "dry cleaning", "#a", "#b"]}"##, partCount: 1)
        XCTAssertEqual(brief.tags, ["#shopping", "#drycleaning", "#a", "#b"])
    }

    func testAnswerWithoutTitleOrSummaryFails() {
        let service = LLMCopywriterService()
        XCTAssertThrowsError(try service.parseBrief(#"{"summary": "Only a summary."}"#, partCount: 1))
        XCTAssertThrowsError(try service.parseBrief("no json here", partCount: 1))
    }

    func testSummaryKeepsOnlyTheFirstSentence() {
        XCTAssertEqual(
            LLMCopywriterService.firstSentence(of: "The main points are below: 1. Kernels. 2. Gaps."),
            "The main points are below: 1."
        )
        XCTAssertEqual(LLMCopywriterService.firstSentence(of: "Plan the launch.\nSecond line."), "Plan the launch.")
        XCTAssertEqual(LLMCopywriterService.firstSentence(of: "No full stop at all"), "No full stop at all")
    }

    func testTitleIsALabel() {
        XCTAssertEqual(LLMCopywriterService.briefTitle("Title: \"Launch Plan.\""), "Launch Plan")
        XCTAssertEqual(LLMCopywriterService.briefTitle("one two three four five six seven eight nine ten"), "one two three four five six seven eight")
    }

    func testBriefPromptsCarryNoDictionary() {
        let service = LLMCopywriterService()
        for prompt in [service.buildBriefSystemPrompt(), service.buildBriefPartSystemPrompt(), service.buildBriefOverviewSystemPrompt()] {
            XCTAssertFalse(prompt.contains("Personal dictionary"))
            XCTAssertTrue(prompt.contains("\"summary\""))
        }
    }

    func testEvenlySpacedKeepsFirstAndLast() {
        XCTAssertEqual(LLMCopywriterService.evenlySpaced(Array(0..<10), limit: 4), [0, 3, 6, 9])
        XCTAssertEqual(LLMCopywriterService.evenlySpaced(Array(0..<3), limit: 4), [0, 1, 2])
    }
}

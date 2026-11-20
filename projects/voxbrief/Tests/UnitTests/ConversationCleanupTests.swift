import XCTest
@testable import Voxbrief

/// Cleaning a conversation turn by turn, driven by a scripted engine (no model runs here).
final class ConversationCleanupTests: XCTestCase {

    private final class Calls: @unchecked Sendable {
        private let lock = NSLock()
        private var users: [String] = []
        func add(_ user: String) { lock.lock(); users.append(user); lock.unlock() }
        var all: [String] { lock.lock(); defer { lock.unlock() }; return users }
    }

    func testTurnsAreCleanedInOneBatchAndKeepTheirOrder() async throws {
        let service = LLMCopywriterService()
        let calls = Calls()
        let engine = LLMCopywriterService.StageTwoEngine(label: "Test") { system, user, _ in
            calls.add(user)
            XCTAssertEqual(system, service.buildTurnsSystemPrompt(dictionary: []))
            return #"{"turns": ["1. How have you been feeling?", "The itching got worse at night."]}"#
        }

        let cleaned = try await service.cleanUpTurns(
            ["how have you uh been feeling", "the itching um got worse at night"],
            dictionary: [],
            engine: engine
        )

        XCTAssertEqual(calls.all, [#"The 2 turns, as a JSON array; answer with {"turns": [...]} holding exactly 2 strings:"# + "\n" + #"["how have you uh been feeling","the itching um got worse at night"]"#])
        XCTAssertEqual(cleaned.texts, ["How have you been feeling?", "The itching got worse at night."])
        XCTAssertEqual(cleaned.engine, "Test")
    }

    func testAnswerWithTheWrongCountKeepsTheTurnsTidied() async throws {
        let service = LLMCopywriterService()
        var answers = [
            #"{"turns": ["Merged both turns into one."]}"#,
            #"{"turns": []}"#,
            #"{"turns": ["A later batch that worked fine here."]}"#
        ]
        let lock = NSLock()
        let engine = LLMCopywriterService.StageTwoEngine(label: "Test") { _, _, _ in
            lock.lock(); defer { lock.unlock() }
            return answers.removeFirst()
        }
        let long = Array(repeating: "word", count: 500).joined(separator: " ")

        let cleaned = try await service.cleanUpTurns(
            ["um first turn here", "second um turn", long, "a later batch that worked fine here"],
            dictionary: [],
            engine: engine
        )

        XCTAssertEqual(cleaned.texts[0], "First turn here", "Fillers removed without the model")
        XCTAssertEqual(cleaned.texts[1], "Second turn")
        XCTAssertEqual(cleaned.texts[3], "A later batch that worked fine here.")
        XCTAssertTrue(answers.isEmpty)
    }

    func testASummarizedTurnIsNotUsed() {
        let service = LLMCopywriterService()
        let input = "so we talked about the bile acid level and it takes about a week to come back and the liver tests look fine"
        let parsed = service.parseTurns(#"{"turns": ["Tests discussed."]}"#, inputs: [input])
        let answers = try? XCTUnwrap(parsed)
        XCTAssertEqual(answers?.count, 1)
        XCTAssertEqual(answers?.first, .some(nil), "Too short to be the same turn proofread")
    }

    func testNoBatchCleanedThrowsSoTheNextEngineIsTried() async {
        let service = LLMCopywriterService()
        let engine = LLMCopywriterService.StageTwoEngine(label: "Test") { _, _, _ in "not json" }
        do {
            _ = try await service.cleanUpTurns(["one turn", "another turn"], dictionary: [], engine: engine)
            XCTFail("Expected a throw")
        } catch {}
    }

    func testBatchesStayUnderTheWordTarget() {
        let turn = Array(repeating: "word", count: 200).joined(separator: " ")
        XCTAssertEqual(LLMCopywriterService.turnBatches([turn, turn, turn, "short"]), [0..<2, 2..<4])
        XCTAssertEqual(LLMCopywriterService.turnBatches(Array(repeating: "hi", count: 20)), [0..<12, 12..<20])
    }

    // MARK: - The conversation report (the cleaned text)

    private let conversation = "Speaker 1: How have you been feeling?\n\nSpeaker 2: The itching got worse at night.\nMostly on my hands.\n\nSpeaker 1: We test the bile acid level. It takes about a week."

    func testTurnsAreReadFromTheLabels() {
        let turns = LLMCopywriterService.conversationTurns(conversation + "\n\nAnd one more thing.")
        XCTAssertEqual(turns.map(\.speaker), ["Speaker 1", "Speaker 2", "Speaker 1"])
        XCTAssertEqual(turns[1].said, "The itching got worse at night.\nMostly on my hands.")
        XCTAssertEqual(turns[2].said, "We test the bile acid level. It takes about a week. And one more thing.", "An unlabeled paragraph continues the turn")
    }

    func testAModelThatWritesReportsGetsTheTurnsAsJSON() async throws {
        let service = LLMCopywriterService()
        let calls = Calls()
        let engine = LLMCopywriterService.StageTwoEngine(label: "Test") { system, user, _ in
            calls.add(user)
            XCTAssertEqual(system, service.buildConversationSystemPrompt(dictionary: []))
            return ##"{"report": "Speaker 2 said the itching got worse at night. Speaker 1 said the bile acid test takes a week.", "title": "Itching Follow-up", "summary": "A bile acid test is due.", "tags": ["#health"]}"##
        }

        let result = try await service.process(transcript: conversation, mode: .conversation, dictionary: [], templates: [], engine: engine)

        XCTAssertEqual(calls.all.count, 1)
        XCTAssertTrue(calls.all[0].contains(#"{"said":"How have you been feeling?","speaker":"Speaker 1"}"#), calls.all[0])
        XCTAssertEqual(result.cleanedMarkdown, "Speaker 2 said the itching got worse at night. Speaker 1 said the bile acid test takes a week.")
        XCTAssertEqual(result.title, "Itching Follow-up")
        XCTAssertEqual(result.summary, "A bile acid test is due.")
    }

    func testTurnsCopiedBackFallBackToTheLightCleanup() async throws {
        let service = LLMCopywriterService()
        let calls = Calls()
        let engine = LLMCopywriterService.StageTwoEngine(label: "Test") { system, user, _ in
            calls.add(system)
            if system == service.buildConversationSystemPrompt(dictionary: []) {
                return #"{"report": "Speaker 1: How have you been feeling? Speaker 2: The itching got worse at night. Speaker 1: We test it.", "title": "Visit", "summary": "A visit.", "tags": []}"#
            }
            XCTAssertFalse(user.contains("Speaker 1:"), "The light cleanup reads what was said, without the labels")
            return ##"{"cleanedText": "How have you been feeling? The itching got worse at night.", "title": "Itching", "summary": "Itching at night.", "tags": ["#health"]}"##
        }

        let result = try await service.process(transcript: conversation, mode: .conversation, dictionary: [], templates: [], engine: engine)

        XCTAssertEqual(calls.all.count, 2)
        XCTAssertEqual(result.cleanedMarkdown, "How have you been feeling? The itching got worse at night.")
        XCTAssertEqual(result.title, "Itching")
    }

    func testLiteGoesStraightToTheLightCleanup() async throws {
        let service = LLMCopywriterService()
        let calls = Calls()
        let engine = LLMCopywriterService.StageTwoEngine(label: "Lite", writesReports: false) { system, _, _ in
            calls.add(system)
            return #"{"cleanedText": "How have you been feeling?", "title": "Itching", "summary": "Itching at night.", "tags": []}"#
        }

        _ = try await service.process(transcript: conversation, mode: .conversation, dictionary: [], templates: [], engine: engine)

        XCTAssertEqual(calls.all, [service.buildLightSystemPrompt(dictionary: [])])
    }

    func testIsReport() {
        let turns = LLMCopywriterService.conversationTurns(conversation)
        XCTAssertTrue(LLMCopywriterService.isReport("Speaker 2 said the itching got worse; a bile acid test takes a week.", of: turns))
        XCTAssertFalse(LLMCopywriterService.isReport("Speaker 1: How are you? Speaker 2: Itchy.", of: turns))
        XCTAssertFalse(LLMCopywriterService.isReport("", of: turns))
        let long = Array(repeating: LLMCopywriterService.ConversationTurn(speaker: "Speaker 1", said: "we talked about the bile acid test and the results"), count: 10)
        let copied = long.map(\.said).joined(separator: " ")
        XCTAssertFalse(LLMCopywriterService.isReport(copied, of: long), "As long as the turns: copied, not reported")
    }

    func testPartsKeepWholeTurns() {
        let turn = LLMCopywriterService.ConversationTurn(speaker: "Speaker 1", said: Array(repeating: "word", count: 400).joined(separator: " "))
        XCTAssertEqual(LLMCopywriterService.conversationParts([turn, turn, turn, turn]).map(\.count), [2, 2])
    }

    // MARK: - Leaving the foreground

    func testABackgroundStopEndsTheRunInsteadOfFallingBack() async {
        let service = LLMCopywriterService()
        let calls = Calls()
        let engine = LLMCopywriterService.StageTwoEngine(label: "Flash") { system, _, _ in
            calls.add(system)
            throw OnDeviceLLMError.unavailableWhileBackgrounded
        }
        do {
            _ = try await service.process(transcript: conversation, mode: .conversation, dictionary: [], templates: [], engine: engine)
            XCTFail("Expected the stop to propagate")
        } catch {
            XCTAssertTrue(error.stopsStageTwo)
        }
        XCTAssertEqual(calls.all.count, 1, "No light-cleanup fallback after the GPU was taken away")

        do {
            _ = try await service.cleanUpTurns(["one turn here", "and another one"], dictionary: [], engine: engine)
            XCTFail("Expected the stop to propagate")
        } catch {
            XCTAssertTrue(error.stopsStageTwo)
        }
    }

    func testGPUGate() {
        let gate = OnDeviceLLMService.GPUGate()
        XCTAssertTrue(gate.isOpen)
        gate.setForeground(false)
        XCTAssertFalse(gate.isOpen, "Closed as soon as the app starts leaving the foreground")
        gate.setGranted(true)
        XCTAssertTrue(gate.isOpen, "A continued-processing task's GPU grant keeps it open")
        gate.setGranted(false)
        gate.setForeground(true)
        XCTAssertTrue(gate.isOpen)
        XCTAssertFalse(OnDeviceLLMError.unavailableInSimulator.stopsStageTwo)
    }
}

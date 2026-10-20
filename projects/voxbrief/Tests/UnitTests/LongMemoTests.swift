import XCTest
@testable import Voxbrief

/// Stage 2 on long memos: splitting into parts, merging the parts' sections, and the whole
/// map-then-overview flow driven by a scripted engine (no model runs here).
final class LongMemoTests: XCTestCase {

    private func sentences(_ count: Int, wordsEach: Int = 10, prefix: String = "Word") -> String {
        (0..<count).map { index in
            (0..<wordsEach).map { "\(prefix)\(index)x\($0)" }.joined(separator: " ") + "."
        }.joined(separator: " ")
    }

    func testShortTranscriptIsOnePart() {
        let parts = LLMCopywriterService.splitIntoParts(sentences(10), threshold: 1500, target: 1000, overlap: true)
        XCTAssertEqual(parts.count, 1)
        XCTAssertEqual(parts[0].startFraction, 0)
    }

    func testLongTranscriptSplitsOnSentencesWithOverlap() {
        // 300 sentences x 10 words = 3,000 words -> three parts of 1,000.
        let transcript = sentences(300)
        let parts = LLMCopywriterService.splitIntoParts(transcript, threshold: 1500, target: 1000, overlap: true)
        XCTAssertEqual(parts.count, 3)
        XCTAssertEqual(parts.map(\.startFraction), [0, 1.0 / 3, 2.0 / 3], accuracy: 0.001)
        // The second part repeats the first part's last sentence.
        XCTAssertTrue(parts[1].text.hasPrefix("Word99x0 "))
        XCTAssertTrue(parts[0].text.hasSuffix("Word99x9."))
        for part in parts {
            XCTAssertLessThanOrEqual(part.text.split(separator: " ").count, 1010)
        }
    }

    func testNoOverlapPartsCoverEveryWordOnce() {
        let transcript = sentences(150)
        let parts = LLMCopywriterService.splitIntoParts(transcript, threshold: 700, target: 600, overlap: false)
        XCTAssertGreaterThan(parts.count, 1)
        XCTAssertEqual(parts.map(\.text).joined(separator: " ").split(separator: " "), transcript.split(separator: " "))
    }

    func testUnpunctuatedTranscriptIsCutIntoWordWindows() {
        let transcript = (0..<2200).map { "w\($0)" }.joined(separator: " ")
        let parts = LLMCopywriterService.splitIntoParts(transcript, threshold: 1500, target: 1000, overlap: false)
        XCTAssertEqual(parts.count, 2, "a 200-word tail folds into the part before it")
        XCTAssertEqual(parts.map(\.text).joined(separator: " "), transcript)
    }

    func testMergeDropsRepeatedItems() {
        let a = [TemplateSectionContent(title: "Action Items", style: .checklist, items: ["Send Priya the offline spec by Wednesday", "Share the freeze date"])]
        let b = [TemplateSectionContent(title: "Action Items", style: .checklist, items: ["send priya the offline spec by wednesday!", "Draft the Android estimate"])]
        let merged = LLMCopywriterService.mergePartSections([a, b])
        XCTAssertEqual(merged.first?.items, ["Send Priya the offline spec by Wednesday", "Share the freeze date", "Draft the Android estimate"])
    }

    func testMergedTagsPreferFrequent() {
        XCTAssertEqual(LLMCopywriterService.mergedTags([["#q4", "#roadmap"], ["#Roadmap", "#android"]]), ["#roadmap", "#q4", "#android"])
    }

    func testLongMemoIsReadInPartsAndMerged() async throws {
        let template = NoteTemplate.builtIns.first { $0.sections.contains { $0.style == .checklist } }!
        let checklistKey = template.sections.first { $0.style == .checklist }!.fieldKey
        let calls = CallLog()
        let engine = LLMCopywriterService.StageTwoEngine(label: "Test") { system, user, _ in
            await calls.add(user)
            if system.contains("title and summary of one long voice memo") {
                return ##"{"title": "Q4 roadmap", "summary": "The whole memo.", "tags": ["#q4"]}"##
            }
            let part = user.contains("part 1 of") ? 1 : 2
            return ##"{"title": "Part \##(part)", "summary": "Summary \##(part).", "\##(checklistKey)": ["Shared item", "Item \##(part)"], "tags": ["#p\##(part)"]}"##
        }
        let result = try await LLMCopywriterService().process(transcript: sentences(200), mode: .full, dictionary: [], templates: [template], engine: engine)

        XCTAssertEqual(result.title, "Q4 roadmap")
        XCTAssertEqual(result.summary, "The whole memo.")
        XCTAssertEqual(result.parts.map(\.summary), ["Summary 1.", "Summary 2."])
        XCTAssertEqual(result.parts.first?.startFraction, 0)
        let items = result.sections.first { $0.style == .checklist }?.items
        XCTAssertEqual(items, ["Shared item", "Item 1", "Item 2"])
        let userPrompts = await calls.all
        XCTAssertEqual(userPrompts.count, 3, "two parts + one overview; a single template needs no classification")
    }

    func testShortMemoStaysOnePass() async throws {
        let template = NoteTemplate.builtIns[0]
        let calls = CallLog()
        let engine = LLMCopywriterService.StageTwoEngine(label: "Test") { _, user, _ in
            await calls.add(user)
            return ##"{"title": "Short", "summary": "One pass.", "tags": []}"##
        }
        let result = try await LLMCopywriterService().process(transcript: "Buy milk and call the dentist.", mode: .full, dictionary: [], templates: [template], engine: engine)
        XCTAssertTrue(result.parts.isEmpty)
        let count = await calls.all.count
        XCTAssertEqual(count, 1)
    }
}

private actor CallLog {
    private(set) var all: [String] = []
    func add(_ prompt: String) { all.append(prompt) }
}

private func XCTAssertEqual(_ a: [Double], _ b: [Double], accuracy: Double, file: StaticString = #filePath, line: UInt = #line) {
    XCTAssertEqual(a.count, b.count, file: file, line: line)
    for (x, y) in zip(a, b) { XCTAssertEqual(x, y, accuracy: accuracy, file: file, line: line) }
}

/// 07: timings recorded per Stage 2 call, and the classification reading only the opening.
final class StageTwoTimingTests: XCTestCase {
    func testClassificationReadsTheOpeningOnly() {
        let service = LLMCopywriterService()
        let long = (0..<1000).map { "w\($0)" }.joined(separator: " ")
        let input = service.classificationInput(long)
        XCTAssertEqual(input.split(separator: " ").count, LLMCopywriterService.classificationInputWords + 1)
        XCTAssertEqual(service.classificationInput("short memo"), "short memo")
    }

    func testEveryCallIsTimed() async throws {
        let engine = LLMCopywriterService.StageTwoEngine(label: "Test") { system, _, _ in
            system.contains("choose which note-taking template")
                ? ##"{"template": "General Notes"}"##
                : ##"{"title": "T", "summary": "S", "tags": []}"##
        }
        let result = try await LLMCopywriterService().process(transcript: "A thought about onboarding.", mode: .full, dictionary: [], templates: NoteTemplate.builtIns, engine: engine)
        XCTAssertEqual(result.timings.map(\.name), ["Pick template", "Write note"])
    }
}

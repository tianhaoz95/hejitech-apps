import XCTest
@testable import Contempo

/// The rule fallback and small-model cross-check: spoken numbers, as Whisper transcribes them.
/// Mirrors Android's RuleBasedEntryParserTest.
final class RuleBasedEntryParserTests: XCTestCase {
    private func minutes(_ text: String) -> Int? { RuleBasedEntryParser.parse(rawText: text, knownProperties: [])?.durationMinutes }

    func testSpokenDurations() {
        XCTAssertEqual(minutes("uh spent like two hours fixing the dishwasher"), 120)
        XCTAssertEqual(minutes("forty-five minutes restocking towels"), 45)
        XCTAssertEqual(minutes("twenty five minutes on the phone with a guest"), 25)
        XCTAssertEqual(minutes("an hour and a half of turnover"), 90)
        XCTAssertEqual(minutes("two and a half hours painting"), 150)
        XCTAssertEqual(minutes("half an hour answering emails"), 30)
        XCTAssertEqual(minutes("an hour at the hardware store"), 60)
        XCTAssertEqual(minutes("1 hour 20 minutes cleaning"), 80)
        XCTAssertNil(minutes("fixed the dishwasher"))
    }

    func testSpokenMilesAndTaskKeepsWords() throws {
        let draft = try XCTUnwrap(RuleBasedEntryParser.parse(rawText: "drove twelve miles to the lake house", knownProperties: ["Lake House"]))
        XCTAssertEqual(draft.miles, 12)
        XCTAssertEqual(draft.property, "Lake House")
        XCTAssertEqual(draft.task, "Drove twelve miles to the lake house")
    }

    func testStrayModelTaskFallsBackToTheCapture() {
        let model = EntryDraft(property: nil, task: "start", durationMinutes: nil, category: nil, eventType: nil, miles: nil, resolvedActivityDateIso: nil)
        let refined = RuleBasedEntryParser.refineSmallModelDraft(model, rawText: "two hours fixing the dishwasher", knownProperties: [])
        XCTAssertEqual(refined.task, "Two hours fixing the dishwasher")
        XCTAssertEqual(refined.durationMinutes, 120)
        var snake = model
        snake.task = "spend_two_hours_fixing_dishwasher"
        XCTAssertEqual(RuleBasedEntryParser.refineSmallModelDraft(snake, rawText: "two hours fixing the dishwasher", knownProperties: []).task, "Two hours fixing the dishwasher")
        var good = model
        good.task = "Fixed the dishwasher"
        XCTAssertEqual(RuleBasedEntryParser.refineSmallModelDraft(good, rawText: "two hours fixing the dishwasher", knownProperties: []).task, "Fixed the dishwasher")
    }
}

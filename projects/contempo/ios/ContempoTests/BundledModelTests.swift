import XCTest
@testable import Contempo

/// Runs the bundled on-device model (Qwen3-0.6B via LiteRT-LM) for real. Meant for a physical
/// device (the simulator has no Metal-free fast path and the model is large); skipped when the
/// bundle has no model (scripts/fetch-models.sh wasn't run).
@MainActor
final class BundledModelTests: XCTestCase {
    func testBundledModelParsesASpokenEntry() async throws {
        let llm = LiteRtLlm(downloader: ModelDownloader())
        try XCTSkipUnless(llm.bundledModelReady, "no bundled model in this build")
        let draft = await llm.extractEntryDraft(
            rawText: "uh spent like two hours fixing the dishwasher at the lake house this morning",
            knownProperties: ["Lake House", "Downtown Loft"]
        )
        let parsed = try XCTUnwrap(draft, "the bundled model returned no draft")
        print("bundled draft:", parsed)
        XCTAssertEqual(parsed.durationMinutes, 120)
        XCTAssertEqual(parsed.property, "Lake House")
        XCTAssertTrue((parsed.task ?? "").localizedCaseInsensitiveContains("dishwasher"), "task=\(parsed.task ?? "nil")")
        XCTAssertNil(parsed.eventType, "no timer phrasing in this capture")
        XCTAssertNil(parsed.miles, "no distance mentioned")
    }

    func testBundledModelAnswersAQuestion() async throws {
        let llm = LiteRtLlm(downloader: ModelDownloader())
        try XCTSkipUnless(llm.bundledModelReady, "no bundled model in this build")
        let answer = await llm.generateText("In one sentence: what does the IRS 100-hour test for short-term rentals measure?")
        let text = try XCTUnwrap(answer)
        print("bundled answer:", text)
        XCTAssertFalse(text.contains("<think>"))
        XCTAssertGreaterThan(text.count, 10)
    }
}

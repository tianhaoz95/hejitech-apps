import XCTest
@testable import Voxbrief

final class TranscriptSegmentTokenTests: XCTestCase {
    private func segment(_ text: String) -> TranscriptTimingSegment {
        TranscriptTimingSegment(start: 0, end: 1, text: text)
    }

    func testParsesLeadingAndTrailingWhisperTokens() {
        let parts = segment("<|startoftranscript|><|0.00|> Create a shopping list and<|7.54|>").parts
        XCTAssertEqual(parts, [
            .token(.startOfTranscript),
            .token(.timestamp(0)),
            .text("Create a shopping list and"),
            .token(.timestamp(7.54))
        ])
    }

    func testClassifiesLanguageTaskAndUnknownTokens() {
        let parts = segment("<|en|><|transcribe|><|notimestamps|><|nospeech|>hi<|endoftext|>").parts
        XCTAssertEqual(parts, [
            .token(.language("en")),
            .token(.task("transcribe")),
            .token(.noTimestamps),
            .token(.other("nospeech")),
            .text("hi"),
            .token(.endOfText)
        ])
    }

    func testDisplayTextStripsTokens() {
        XCTAssertEqual(segment("<|7.54|> cheese steak.<|10.78|>").displayText, "cheese steak.")
        XCTAssertEqual(segment("Plain text, no tokens").displayText, "Plain text, no tokens")
    }

    func testUnterminatedTokenIsKeptAsText() {
        XCTAssertEqual(segment("a <| b").parts, [.text("a <| b")])
    }
}

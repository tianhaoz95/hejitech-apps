import XCTest
@testable import Voxbrief

final class VoiceCommandProcessorTests: XCTestCase {

    func testScratchThatRemovesPrecedingClause() {
        let input = "We will meet on Tuesday, scratch that, we will meet on Friday."
        let result = VoiceCommandProcessor.process(input)
        XCTAssertEqual(result.cleanedTranscript, "We will meet on Friday.")
    }

    func testScratchThatRemovesPrecedingSentence() {
        let input = "The launch is canceled. Scratch that. The launch is on schedule."
        let result = VoiceCommandProcessor.process(input)
        XCTAssertEqual(result.cleanedTranscript, "The launch is on schedule.")
    }

    func testStrikeThatRemovesPrecedingClause() {
        let input = "Let's use SQLite, strike that, let's use PostgreSQL."
        let result = VoiceCommandProcessor.process(input)
        XCTAssertEqual(result.cleanedTranscript, "Let's use PostgreSQL.")
    }

    func testExtractsExplicitTitleFromBeginning() {
        let input = "Title: Weekly Standup. Discussed sprint progress."
        let result = VoiceCommandProcessor.process(input)
        XCTAssertEqual(result.explicitTitle, "Weekly Standup")
        XCTAssertEqual(result.cleanedTranscript, "Discussed sprint progress.")
    }

    func testExtractsExplicitTitleWithCallThis() {
        let input = "Call this Product Roadmap. We need to prioritize feature A."
        let result = VoiceCommandProcessor.process(input)
        XCTAssertEqual(result.explicitTitle, "Product Roadmap")
        XCTAssertEqual(result.cleanedTranscript, "We need to prioritize feature A.")
    }

    func testExtractsExplicitActionItems() {
        let input = "We met today. Action item: email the client. Action item: submit the report."
        let result = VoiceCommandProcessor.process(input)
        XCTAssertTrue(result.extractedActionItems.contains("email the client"))
        XCTAssertTrue(result.extractedActionItems.contains("submit the report"))
    }

    func testTranscriptWithoutCommandsIsUnchanged() {
        let input = "This is a clean voice note with no editing commands."
        let result = VoiceCommandProcessor.process(input)
        XCTAssertEqual(result.cleanedTranscript, input)
        XCTAssertNil(result.explicitTitle)
        XCTAssertTrue(result.extractedActionItems.isEmpty)
    }

    func testNewParagraphAndBulletPointCommands() {
        let input = "Section one summary. New paragraph. Section two bullet point first item."
        let result = VoiceCommandProcessor.process(input)
        XCTAssertTrue(result.cleanedTranscript.contains("\n\n"))
        XCTAssertTrue(result.cleanedTranscript.contains("\n- "))
    }
}

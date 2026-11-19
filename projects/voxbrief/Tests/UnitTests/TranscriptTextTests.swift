import XCTest
@testable import Voxbrief

final class TranscriptTextTests: XCTestCase {

    func testRemovesWhispersNonSpeechNotes() {
        let text = "speakers (speaking in foreign language) (silence) ( (silence) >> Coming, please."
        XCTAssertEqual(TranscriptText.removingNonSpeechAnnotations(text), "speakers >> Coming, please.")
    }

    func testKeepsLongParentheses() {
        let text = "We picked Postgres (it is relational and the whole team already knows it well) over Mongo."
        XCTAssertEqual(TranscriptText.removingNonSpeechAnnotations(text), text)
    }

    func testRemovesHesitationsWithTheirCommas() {
        XCTAssertEqual(TranscriptText.removingFillerSounds("Um, mostly okay, but the itching has been, uh, getting worse."), "Mostly okay, but the itching has been getting worse.")
        XCTAssertEqual(TranscriptText.removingFillerSounds("Fine. Uh, see you Thursday. Umbrella stays."), "Fine. See you Thursday. Umbrella stays.")
    }

    func testBreaksAtSpeakerChangeMarks() {
        let text = "How are you feeling? >> Okay, mostly. >> Good."
        XCTAssertEqual(TranscriptText.paragraphed(text), "How are you feeling?\n\nOkay, mostly.\n\nGood.")
    }

    func testGroupsSentencesIntoParagraphs() {
        let sentences = (1...12).map { "Sentence number \($0) is here." }
        let paragraphs = TranscriptText.paragraphed(sentences.joined(separator: " "), maxSentences: 5).components(separatedBy: "\n\n")
        XCTAssertEqual(paragraphs.count, 3)
        XCTAssertTrue(paragraphs[0].hasPrefix("Sentence number 1 is here."))
        XCTAssertTrue(paragraphs[1].hasPrefix("Sentence number 6 is here."))
        XCTAssertEqual(paragraphs.joined(separator: " "), sentences.joined(separator: " "), "No words lost or moved")
    }

    func testShortTailJoinsThePreviousParagraph() {
        let text = (1...5).map { "Sentence \($0) is short." }.joined(separator: " ") + " Yes."
        XCTAssertEqual(TranscriptText.paragraphed(text, maxSentences: 5).components(separatedBy: "\n\n").count, 1)
    }

    func testRunOnTextIsCutIntoWindows() {
        let text = (1...200).map { "word\($0)" }.joined(separator: " ")
        let paragraphs = TranscriptText.paragraphed(text, maxWords: 90).components(separatedBy: "\n\n")
        XCTAssertGreaterThan(paragraphs.count, 1)
        XCTAssertEqual(paragraphs.joined(separator: " "), text)
    }

    func testKeepsExistingParagraphBreaks() {
        XCTAssertEqual(TranscriptText.paragraphed("First part.\n\nSecond part."), "First part.\n\nSecond part.")
    }
}

import XCTest
@testable import Voxbrief

final class SpeakerTurnsTests: XCTestCase {

    private func segment(_ start: TimeInterval, _ end: TimeInterval, _ text: String, _ speaker: Int? = nil) -> TranscriptTimingSegment {
        TranscriptTimingSegment(start: start, end: end, text: text, speaker: speaker)
    }

    func testAssignsTheSpeakerWithTheMostOverlap() {
        let spans = [SpeakerSpan(start: 0, end: 5, speaker: 3), SpeakerSpan(start: 5, end: 12, speaker: 7)]
        let assigned = SpeakerTurns.assign([segment(0, 4, "a"), segment(4, 11, "b"), segment(20, 22, "c")], spans: spans)
        XCTAssertEqual(assigned.map(\.speaker), [3, 7, nil])
    }

    func testTurnsMergeConsecutiveSegmentsAndNumberSpeakersInOrder() {
        let segments = [
            segment(0, 2, "Hi, how have you been feeling lately?", 7),
            segment(2, 4, "Any new symptoms since last time?", 7),
            segment(4, 6, "Mostly fine, but the itching got worse.", 3),
            segment(6, 7, "Hmm.", nil),
            segment(7, 9, "Then we test the bile acid level again.", 7)
        ]
        let turns = SpeakerTurns.turns(from: segments)
        XCTAssertEqual(turns.map(\.speaker), [0, 1, 0])
        XCTAssertEqual(turns[0].text, "Hi, how have you been feeling lately? Any new symptoms since last time?")
        XCTAssertEqual(turns[1].text, "Mostly fine, but the itching got worse. Hmm.", "A segment with no speaker joins the turn before it")
        XCTAssertEqual(turns[2].start, 7)
    }

    func testASpeakerWithAlmostNoWordsIsDropped() {
        let segments = [
            segment(0, 5, "Here is my memo about the launch plan for next week.", 0),
            segment(5, 6, "Okay.", 1),
            segment(6, 9, "We ship the iPhone app first and the Mac app later.", 0)
        ]
        XCTAssertEqual(SpeakerTurns.speakerCount(in: segments), 1)
        XCTAssertTrue(SpeakerTurns.turns(from: segments).isEmpty, "One speaker is a memo, not a conversation")
    }

    func testNoSpeakersMeansNoTurns() {
        XCTAssertTrue(SpeakerTurns.turns(from: [segment(0, 3, "Just a memo with no speakers at all.")]).isEmpty)
        XCTAssertEqual(SpeakerTurns.speakerCount(in: [segment(0, 3, "Just a memo.")]), 0)
    }

    func testLinkerMatchesTheSameVoiceAcrossWindows() {
        var linker = SpeakerLinker()
        let doctor: [Float] = [1, 0, 0.1], patient: [Float] = [0, 1, 0.1]
        XCTAssertEqual(linker.link([0: doctor, 1: patient]), [0: 0, 1: 1])
        // The next window numbers them the other way round and adds a third voice.
        let mapping = linker.link([0: [0.05, 1, 0.1], 1: [1, 0.05, 0.1], 2: [0, 0, 1]])
        XCTAssertEqual(mapping, [0: 1, 1: 0, 2: 2])
        XCTAssertEqual(linker.speakerCount, 3)
    }

    func testLinkerNeverMapsTwoSpeakersOfOneWindowToOne() {
        var linker = SpeakerLinker()
        _ = linker.link([0: [1, 0]])
        XCTAssertEqual(linker.link([0: [1, 0], 1: [0.99, 0.05]]), [0: 0, 1: 1])
    }

    // MARK: - On the note

    private func conversationNote() -> VoiceNote {
        var note = VoiceNote(title: "Speaker 2's itching")
        note.speakerTurns = [
            SpeakerTurn(speaker: 0, start: 0, text: "How are you feeling?"),
            SpeakerTurn(speaker: 1, start: 2, text: "Itchy at night.\n\nMostly fine otherwise.")
        ]
        note.lightCleanedNote = "Speaker 1 asked how Speaker 2 was feeling. Speaker 2 said nights were itchy."
        note.cleanedNote = note.lightCleanedNote ?? ""
        note.summary = "Speaker 2 has itching at night; Speaker 10 was not there."
        return note
    }

    func testConversationTextNamesEachTurn() {
        XCTAssertEqual(conversationNote().conversationText, "Speaker 1: How are you feeling?\n\nSpeaker 2: Itchy at night.\nMostly fine otherwise.")
    }

    func testRenamingASpeakerRenamesThemInTheText() {
        var note = conversationNote()
        note.renameSpeaker(1, to: " Mia ")
        XCTAssertEqual(note.speakerName(1), "Mia")
        XCTAssertEqual(note.cleanedNote, "Speaker 1 asked how Mia was feeling. Mia said nights were itchy.")
        XCTAssertEqual(note.lightCleanedNote, note.cleanedNote)
        XCTAssertEqual(note.summary, "Mia has itching at night; Speaker 10 was not there.", "Only the whole label")
        XCTAssertEqual(note.title, "Mia's itching")
        XCTAssertTrue(note.conversationText!.contains("Mia: Itchy at night."))

        note.renameSpeaker(1, to: "")
        XCTAssertEqual(note.speakerName(1), "Speaker 2")
        XCTAssertNil(note.speakerNames["1"])
        XCTAssertEqual(note.title, "Speaker 2's itching")
    }

    func testSpokenTextDropsTokensAndNotes() {
        let segment = TranscriptTimingSegment(start: 0, end: 1, text: "<|startoftranscript|><|0.00|> (<|0.00|> >> Hi, guys. <|18.50|> (silence) How are you? <|21.90|><|endoftext|>")
        XCTAssertEqual(SpeakerTurns.spokenText(segment), "Hi, guys. How are you?")
        XCTAssertEqual(SpeakerTurns.spokenText(TranscriptTimingSegment(start: 0, end: 1, text: "<|startoftranscript|><|0.00|> <|4.18|><|endoftext|>")), "")
    }

    func testNotesFromBeforeSpeakersStillDecode() throws {
        var note = VoiceNote(title: "Old")
        note.transcriptSegments = [TranscriptTimingSegment(start: 0, end: 1, text: "hi")]
        let encoder = JSONEncoder()
        var json = try XCTUnwrap(JSONSerialization.jsonObject(with: encoder.encode(note)) as? [String: Any])
        json.removeValue(forKey: "speakerCount")
        json.removeValue(forKey: "speakerTurns")
        json.removeValue(forKey: "speakerNames")
        var segments = try XCTUnwrap(json["transcriptSegments"] as? [[String: Any]])
        segments[0].removeValue(forKey: "speaker")
        json["transcriptSegments"] = segments
        let decoded = try JSONDecoder().decode(VoiceNote.self, from: JSONSerialization.data(withJSONObject: json))
        XCTAssertNil(decoded.speakerCount)
        XCTAssertTrue(decoded.speakerTurns.isEmpty)
        XCTAssertNil(decoded.transcriptSegments.first?.speaker)
    }
}

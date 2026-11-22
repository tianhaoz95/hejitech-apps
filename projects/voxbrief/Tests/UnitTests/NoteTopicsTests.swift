import XCTest
@testable import Voxbrief

/// Talk about one subject, in timed segments: sentences drawn from the subject's words and
/// everyday ones, the same every run.
enum TopicTranscriptFixture {
    static let cooking = ["recipe", "garlic", "onion", "oven", "simmer", "sauce", "pasta", "tomato", "basil", "dinner", "kitchen", "salt", "pepper", "boil", "chop", "flavor"]
    static let car = ["engine", "brake", "mechanic", "tire", "garage", "oil", "transmission", "battery", "repair", "quote", "rotor", "warranty", "dashboard", "inspection", "mileage", "clutch"]
    static let budget = ["budget", "invoice", "spending", "savings", "expense", "quarter", "revenue", "forecast", "payroll", "taxes", "receipt", "account", "balance", "spreadsheet", "cost", "profit"]
    static let common = ["the", "we", "should", "probably", "and", "then", "it", "was", "really", "about", "maybe", "this", "week", "so", "I", "think", "that", "is", "going", "to", "be", "okay"]

    /// `sentences` sentences of 12 words, 5 seconds each, from `start`.
    static func segments(_ words: [String], sentences: Int, start: TimeInterval, seed: UInt64) -> [TranscriptTimingSegment] {
        var state = seed
        func next(_ bound: Int) -> Int {
            state = state &* 6364136223846793005 &+ 1442695040888963407
            return Int((state >> 33) % UInt64(bound))
        }
        return (0..<sentences).map { index in
            let sentence = (0..<12).map { slot in slot % 3 == 0 ? words[next(words.count)] : common[next(common.count)] }
            let begin = start + Double(index) * 5
            return TranscriptTimingSegment(start: begin, end: begin + 5, text: sentence.joined(separator: " ").capitalized + ".")
        }
    }
}

final class NoteTopicsTests: XCTestCase {
    func testThreeSubjectsBecomeThreeTopics() throws {
        let segments = TopicTranscriptFixture.segments(TopicTranscriptFixture.cooking, sentences: 120, start: 0, seed: 1)
            + TopicTranscriptFixture.segments(TopicTranscriptFixture.car, sentences: 120, start: 600, seed: 2)
            + TopicTranscriptFixture.segments(TopicTranscriptFixture.budget, sentences: 120, start: 1200, seed: 3)

        let spans = try XCTUnwrap(NoteTopics.split(segments))

        XCTAssertEqual(spans.count, 3)
        XCTAssertEqual(spans.map(\.segments.lowerBound), [0, 120, 240], "Cut where the subject changes, within a block")
        XCTAssertEqual(spans.last?.segments.upperBound, segments.count)
        XCTAssertEqual(spans.map(\.start), [0, 600, 1200])
    }

    func testOneSubjectIsNotSplit() {
        let segments = TopicTranscriptFixture.segments(TopicTranscriptFixture.cooking, sentences: 400, start: 0, seed: 4)
        XCTAssertNil(NoteTopics.split(segments))
    }

    func testALongSilenceEndsATopicEvenOnTheSameSubject() throws {
        let segments = TopicTranscriptFixture.segments(TopicTranscriptFixture.cooking, sentences: 20, start: 0, seed: 5)
            + TopicTranscriptFixture.segments(TopicTranscriptFixture.cooking, sentences: 20, start: 100 + 1800, seed: 6)

        let spans = try XCTUnwrap(NoteTopics.split(segments))

        XCTAssertEqual(spans.map(\.segments), [0..<20, 20..<40])
        XCTAssertEqual(spans[0].end, 100)
        XCTAssertEqual(spans[1].start, 1900)
    }

    func testAFewWordsBetweenSilencesGoWithANeighbour() throws {
        let segments = TopicTranscriptFixture.segments(TopicTranscriptFixture.cooking, sentences: 20, start: 0, seed: 7)
            + [TranscriptTimingSegment(start: 1000, end: 1003, text: "Hello there.")]
            + TopicTranscriptFixture.segments(TopicTranscriptFixture.car, sentences: 20, start: 2000, seed: 8)

        let spans = try XCTUnwrap(NoteTopics.split(segments))

        XCTAssertEqual(spans.count, 2)
        XCTAssertEqual(spans.flatMap { Array($0.segments) }, Array(segments.indices), "Every segment is in one topic")
    }

    func testSegmentsWithoutSpeechStayInTheirTopic() throws {
        var segments = TopicTranscriptFixture.segments(TopicTranscriptFixture.cooking, sentences: 120, start: 0, seed: 9)
        segments.append(TranscriptTimingSegment(start: 600, end: 610, text: "[BLANK_AUDIO]"))
        segments += TopicTranscriptFixture.segments(TopicTranscriptFixture.car, sentences: 120, start: 610, seed: 10)

        let spans = try XCTUnwrap(NoteTopics.split(segments))

        XCTAssertEqual(spans.count, 2)
        XCTAssertEqual(spans.flatMap { Array($0.segments) }, Array(segments.indices))
        XCTAssertFalse(NoteTopics.text(of: spans[0], in: segments).contains("BLANK"))
    }

    func testStopWordsAndFillersAreNotTerms() {
        XCTAssertNil(NoteTopics.term("the"))
        XCTAssertNil(NoteTopics.term("Yeah,"))
        XCTAssertNil(NoteTopics.term("um"))
        XCTAssertEqual(NoteTopics.term("Brakes."), "brake")
        XCTAssertEqual(NoteTopics.term("mechanic's"), "mechanic")
        XCTAssertEqual(NoteTopics.term("glass"), "glass")
    }

    func testMarkdownHasAHeadingPerTopic() {
        let start = Date(timeIntervalSince1970: 1_700_000_000)
        let topics = [
            NoteTopic(start: 0, end: 600, title: "Dinner Plans", summary: "Pasta tonight.", text: "We make pasta."),
            NoteTopic(start: 3600, end: 4200, title: "Car Repair", summary: "", text: "The brakes squeak.")
        ]
        let markdown = NoteTopics.markdown(of: topics, recordingStart: start)
        let first = start.formatted(date: .omitted, time: .shortened)
        let second = start.addingTimeInterval(3600).formatted(date: .omitted, time: .shortened)

        XCTAssertEqual(markdown, "### \(first) · Dinner Plans\n> Pasta tonight.\n\nWe make pasta.\n\n### \(second) · Car Repair\n\nThe brakes squeak.")
        XCTAssertEqual(NoteTopics.summary(of: topics), "2 topics: Dinner Plans · Car Repair")
    }

    func testRenamingASpeakerRenamesThemInTheTopics() {
        var note = VoiceNote()
        note.topics = [NoteTopic(start: 0, end: 1, title: "Speaker 1 on Brakes", summary: "Speaker 1 wants a quote.", text: "Speaker 1 asked.")]
        note.renameSpeaker(0, to: "Sam")
        XCTAssertEqual(note.topics[0].title, "Sam on Brakes")
        XCTAssertEqual(note.topics[0].summary, "Sam wants a quote.")
        XCTAssertEqual(note.topics[0].text, "Sam asked.")
    }

    func testTopicsRoundTripAndOldNotesDecodeWithout() throws {
        var note = VoiceNote()
        note.topics = [NoteTopic(start: 0, end: 60, title: "A", summary: "B", text: "C")]
        let decoded = try JSONDecoder().decode(VoiceNote.self, from: JSONEncoder().encode(note))
        XCTAssertEqual(decoded.topics, note.topics)

        var json = try XCTUnwrap(JSONSerialization.jsonObject(with: JSONEncoder().encode(VoiceNote())) as? [String: Any])
        json.removeValue(forKey: "topics")
        let old = try JSONDecoder().decode(VoiceNote.self, from: JSONSerialization.data(withJSONObject: json))
        XCTAssertEqual(old.topics, [])
    }
}

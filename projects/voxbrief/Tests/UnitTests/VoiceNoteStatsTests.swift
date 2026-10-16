import XCTest
@testable import Voxbrief

final class VoiceNoteStatsTests: XCTestCase {

    func testWordCountAndReadingTime() {
        let sampleText = "The quick brown fox jumps over the lazy dog. " +
            "Voice notes capture spontaneous thoughts directly from your wrist or phone. " +
            "Automatic copywriting formats requirements, conditions, and action items effortlessly."

        let note = VoiceNote(
            id: UUID(),
            cleanedNote: sampleText
        )

        XCTAssertGreaterThan(note.wordCount, 20)
        XCTAssertEqual(note.formattedReadingTime, "< 1 min read")
        XCTAssertGreaterThan(note.readingTimeMinutes, 0.0)

        // Empty note
        let emptyNote = VoiceNote(id: UUID())
        XCTAssertEqual(emptyNote.wordCount, 0)
        XCTAssertEqual(emptyNote.formattedReadingTime, "< 1 min read")
    }

    func testActionItemsProgress() {
        let note = VoiceNote(
            id: UUID(),
            actionItems: ["Task A", "Task B", "Task C", "Task D"],
            completedActionItems: ["Task A", "Task C"]
        )

        let progress = note.actionItemsProgress
        XCTAssertEqual(progress.completed, 2)
        XCTAssertEqual(progress.total, 4)
        XCTAssertEqual(progress.ratio, 0.5, accuracy: 0.01)

        let emptyActionsNote = VoiceNote(id: UUID())
        XCTAssertEqual(emptyActionsNote.actionItemsProgress.total, 0)
        XCTAssertEqual(emptyActionsNote.actionItemsProgress.completed, 0)
        XCTAssertEqual(emptyActionsNote.actionItemsProgress.ratio, 0.0)
    }

    func testNewVoiceNoteFieldsBackwardCompatibility() throws {
        let note = VoiceNote(
            id: UUID(),
            title: "Test Note",
            isPinned: true,
            isArchived: true,
            colorTag: "blue",
            isLocked: true
        )

        let encoder = JSONEncoder()
        let data = try encoder.encode(note)

        let decoder = JSONDecoder()
        let decoded = try decoder.decode(VoiceNote.self, from: data)

        XCTAssertEqual(decoded.isPinned, true)
        XCTAssertEqual(decoded.isArchived, true)
        XCTAssertEqual(decoded.colorTag, "blue")
        XCTAssertEqual(decoded.isLocked, true)
    }
}

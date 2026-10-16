import XCTest
@testable import Voxbrief

@MainActor
final class NoteRepositoryExtendedTests: XCTestCase {

    var tempStorageURL: URL!
    var repository: NoteRepository!

    override func setUp() async throws {
        try await super.setUp()
        tempStorageURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("test_extended_notes_\(UUID().uuidString).json")
        repository = NoteRepository(customStorageURL: tempStorageURL)
    }

    override func tearDown() async throws {
        try? FileManager.default.removeItem(at: tempStorageURL)
        repository = nil
        try await super.tearDown()
    }

    func testPinAndArchiveToggles() {
        let note = VoiceNote(id: UUID(), title: "Original Note")
        repository.save(note)

        XCTAssertFalse(repository.note(withId: note.id)?.isPinned ?? true)
        XCTAssertFalse(repository.note(withId: note.id)?.isArchived ?? true)

        repository.togglePinned(id: note.id)
        XCTAssertTrue(repository.note(withId: note.id)?.isPinned ?? false)

        repository.toggleArchived(id: note.id)
        XCTAssertTrue(repository.note(withId: note.id)?.isArchived ?? false)

        repository.togglePinned(id: note.id)
        XCTAssertFalse(repository.note(withId: note.id)?.isPinned ?? true)
    }

    func testColorTagAndLockToggle() {
        let note = VoiceNote(id: UUID(), title: "Secret Idea")
        repository.save(note)

        repository.setColorTag(id: note.id, colorTag: "emerald")
        XCTAssertEqual(repository.note(withId: note.id)?.colorTag, "emerald")

        repository.toggleLocked(id: note.id)
        XCTAssertTrue(repository.note(withId: note.id)?.isLocked ?? false)
    }

    func testTagAddAndRemove() {
        let note = VoiceNote(id: UUID(), title: "Tagged Note")
        repository.save(note)

        repository.addTag(id: note.id, tag: "swiftui")
        XCTAssertTrue(repository.note(withId: note.id)?.tags.contains("#swiftui") ?? false)

        // Adding duplicate doesn't duplicate
        repository.addTag(id: note.id, tag: "#swiftui")
        XCTAssertEqual(repository.note(withId: note.id)?.tags.filter { $0 == "#swiftui" }.count, 1)

        repository.removeTag(id: note.id, tag: "#swiftui")
        XCTAssertFalse(repository.note(withId: note.id)?.tags.contains("#swiftui") ?? true)
    }

    func testDuplicateNote() {
        let note = VoiceNote(
            id: UUID(),
            duration: 50.0,
            title: "Original Document",
            summary: "Original summary",
            requirements: ["Req 1"],
            tags: ["#original"]
        )
        repository.save(note)

        let copy = repository.duplicate(id: note.id)
        XCTAssertNotNil(copy)
        XCTAssertNotEqual(copy?.id, note.id)
        XCTAssertEqual(copy?.title, "Original Document (Copy)")
        XCTAssertEqual(copy?.summary, "Original summary")
        XCTAssertEqual(copy?.requirements, ["Req 1"])
        XCTAssertEqual(copy?.tags, ["#original"])
    }

    func testBulkOperations() {
        let note1 = VoiceNote(id: UUID(), title: "Note 1")
        let note2 = VoiceNote(id: UUID(), title: "Note 2")
        let note3 = VoiceNote(id: UUID(), title: "Note 3")
        repository.save(note1)
        repository.save(note2)
        repository.save(note3)

        repository.bulkArchive(ids: [note1.id, note2.id], archive: true)
        XCTAssertTrue(repository.note(withId: note1.id)?.isArchived ?? false)
        XCTAssertTrue(repository.note(withId: note2.id)?.isArchived ?? false)
        XCTAssertFalse(repository.note(withId: note3.id)?.isArchived ?? true)

        repository.bulkDelete(ids: [note1.id, note2.id])
        XCTAssertNil(repository.note(withId: note1.id))
        XCTAssertNil(repository.note(withId: note2.id))
        XCTAssertNotNil(repository.note(withId: note3.id))
    }

    func testLibraryMetrics() {
        for note in repository.notes {
            repository.delete(id: note.id)
        }
        let note1 = VoiceNote(
            id: UUID(),
            duration: 100,
            cleanedNote: "First note with six words.",
            actionItems: ["Task 1", "Task 2"],
            completedActionItems: ["Task 1"]
        )
        let note2 = VoiceNote(
            id: UUID(),
            duration: 200,
            cleanedNote: "Second note with five words.",
            actionItems: ["Task 3"],
            completedActionItems: []
        )
        repository.save(note1)
        repository.save(note2)

        XCTAssertGreaterThanOrEqual(repository.totalAudioDuration, 300)
        XCTAssertGreaterThan(repository.totalWordCount, 8)
        let stats = repository.totalActionItemsStats
        XCTAssertEqual(stats.completed, 1)
        XCTAssertEqual(stats.total, 3)
    }
}

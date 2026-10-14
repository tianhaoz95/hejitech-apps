import XCTest
@testable import Voxbrief

final class DataBackupServiceTests: XCTestCase {

    func testBackupAndRestoreRoundTrip() throws {
        let note1 = VoiceNote(
            id: UUID(),
            createdAt: Date(),
            duration: 45.0,
            title: "Backup Test Note 1",
            summary: "Testing backup serialization",
            rawTranscript: "Transcript 1",
            cleanedNote: "Cleaned 1",
            tags: ["#test", "#backup"]
        )

        let note2 = VoiceNote(
            id: UUID(),
            createdAt: Date().addingTimeInterval(-3600),
            duration: 90.0,
            title: "Backup Test Note 2",
            summary: "Second note for backup",
            rawTranscript: "Transcript 2",
            cleanedNote: "Cleaned 2",
            isPinned: true,
            isArchived: false,
            colorTag: "purple",
            isLocked: true
        )

        let backupURL = DataBackupService.shared.createBackupFile(for: [note1, note2])
        XCTAssertNotNil(backupURL)
        guard let url = backupURL else { return }

        XCTAssertTrue(FileManager.default.fileExists(atPath: url.path))

        let restored = try DataBackupService.shared.restoreNotes(from: url)
        XCTAssertEqual(restored.count, 2)
        XCTAssertEqual(restored[0].id, note1.id)
        XCTAssertEqual(restored[0].title, "Backup Test Note 1")
        XCTAssertEqual(restored[1].id, note2.id)
        XCTAssertEqual(restored[1].isPinned, true)
        XCTAssertEqual(restored[1].colorTag, "purple")
        XCTAssertEqual(restored[1].isLocked, true)

        try? FileManager.default.removeItem(at: url)
    }

    func testRestoreRejectsInvalidFile() {
        let tempURL = FileManager.default.temporaryDirectory.appendingPathComponent("invalid.json")
        try? "not a json".write(to: tempURL, atomically: true, encoding: .utf8)

        XCTAssertThrowsError(try DataBackupService.shared.restoreNotes(from: tempURL))

        try? FileManager.default.removeItem(at: tempURL)
    }
}

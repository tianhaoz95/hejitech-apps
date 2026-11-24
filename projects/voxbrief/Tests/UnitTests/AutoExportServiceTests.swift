import XCTest
@testable import Voxbrief

@MainActor
final class AutoExportServiceTests: XCTestCase {
    private var tempDir: URL!
    private var defaults: UserDefaults!
    private var suiteName: String!
    private var service: AutoExportService!

    override func setUp() {
        super.setUp()
        tempDir = FileManager.default.temporaryDirectory.appendingPathComponent("AutoExportTests-\(UUID().uuidString)", isDirectory: true)
        try? FileManager.default.createDirectory(at: tempDir, withIntermediateDirectories: true)
        suiteName = "com.voxbrief.tests.autoexport.\(UUID().uuidString)"
        defaults = UserDefaults(suiteName: suiteName)!
        service = AutoExportService(defaults: defaults, customDirectoryURL: tempDir)
        service.isEnabled = true
    }

    override func tearDown() {
        try? FileManager.default.removeItem(at: tempDir)
        defaults.removePersistentDomain(forName: suiteName)
        super.tearDown()
    }

    func testExportsReadyNoteWithFrontmatter() throws {
        let date = ISO8601DateFormatter().date(from: "2026-11-23T18:00:00Z")!
        let note = VoiceNote(
            createdAt: date,
            title: "Sprint Planning",
            cleanedNote: "We agreed to ship iCloud sync next.",
            tags: ["#work", "#planning"],
            status: .ready
        )

        XCTAssertTrue(service.syncNote(note))

        let files = try FileManager.default.contentsOfDirectory(atPath: tempDir.path)
        XCTAssertEqual(files.count, 1)
        XCTAssertTrue(files[0].hasSuffix("-sprint-planning.md"))

        let content = try String(contentsOf: tempDir.appendingPathComponent(files[0]), encoding: .utf8)
        XCTAssertTrue(content.contains("title: \"Sprint Planning\""))
        XCTAssertTrue(content.contains("We agreed to ship iCloud sync next."))
    }

    func testRenameReplacesOldFileWithoutDuplicate() throws {
        var note = VoiceNote(title: "Initial Draft", cleanedNote: "Hello world.", status: .ready)
        XCTAssertTrue(service.syncNote(note))

        note.title = "Renamed Meeting"
        XCTAssertTrue(service.syncNote(note))

        let files = try FileManager.default.contentsOfDirectory(atPath: tempDir.path)
        XCTAssertEqual(files.count, 1)
        XCTAssertTrue(files[0].hasSuffix("-renamed-meeting.md"))
    }

    func testLockedNoteIsSkippedAndRemovedIfPreviouslyExported() throws {
        var note = VoiceNote(title: "Private Thoughts", cleanedNote: "Secret content.", status: .ready, isLocked: false)
        XCTAssertTrue(service.syncNote(note))
        XCTAssertEqual(try FileManager.default.contentsOfDirectory(atPath: tempDir.path).count, 1)

        note.isLocked = true
        XCTAssertFalse(service.syncNote(note))
        XCTAssertEqual(try FileManager.default.contentsOfDirectory(atPath: tempDir.path).count, 0)
    }

    func testCollisionDisambiguatesWithShortId() throws {
        let date = Date()
        let first = VoiceNote(createdAt: date, title: "Daily Standup", cleanedNote: "First standup.", status: .ready)
        let second = VoiceNote(createdAt: date, title: "Daily Standup", cleanedNote: "Second standup.", status: .ready)

        XCTAssertTrue(service.syncNote(first))
        XCTAssertTrue(service.syncNote(second))

        let files = try FileManager.default.contentsOfDirectory(atPath: tempDir.path)
        XCTAssertEqual(files.count, 2)
    }

    func testDeleteRemovesExportedFile() throws {
        let note = VoiceNote(title: "Temporary Note", cleanedNote: "Delete me.", status: .ready)
        XCTAssertTrue(service.syncNote(note))
        XCTAssertEqual(try FileManager.default.contentsOfDirectory(atPath: tempDir.path).count, 1)

        service.removeExportedFile(forNoteId: note.id)
        XCTAssertEqual(try FileManager.default.contentsOfDirectory(atPath: tempDir.path).count, 0)
    }

    func testExportAllSkipsLockedAndUnreadyNotes() throws {
        let ready = VoiceNote(title: "Ready Note", cleanedNote: "Good content.", status: .ready)
        let locked = VoiceNote(title: "Locked Note", cleanedNote: "Hidden.", status: .ready, isLocked: true)
        let processing = VoiceNote(title: "In Progress", cleanedNote: "", status: .transcribingASR)

        let count = service.exportAll([ready, locked, processing])
        XCTAssertEqual(count, 1)
        XCTAssertEqual(try FileManager.default.contentsOfDirectory(atPath: tempDir.path).count, 1)
    }
}

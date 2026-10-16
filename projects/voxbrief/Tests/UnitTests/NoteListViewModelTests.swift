import XCTest
@testable import Voxbrief

@MainActor
final class NoteListViewModelTests: XCTestCase {

    var tempStorageURL: URL!
    var repository: NoteRepository!
    var viewModel: NoteListViewModel!

    override func setUp() {
        super.setUp()
        let tempDir = FileManager.default.temporaryDirectory
        tempStorageURL = tempDir.appendingPathComponent("test_notes_\(UUID().uuidString).json")
        repository = NoteRepository(customStorageURL: tempStorageURL)
        viewModel = NoteListViewModel(repository: repository)
        // NoteRepository seeds sample notes when its store is empty; clear them so
        // these tests only ever see the notes they explicitly create.
        for note in repository.notes {
            repository.delete(id: note.id)
        }
    }

    override func tearDown() {
        try? FileManager.default.removeItem(at: tempStorageURL)
        super.tearDown()
    }

    func testSearchMatchesTags() {
        let note = VoiceNote(id: UUID(), title: "Untitled", summary: "", rawTranscript: "", cleanedNote: "", tags: ["#watchOS"])
        repository.save(note)

        viewModel.searchText = "watchos"
        XCTAssertEqual(viewModel.notes.count, 1, "Search should match against tags case-insensitively")
    }

    func testSearchMatchesRequirementsAndActionItems() {
        let note = VoiceNote(
            id: UUID(),
            title: "Untitled",
            summary: "",
            rawTranscript: "",
            cleanedNote: "",
            requirements: ["Support biometric login"],
            actionItems: ["Check with the security team"]
        )
        repository.save(note)

        viewModel.searchText = "biometric"
        XCTAssertEqual(viewModel.notes.count, 1, "Search should match against requirement text")

        viewModel.searchText = "security team"
        XCTAssertEqual(viewModel.notes.count, 1, "Search should match against action item text")

        viewModel.searchText = "nonexistent phrase"
        XCTAssertTrue(viewModel.notes.isEmpty, "Search should exclude notes with no matching field")
    }

    func testSearchScopes() {
        let note = VoiceNote(
            id: UUID(),
            title: "Sprint Retrospective",
            summary: "Sprint goals achieved",
            rawTranscript: "Transcript text",
            actionItems: ["Deploy to production"],
            tags: ["#agile"]
        )
        repository.save(note)

        viewModel.searchText = "Retrospective"
        viewModel.searchScope = .title
        XCTAssertEqual(viewModel.notes.count, 1)

        viewModel.searchScope = .actionItems
        XCTAssertEqual(viewModel.notes.count, 0)

        viewModel.searchText = "production"
        XCTAssertEqual(viewModel.notes.count, 1)

        viewModel.searchScope = .tags
        XCTAssertEqual(viewModel.notes.count, 0)
    }

    func testPinnedAndArchivedNotes() {
        let note1 = VoiceNote(id: UUID(), title: "Regular Note 1")
        let note2 = VoiceNote(id: UUID(), title: "Pinned Note", isPinned: true)
        let note3 = VoiceNote(id: UUID(), title: "Archived Note", isArchived: true)
        repository.save(note1)
        repository.save(note2)
        repository.save(note3)

        // Default: active notes only
        XCTAssertEqual(viewModel.notes.count, 2)
        XCTAssertEqual(viewModel.pinnedNotes.count, 1)
        XCTAssertEqual(viewModel.pinnedNotes.first?.title, "Pinned Note")
        XCTAssertEqual(viewModel.unpinnedNotes.count, 1)
        XCTAssertEqual(viewModel.unpinnedNotes.first?.title, "Regular Note 1")

        // Switch to archived
        viewModel.showArchived = true
        XCTAssertEqual(viewModel.notes.count, 1)
        XCTAssertEqual(viewModel.notes.first?.title, "Archived Note")
        XCTAssertTrue(viewModel.pinnedNotes.isEmpty)
    }

    func testSortingOptions() {
        let noteA = VoiceNote(id: UUID(), createdAt: Date().addingTimeInterval(-200), duration: 10, title: "Alpha")
        let noteB = VoiceNote(id: UUID(), createdAt: Date().addingTimeInterval(-100), duration: 50, title: "Beta")
        let noteC = VoiceNote(id: UUID(), createdAt: Date(), duration: 25, title: "Gamma")
        repository.save(noteA)
        repository.save(noteB)
        repository.save(noteC)

        viewModel.sortOption = .titleAsc
        XCTAssertEqual(viewModel.notes.map(\.title), ["Alpha", "Beta", "Gamma"])

        viewModel.sortOption = .titleDesc
        XCTAssertEqual(viewModel.notes.map(\.title), ["Gamma", "Beta", "Alpha"])

        viewModel.sortOption = .durationLongest
        XCTAssertEqual(viewModel.notes.map(\.duration), [50, 25, 10])

        viewModel.sortOption = .durationShortest
        XCTAssertEqual(viewModel.notes.map(\.duration), [10, 25, 50])
    }
}

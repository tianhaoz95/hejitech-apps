import XCTest
@testable import Voxbrief

@MainActor
final class NoteDetailViewModelTests: XCTestCase {

    func testParseSectionsFromMarkdownExtractsHeadersAndBullets() {
        let markdown = """
        ### 🎯 Requirements
        - First requirement
        - Second requirement

        ### 🔢 Conditions
        1. Condition one
        2. Condition two

        ### ✅ Action Items
        - [ ] Action item 1
        - [x] Action item 2
        """

        let originalSections = [
            TemplateSectionContent(title: "🎯 Requirements", style: .bullet, items: []),
            TemplateSectionContent(title: "🔢 Conditions", style: .numbered, items: []),
            TemplateSectionContent(title: "✅ Action Items", style: .checklist, items: [])
        ]

        let parsed = NoteDetailViewModel.parseSectionsFromMarkdown(markdown, originalSections: originalSections)

        XCTAssertEqual(parsed.count, 3)
        XCTAssertEqual(parsed[0].title, "🎯 Requirements")
        XCTAssertEqual(parsed[0].style, .bullet)
        XCTAssertEqual(parsed[0].items, ["First requirement", "Second requirement"])

        XCTAssertEqual(parsed[1].title, "🔢 Conditions")
        XCTAssertEqual(parsed[1].style, .numbered)
        XCTAssertEqual(parsed[1].items, ["Condition one", "Condition two"])

        XCTAssertEqual(parsed[2].title, "✅ Action Items")
        XCTAssertEqual(parsed[2].style, .checklist)
        XCTAssertEqual(parsed[2].items, ["Action item 1", "Action item 2"])
    }

    func testSaveEditsSyncsSectionsAndLegacyFields() {
        let tempDir = FileManager.default.temporaryDirectory
        let tempStorageURL = tempDir.appendingPathComponent("test_notes_\(UUID().uuidString).json")
        defer { try? FileManager.default.removeItem(at: tempStorageURL) }

        let repository = NoteRepository(customStorageURL: tempStorageURL)
        let noteId = UUID()
        let note = VoiceNote(
            id: noteId,
            createdAt: Date(),
            duration: 10,
            title: "Original Title",
            summary: "Original Summary",
            rawTranscript: "transcript",
            cleanedNote: "# Original\n\n### Requirements\n- Old requirement",
            requirements: ["Old requirement"],
            conditions: [],
            actionItems: [],
            tags: ["#tag1"],
            status: .ready,
            source: .phoneApp,
            templateSections: [
                TemplateSectionContent(title: "Requirements", style: .bullet, items: ["Old requirement"])
            ]
        )
        repository.save(note)

        let viewModel = NoteDetailViewModel(note: note, repository: repository)
        viewModel.beginEditing()
        viewModel.editedCleanedNote = """
        # Updated Title

        ### Requirements
        - New requirement A
        - New requirement B

        ### Action Items
        - [ ] New action item
        """
        viewModel.saveEdits()

        let updated = repository.note(withId: noteId)
        XCTAssertNotNil(updated)
        XCTAssertEqual(updated?.requirements, ["New requirement A", "New requirement B"])
        XCTAssertEqual(updated?.actionItems, ["New action item"])
        XCTAssertEqual(updated?.effectiveTemplateSections.count, 2)
    }
}

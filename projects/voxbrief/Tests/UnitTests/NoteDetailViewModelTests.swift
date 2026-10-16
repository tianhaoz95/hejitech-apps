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

    func testToggleActionItemTogglesCompletionAndMarkdown() {
        let tempDir = FileManager.default.temporaryDirectory
        let tempStorageURL = tempDir.appendingPathComponent("test_notes_\(UUID().uuidString).json")
        defer { try? FileManager.default.removeItem(at: tempStorageURL) }

        let repository = NoteRepository(customStorageURL: tempStorageURL)
        let noteId = UUID()
        let note = VoiceNote(
            id: noteId,
            createdAt: Date(),
            duration: 15,
            title: "Task Note",
            summary: "Summary",
            rawTranscript: "raw",
            cleanedNote: "### Action Items\n- [ ] Ship version 1.18\n- [ ] Update documentation",
            actionItems: ["Ship version 1.18", "Update documentation"],
            completedActionItems: []
        )
        repository.save(note)

        let viewModel = NoteDetailViewModel(note: note, repository: repository)

        XCTAssertFalse(viewModel.isActionItemCompleted("Ship version 1.18"))

        viewModel.toggleActionItem("Ship version 1.18")
        XCTAssertTrue(viewModel.isActionItemCompleted("Ship version 1.18"))
        XCTAssertTrue(viewModel.note.cleanedNote.contains("- [x] Ship version 1.18"))

        viewModel.toggleActionItem("Ship version 1.18")
        XCTAssertFalse(viewModel.isActionItemCompleted("Ship version 1.18"))
        XCTAssertTrue(viewModel.note.cleanedNote.contains("- [ ] Ship version 1.18"))
    }

    func testPlaybackRateCycling() {
        let note = VoiceNote(id: UUID(), title: "Rate Test")
        let viewModel = NoteDetailViewModel(note: note)

        viewModel.playbackService.setRate(1.0)
        XCTAssertEqual(viewModel.playbackService.playbackRate, 1.0)

        let rate1 = viewModel.cyclePlaybackRate()
        XCTAssertEqual(rate1, 1.25, accuracy: 0.01)

        let rate2 = viewModel.cyclePlaybackRate()
        XCTAssertEqual(rate2, 1.5, accuracy: 0.01)

        let rate3 = viewModel.cyclePlaybackRate()
        XCTAssertEqual(rate3, 2.0, accuracy: 0.01)

        let rate4 = viewModel.cyclePlaybackRate()
        XCTAssertEqual(rate4, 0.8, accuracy: 0.01)

        let rate5 = viewModel.cyclePlaybackRate()
        XCTAssertEqual(rate5, 1.0, accuracy: 0.01)
    }

    func testPDFExportGeneratesValidFile() {
        let note = VoiceNote(
            id: UUID(),
            createdAt: Date(),
            duration: 30,
            title: "Executive Strategy Sync",
            summary: "Key decisions on Q4 roadmap.",
            rawTranscript: "Let's review the quarterly roadmap.",
            cleanedNote: "### Summary\nKey decisions on Q4 roadmap.\n\n### Action Items\n- [ ] Finalize budget"
        )

        let pdfURL = PDFExportService.shared.exportTemporaryPDF(for: note)
        #if canImport(UIKit) && !os(watchOS)
        XCTAssertNotNil(pdfURL)
        if let pdfURL = pdfURL {
            XCTAssertTrue(FileManager.default.fileExists(atPath: pdfURL.path))
            XCTAssertTrue(pdfURL.pathExtension.lowercased() == "pdf")
        }
        #endif
    }

    func testPinArchiveAndColorTagOperations() {
        let tempDir = FileManager.default.temporaryDirectory
        let tempStorageURL = tempDir.appendingPathComponent("test_notes_\(UUID().uuidString).json")
        defer { try? FileManager.default.removeItem(at: tempStorageURL) }

        let repository = NoteRepository(customStorageURL: tempStorageURL)
        let note = VoiceNote(id: UUID(), title: "Detail Test")
        repository.save(note)

        let viewModel = NoteDetailViewModel(note: note, repository: repository)

        viewModel.togglePinned()
        XCTAssertTrue(viewModel.note.isPinned)

        viewModel.toggleArchived()
        XCTAssertTrue(viewModel.note.isArchived)

        viewModel.setColorTag("indigo")
        XCTAssertEqual(viewModel.note.colorTag, "indigo")

        viewModel.toggleLocked()
        XCTAssertTrue(viewModel.note.isLocked)
    }

    func testTagOperationsInDetailViewModel() {
        let tempDir = FileManager.default.temporaryDirectory
        let tempStorageURL = tempDir.appendingPathComponent("test_notes_\(UUID().uuidString).json")
        defer { try? FileManager.default.removeItem(at: tempStorageURL) }

        let repository = NoteRepository(customStorageURL: tempStorageURL)
        let note = VoiceNote(id: UUID(), title: "Tag Test")
        repository.save(note)

        let viewModel = NoteDetailViewModel(note: note, repository: repository)

        viewModel.addTag("architecture")
        XCTAssertTrue(viewModel.note.tags.contains("#architecture"))

        viewModel.removeTag("#architecture")
        XCTAssertFalse(viewModel.note.tags.contains("#architecture"))
    }

    func testAudioControlsAndExportURLs() {
        let note = VoiceNote(
            id: UUID(),
            title: "Export Test",
            cleanedNote: "Some cleaned text"
        )
        let viewModel = NoteDetailViewModel(note: note)

        viewModel.toggleLooping()
        XCTAssertTrue(viewModel.playbackService.isLooping)

        viewModel.skipForward()
        viewModel.skipBackward()

        XCTAssertNotNil(viewModel.plainTextShareFileURL)
        XCTAssertNotNil(viewModel.htmlShareFileURL)
        XCTAssertNotNil(viewModel.markdownShareFileURL)
    }
}

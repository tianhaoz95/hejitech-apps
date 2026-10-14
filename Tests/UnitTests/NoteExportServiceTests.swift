import XCTest
@testable import Voxbrief

final class NoteExportServiceTests: XCTestCase {

    func testFormattedMarkdownDocumentIncludesYAMLFrontmatter() {
        let note = VoiceNote(
            id: UUID(),
            createdAt: Date(),
            duration: 42.5,
            title: "Roadmap Discussion",
            summary: "Discussion about quarterly goals",
            rawTranscript: "We should focus on performance.",
            cleanedNote: "### Goals\n- Focus on performance",
            requirements: ["Focus on performance"],
            tags: ["#roadmap", "#q3"],
            source: .phoneApp
        )

        let doc = NoteExportService.shared.formattedMarkdownDocument(for: note)

        XCTAssertTrue(doc.hasPrefix("---"))
        XCTAssertTrue(doc.contains("title: \"Roadmap Discussion\""))
        XCTAssertTrue(doc.contains("source: \"iPhone\""))
        XCTAssertTrue(doc.contains("tags:"))
        XCTAssertTrue(doc.contains("- \"roadmap\""))
        XCTAssertTrue(doc.contains("- \"q3\""))
        XCTAssertTrue(doc.contains("### Goals\n- Focus on performance"))
    }

    func testExportTemporaryMarkdownFileCreatesValidFile() {
        let note = VoiceNote(
            id: UUID(),
            title: "Design System Sync",
            cleanedNote: "# Design System\n\n- Update color palette"
        )

        let fileURL = NoteExportService.shared.exportTemporaryMarkdownFile(for: note)
        XCTAssertNotNil(fileURL)
        guard let url = fileURL else { return }

        XCTAssertTrue(FileManager.default.fileExists(atPath: url.path))
        let content = try? String(contentsOf: url, encoding: .utf8)
        XCTAssertNotNil(content)
        XCTAssertTrue(content?.contains("Design System Sync") == true)
        XCTAssertTrue(url.pathExtension == "md")

        try? FileManager.default.removeItem(at: url)
    }
}

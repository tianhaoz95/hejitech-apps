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

    func testExportNotesAsZipCreatesValidArchive() {
        let note1 = VoiceNote(id: UUID(), title: "Note 1", cleanedNote: "Body 1")
        let note2 = VoiceNote(id: UUID(), title: "Note 2", cleanedNote: "Body 2")

        let zipURL = NoteExportService.shared.exportNotesAsZip(notes: [note1, note2])
        XCTAssertNotNil(zipURL)
        if let url = zipURL {
            XCTAssertTrue(FileManager.default.fileExists(atPath: url.path))
            XCTAssertEqual(url.pathExtension, "zip")
            try? FileManager.default.removeItem(at: url)
        }
    }

    func testFormattedPlainTextDocument() {
        let note = VoiceNote(
            id: UUID(),
            createdAt: Date(),
            duration: 120,
            title: "Project Review",
            summary: "Quarterly metrics and deliverable updates.",
            rawTranscript: "Here is what we covered today.",
            requirements: ["Deploy v1.20", "Improve testing"],
            actionItems: ["Update documentation"],
            completedActionItems: ["Update documentation"],
            tags: ["#ops", "#q4"]
        )

        let text = NoteExportService.shared.formattedPlainTextDocument(for: note)
        XCTAssertTrue(text.contains("Project Review"))
        XCTAssertTrue(text.contains("SUMMARY"))
        XCTAssertTrue(text.contains("Quarterly metrics and deliverable updates."))
        XCTAssertTrue(text.contains("[X] Update documentation"))
        XCTAssertTrue(text.contains("• Deploy v1.20"))
        XCTAssertTrue(text.contains("TRANSCRIPT"))
        XCTAssertTrue(text.contains("Here is what we covered today."))

        let fileURL = NoteExportService.shared.exportTemporaryPlainTextFile(for: note)
        XCTAssertNotNil(fileURL)
        if let fileURL = fileURL {
            XCTAssertTrue(FileManager.default.fileExists(atPath: fileURL.path))
            XCTAssertEqual(fileURL.pathExtension, "txt")
            try? FileManager.default.removeItem(at: fileURL)
        }
    }

    func testFormattedHTMLDocument() {
        let note = VoiceNote(
            id: UUID(),
            createdAt: Date(),
            duration: 60,
            title: "Client Kickoff Meeting",
            summary: "Met with stakeholders to define requirements.",
            rawTranscript: "Stakeholders wanted real-time audio sync.",
            requirements: ["Real-time audio sync"],
            actionItems: ["Draft proposal", "Send email"],
            completedActionItems: ["Draft proposal"],
            tags: ["#client", "#meeting"]
        )

        let html = NoteExportService.shared.formattedHTMLDocument(for: note)
        XCTAssertTrue(html.contains("<!DOCTYPE html>"))
        XCTAssertTrue(html.contains("<title>Client Kickoff Meeting - Voxbrief</title>"))
        XCTAssertTrue(html.contains("<span class=\"tag\">#client</span>"))
        XCTAssertTrue(html.contains("<span class=\"tag\">#meeting</span>"))
        XCTAssertTrue(html.contains("<li class=\"done\"><input type=\"checkbox\" checked disabled> <span>Draft proposal</span></li>"))
        XCTAssertTrue(html.contains("<details class=\"transcript-box\">"))

        let fileURL = NoteExportService.shared.exportTemporaryHTMLFile(for: note)
        XCTAssertNotNil(fileURL)
        if let fileURL = fileURL {
            XCTAssertTrue(FileManager.default.fileExists(atPath: fileURL.path))
            XCTAssertEqual(fileURL.pathExtension, "html")
            try? FileManager.default.removeItem(at: fileURL)
        }
    }

    func testGranularExtractors() {
        let note = VoiceNote(
            id: UUID(),
            title: "Quick Sync",
            summary: "A brief summary of notes.",
            rawTranscript: "This is the raw dictation verbatim.",
            actionItems: ["Item 1", "Item 2"],
            completedActionItems: ["Item 1"]
        )

        let summary = NoteExportService.shared.extractSummary(for: note)
        XCTAssertEqual(summary, "A brief summary of notes.")

        let actions = NoteExportService.shared.extractActionItems(for: note)
        XCTAssertTrue(actions.contains("- [x] Item 1"))
        XCTAssertTrue(actions.contains("- [ ] Item 2"))

        let transcript = NoteExportService.shared.extractTranscript(for: note)
        XCTAssertEqual(transcript, "This is the raw dictation verbatim.")
    }

    func testZipHoldsUnlockedNotesInOneNamedFolder() throws {
        let notes = [
            VoiceNote(duration: 5, title: "Kitchen ideas", cleanedNote: "- [ ] Measure"),
            VoiceNote(duration: 5, title: "Private", cleanedNote: "secret", isLocked: true),
            VoiceNote(duration: 5, title: "Kitchen ideas", cleanedNote: "Second note, same title"),
        ]
        let url = try XCTUnwrap(NoteExportService.shared.exportNotesAsZip(notes: notes))
        defer { try? FileManager.default.removeItem(at: url) }
        let entries = try zipEntryNames(url)
        XCTAssertEqual(entries.count, 2, "the locked note stays out")
        XCTAssertTrue(entries.allSatisfy { $0.hasPrefix("Voxbrief Notes ") }, "\(entries)")
        XCTAssertEqual(Set(entries.map { ($0 as NSString).lastPathComponent }), ["001-Kitchen_ideas.md", "002-Kitchen_ideas.md"])
    }

    func testNoZipWhenEveryNoteIsLocked() {
        XCTAssertNil(NoteExportService.shared.exportNotesAsZip(notes: [VoiceNote(title: "Private", isLocked: true)]))
    }

    /// File names from a zip's central directory (no unzip API on iOS).
    private func zipEntryNames(_ url: URL) throws -> [String] {
        let data = try Data(contentsOf: url)
        var names: [String] = []
        var i = 0
        while i + 46 <= data.count {
            if data[i] == 0x50, data[i + 1] == 0x4B, data[i + 2] == 0x01, data[i + 3] == 0x02 {
                let nameLength = Int(data[i + 28]) | Int(data[i + 29]) << 8
                let extraLength = Int(data[i + 30]) | Int(data[i + 31]) << 8
                let commentLength = Int(data[i + 32]) | Int(data[i + 33]) << 8
                let name = String(decoding: data[(i + 46)..<(i + 46 + nameLength)], as: UTF8.self)
                if !name.hasSuffix("/") { names.append(name) }
                i += 46 + nameLength + extraLength + commentLength
            } else {
                i += 1
            }
        }
        return names
    }
}

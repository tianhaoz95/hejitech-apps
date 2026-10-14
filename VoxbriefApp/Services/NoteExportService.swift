import Foundation

/// Prepares notes for export to Obsidian, Bear, Apple Notes, or plain markdown files with YAML frontmatter.
public final class NoteExportService: @unchecked Sendable {
    public static let shared = NoteExportService()

    /// Formats note into a clean Markdown document with Obsidian/Bear compatible YAML frontmatter.
    public func formattedMarkdownDocument(for note: VoiceNote) -> String {
        let formatter = ISO8601DateFormatter()
        let dateString = formatter.string(from: note.createdAt)
        let tagsYaml: String
        if note.tags.isEmpty {
            tagsYaml = "[]"
        } else {
            let tagLines = note.tags.map { "  - \"\($0.trimmingCharacters(in: CharacterSet(charactersIn: "#")))\"" }
            tagsYaml = "\n" + tagLines.joined(separator: "\n")
        }

        let frontmatter = """
        ---
        title: "\(note.title.replacingOccurrences(of: "\"", with: "\\\""))"
        date: \(dateString)
        duration_seconds: \(Int(note.duration))
        source: "\(note.source.displayName)"
        status: "\(note.status.rawValue)"
        tags: \(tagsYaml)
        ---
        """

        return "\(frontmatter)\n\n\(note.cleanedNote)\n"
    }

    /// Prepares a temporary file URL containing the note's markdown for system share sheet or Obsidian import.
    public func exportTemporaryMarkdownFile(for note: VoiceNote) -> URL? {
        let text = formattedMarkdownDocument(for: note)
        let sanitizedTitle = note.title
            .components(separatedBy: CharacterSet.alphanumerics.inverted)
            .filter { !$0.isEmpty }
            .joined(separator: "_")
        let baseName = sanitizedTitle.isEmpty ? "VoiceNote_\(note.id.uuidString.prefix(8))" : sanitizedTitle
        let tempURL = FileManager.default.temporaryDirectory.appendingPathComponent("\(baseName).md")
        do {
            try text.write(to: tempURL, atomically: true, encoding: .utf8)
            return tempURL
        } catch {
            print("[NoteExportService] Failed to write temporary markdown file: \(error)")
            return nil
        }
    }
}

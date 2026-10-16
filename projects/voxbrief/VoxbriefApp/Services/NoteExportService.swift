import Foundation

/// Prepares notes for export to Obsidian, Bear, Apple Notes, plain text, or rich HTML.
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
        let baseName = sanitizedBaseName(for: note)
        let tempURL = FileManager.default.temporaryDirectory.appendingPathComponent("\(baseName).md")
        do {
            try text.write(to: tempURL, atomically: true, encoding: .utf8)
            return tempURL
        } catch {
            print("[NoteExportService] Failed to write temporary markdown file: \(error)")
            return nil
        }
    }

    /// Formats note into plain text without markdown syntax.
    public func formattedPlainTextDocument(for note: VoiceNote) -> String {
        var lines: [String] = []
        lines.append(note.title)
        lines.append(String(repeating: "=", count: max(12, note.title.count)))
        lines.append("Date: \(note.createdAt.formatted(date: .abbreviated, time: .shortened))")
        lines.append("Duration: \(note.duration.formattedDuration)")
        lines.append("Source: \(note.source.displayName)")
        if !note.tags.isEmpty {
            lines.append("Tags: \(note.tags.joined(separator: " "))")
        }
        lines.append("")

        if !note.summary.isEmpty {
            lines.append("SUMMARY")
            lines.append("-------")
            lines.append(note.summary)
            lines.append("")
        }

        let effectiveSections = note.effectiveTemplateSections
        if !effectiveSections.isEmpty {
            for section in effectiveSections {
                lines.append(section.title.uppercased())
                lines.append(String(repeating: "-", count: max(8, section.title.count)))
                for (idx, item) in section.items.enumerated() {
                    switch section.style {
                    case .numbered:
                        lines.append("\(idx + 1). \(item)")
                    case .checklist:
                        let isDone = note.completedActionItems.contains(item)
                        lines.append("[\(isDone ? "X" : " ")] \(item)")
                    case .bullet, .paragraph:
                        lines.append("• \(item)")
                    }
                }
                lines.append("")
            }
        } else if !note.cleanedNote.isEmpty {
            lines.append(note.cleanedNote)
            lines.append("")
        }

        if !note.rawTranscript.isEmpty {
            lines.append("TRANSCRIPT")
            lines.append("----------")
            lines.append(note.rawTranscript)
            lines.append("")
        }

        return lines.joined(separator: "\n")
    }

    /// Prepares a temporary file URL containing the note's plain text.
    public func exportTemporaryPlainTextFile(for note: VoiceNote) -> URL? {
        let text = formattedPlainTextDocument(for: note)
        let baseName = sanitizedBaseName(for: note)
        let tempURL = FileManager.default.temporaryDirectory.appendingPathComponent("\(baseName).txt")
        do {
            try text.write(to: tempURL, atomically: true, encoding: .utf8)
            return tempURL
        } catch {
            print("[NoteExportService] Failed to write temporary txt file: \(error)")
            return nil
        }
    }

    /// Formats note into a standalone, styled HTML document.
    public func formattedHTMLDocument(for note: VoiceNote) -> String {
        let esc = { (s: String) -> String in
            s.replacingOccurrences(of: "&", with: "&amp;")
             .replacingOccurrences(of: "<", with: "&lt;")
             .replacingOccurrences(of: ">", with: "&gt;")
             .replacingOccurrences(of: "\"", with: "&quot;")
        }

        var tagBadges = ""
        for tag in note.tags {
            tagBadges += "<span class=\"tag\">\(esc(tag))</span>"
        }

        var sectionsHTML = ""
        for section in note.effectiveTemplateSections {
            sectionsHTML += "<div class=\"section\"><h2>\(esc(section.title))</h2>"
            switch section.style {
            case .checklist:
                sectionsHTML += "<ul class=\"checklist\">"
                for item in section.items {
                    let done = note.completedActionItems.contains(item)
                    let check = done ? "checked" : ""
                    let doneClass = done ? " class=\"done\"" : ""
                    sectionsHTML += "<li\(doneClass)><input type=\"checkbox\" \(check) disabled> <span>\(esc(item))</span></li>"
                }
                sectionsHTML += "</ul>"
            case .numbered:
                sectionsHTML += "<ol>"
                for item in section.items {
                    sectionsHTML += "<li>\(esc(item))</li>"
                }
                sectionsHTML += "</ol>"
            case .bullet, .paragraph:
                sectionsHTML += "<ul>"
                for item in section.items {
                    sectionsHTML += "<li>\(esc(item))</li>"
                }
                sectionsHTML += "</ul>"
            }
            sectionsHTML += "</div>"
        }

        let summaryHTML = note.summary.isEmpty ? "" : "<div class=\"summary\"><p>\(esc(note.summary))</p></div>"
        let transcriptHTML = note.rawTranscript.isEmpty ? "" : """
        <details class=\"transcript-box\">
          <summary>Verbatim Transcript (\(note.duration.formattedDuration))</summary>
          <p>\(esc(note.rawTranscript))</p>
        </details>
        """

        return """
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>\(esc(note.title)) - Voxbrief</title>
          <style>
            :root {
              --bg: #ffffff;
              --text: #1a1a1a;
              --card: #f8f9fa;
              --border: #e5e7eb;
              --accent: #2563eb;
              --tag-bg: #e0e7ff;
              --tag-text: #3730a3;
            }
            @media (prefers-color-scheme: dark) {
              :root {
                --bg: #121212;
                --text: #e5e7eb;
                --card: #1e1e1e;
                --border: #2d2d2d;
                --accent: #3b82f6;
                --tag-bg: #1e293b;
                --tag-text: #93c5fd;
              }
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              background-color: var(--bg);
              color: var(--text);
              line-height: 1.6;
              padding: 32px 16px;
              max-width: 760px;
              margin: 0 auto;
            }
            header {
              border-bottom: 2px solid var(--border);
              padding-bottom: 16px;
              margin-bottom: 24px;
            }
            h1 {
              font-size: 2rem;
              margin-bottom: 8px;
              letter-spacing: -0.02em;
            }
            .meta {
              font-size: 0.9rem;
              color: #6b7280;
              margin-bottom: 12px;
            }
            .tags {
              display: flex;
              gap: 6px;
              flex-wrap: wrap;
            }
            .tag {
              background: var(--tag-bg);
              color: var(--tag-text);
              padding: 3px 10px;
              border-radius: 12px;
              font-size: 0.8rem;
              font-weight: 500;
            }
            .summary {
              background: var(--card);
              border-left: 4px solid var(--accent);
              padding: 16px 20px;
              border-radius: 8px;
              font-size: 1.05rem;
              margin-bottom: 24px;
            }
            .section {
              margin-bottom: 28px;
            }
            h2 {
              font-size: 1.25rem;
              margin-bottom: 12px;
              border-bottom: 1px solid var(--border);
              padding-bottom: 6px;
            }
            ul, ol {
              padding-left: 24px;
              margin-bottom: 16px;
            }
            li {
              margin-bottom: 6px;
            }
            .checklist {
              list-style: none;
              padding-left: 0;
            }
            .checklist li {
              display: flex;
              align-items: flex-start;
              gap: 8px;
            }
            .checklist li.done span {
              text-decoration: line-through;
              opacity: 0.6;
            }
            .transcript-box {
              background: var(--card);
              border: 1px solid var(--border);
              border-radius: 8px;
              padding: 12px 16px;
              margin-top: 32px;
            }
            .transcript-box summary {
              cursor: pointer;
              font-weight: 600;
              color: var(--accent);
            }
            footer {
              margin-top: 48px;
              text-align: center;
              font-size: 0.8rem;
              color: #9ca3af;
            }
          </style>
        </head>
        <body>
          <header>
            <h1>\(esc(note.title))</h1>
            <div class=\"meta\">
              \(note.createdAt.formatted(date: .long, time: .shortened)) • \(note.duration.formattedDuration) • Captured via \(esc(note.source.displayName))
            </div>
            \(tagBadges.isEmpty ? "" : "<div class=\"tags\">\(tagBadges)</div>")
          </header>

          <main>
            \(summaryHTML)
            \(sectionsHTML)
            \(transcriptHTML)
          </main>

          <footer>
            Generated by Voxbrief • On-Device Voice Notes & Copywriter
          </footer>
        </body>
        </html>
        """
    }

    /// Prepares a temporary file URL containing the note's HTML document.
    public func exportTemporaryHTMLFile(for note: VoiceNote) -> URL? {
        let text = formattedHTMLDocument(for: note)
        let baseName = sanitizedBaseName(for: note)
        let tempURL = FileManager.default.temporaryDirectory.appendingPathComponent("\(baseName).html")
        do {
            try text.write(to: tempURL, atomically: true, encoding: .utf8)
            return tempURL
        } catch {
            print("[NoteExportService] Failed to write temporary html file: \(error)")
            return nil
        }
    }

    /// Extracts clean summary text for copying.
    public func extractSummary(for note: VoiceNote) -> String {
        return note.summary.isEmpty ? note.title : note.summary
    }

    /// Extracts formatted checklist of action items.
    public func extractActionItems(for note: VoiceNote) -> String {
        guard !note.actionItems.isEmpty else { return "" }
        return note.actionItems.map { item in
            let done = note.completedActionItems.contains(item)
            return "- [\(done ? "x" : " ")] \(item)"
        }.joined(separator: "\n")
    }

    /// Extracts the verbatim transcript.
    public func extractTranscript(for note: VoiceNote) -> String {
        return note.rawTranscript
    }

    private func sanitizedBaseName(for note: VoiceNote) -> String {
        let sanitized = note.title
            .components(separatedBy: CharacterSet.alphanumerics.inverted)
            .filter { !$0.isEmpty }
            .joined(separator: "_")
        return sanitized.isEmpty ? "VoiceNote_\(note.id.uuidString.prefix(8))" : sanitized
    }
}

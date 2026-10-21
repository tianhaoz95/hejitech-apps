import SwiftUI

/// Lightweight block-level renderer for the cleaned note's Markdown so headings, quotes, bullets,
/// numbered steps, and checklists actually look structured instead of showing literal `#`/`-`/`[ ]`.
/// Not a general Markdown parser — just the subset `LLMCopywriterService` emits.
public struct MarkdownLiteText: View {
    let markdown: String
    var onToggleChecklist: ((Int) -> Void)?

    public init(_ markdown: String, onToggleChecklist: ((Int) -> Void)? = nil) {
        self.markdown = markdown
        self.onToggleChecklist = onToggleChecklist
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            ForEach(Array(lines.enumerated()), id: \.offset) { index, line in
                renderedLine(for: line, at: index)
            }
        }
    }

    public static func toggledChecklist(in markdown: String, at lineIndex: Int) -> String {
        var lines = markdown.components(separatedBy: "\n")
        guard lineIndex >= 0 && lineIndex < lines.count else { return markdown }
        let raw = lines[lineIndex]
        let trimmed = raw.trimmingCharacters(in: .whitespaces)
        let leadingSpaces = String(raw.prefix(while: { $0.isWhitespace }))

        if trimmed.hasPrefix("- [ ] ") {
            let remainder = trimmed.dropFirst(6)
            lines[lineIndex] = "\(leadingSpaces)- [x] \(remainder)"
        } else if trimmed.hasPrefix("- [x] ") || trimmed.hasPrefix("- [X] ") {
            let remainder = trimmed.dropFirst(6)
            lines[lineIndex] = "\(leadingSpaces)- [ ] \(remainder)"
        }
        return lines.joined(separator: "\n")
    }

    private var lines: [String] {
        markdown.components(separatedBy: "\n")
    }

    @ViewBuilder
    private func renderedLine(for rawLine: String, at index: Int) -> some View {
        let line = rawLine.trimmingCharacters(in: .whitespaces)

        if line.isEmpty {
            Spacer().frame(height: 4)
        } else if line.hasPrefix("### ") {
            Text(inline(String(line.dropFirst(4))))
                .font(.headline)
                .padding(.top, 6)
        } else if line.hasPrefix("# ") {
            Text(inline(String(line.dropFirst(2))))
                .font(.title2.bold())
                .padding(.top, 4)
        } else if line.hasPrefix("> ") {
            Text(inline(String(line.dropFirst(2))))
                .font(.subheadline.italic())
                .foregroundColor(.secondary)
        } else if line.hasPrefix("- [ ] ") {
            HStack(alignment: .top, spacing: 8) {
                Button {
                    onToggleChecklist?(index)
                } label: {
                    Image(systemName: "square")
                        .foregroundColor(.green)
                }
                .buttonStyle(.plain)
                .disabled(onToggleChecklist == nil)

                Text(inline(String(line.dropFirst(6))))
                    .fixedSize(horizontal: false, vertical: true)
            }
        } else if line.hasPrefix("- [x] ") || line.hasPrefix("- [X] ") {
            HStack(alignment: .top, spacing: 8) {
                Button {
                    onToggleChecklist?(index)
                } label: {
                    Image(systemName: "checkmark.square.fill")
                        .foregroundColor(.green)
                }
                .buttonStyle(.plain)
                .disabled(onToggleChecklist == nil)

                Text(inline(String(line.dropFirst(6))))
                    .strikethrough()
                    .foregroundColor(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        } else if line.hasPrefix("- ") {
            HStack(alignment: .top, spacing: 8) {
                Text("•").font(.body.bold())
                Text(inline(String(line.dropFirst(2))))
                    .fixedSize(horizontal: false, vertical: true)
            }
        } else if let numbered = numberedListContent(line) {
            HStack(alignment: .top, spacing: 8) {
                Text("\(numbered.number).")
                    .font(.body.bold())
                    .frame(minWidth: 20, alignment: .leading)
                Text(inline(numbered.text))
                    .fixedSize(horizontal: false, vertical: true)
            }
        } else {
            Text(inline(line))
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private func numberedListContent(_ line: String) -> (number: Int, text: String)? {
        guard let dotIndex = line.firstIndex(of: ".") else { return nil }
        let prefix = line[line.startIndex..<dotIndex]
        guard !prefix.isEmpty, let number = Int(prefix) else { return nil }
        let remainder = line[line.index(after: dotIndex)...].trimmingCharacters(in: .whitespaces)
        return (number, remainder)
    }

    private func inline(_ text: String) -> AttributedString {
        (try? AttributedString(markdown: text)) ?? AttributedString(text)
    }
}

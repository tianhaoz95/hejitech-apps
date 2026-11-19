import Foundation

/// What the Share extension received from another app, turned into an artifact's files. An HTML file
/// becomes the page itself; anything else gets an `index.html` that shows it (text as paragraphs,
/// a link as a card, images inline), with the original files kept next to it for agents to use.
public struct ShareDraft: Equatable, Sendable {
    public enum Item: Equatable, Sendable {
        case text(String)
        case url(URL, title: String?)
        case file(name: String, data: Data)
    }

    public var title: String
    public var note: String
    public var items: [Item]

    public init(items: [Item], title: String? = nil, note: String = "") {
        self.items = items
        self.note = note
        self.title = title ?? ShareDraft.suggestedTitle(items)
    }

    public static func suggestedTitle(_ items: [Item]) -> String {
        for item in items {
            switch item {
            case .url(let u, let t):
                if let t, !t.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { return clip(t) }
                return clip(u.host?.replacingOccurrences(of: "www.", with: "") ?? "Shared link")
            case .file(let name, let data):
                if isHTML(name), let t = htmlTitle(String(decoding: data, as: UTF8.self)) { return clip(t) }
                let base = (name as NSString).deletingPathExtension
                if !base.isEmpty { return clip(base.replacingOccurrences(of: "_", with: " ")) }
            case .text(let s):
                let first = s.split(whereSeparator: \.isNewline).first.map(String.init)?.trimmingCharacters(in: .whitespaces) ?? ""
                if !first.isEmpty { return clip(first.replacingOccurrences(of: "#", with: "").trimmingCharacters(in: .whitespaces)) }
            }
        }
        return "Shared from iPhone"
    }

    /// The files to create: always an entry page, plus the shared files under their own names.
    public func files() -> [NewFile] {
        var out: [NewFile] = []
        var used = Set<String>()
        func unique(_ name: String) -> String {
            let clean = Self.safeName(name)
            var n = clean
            var i = 2
            let ext = (clean as NSString).pathExtension
            let base = (clean as NSString).deletingPathExtension
            while used.contains(n.lowercased()) || n.lowercased() == "index.html" {
                n = ext.isEmpty ? "\(base)-\(i)" : "\(base)-\(i).\(ext)"
                i += 1
            }
            used.insert(n.lowercased())
            return n
        }

        // A single shared web page stays the page.
        if items.count == 1, case .file(let name, let data) = items[0], Self.isHTML(name) {
            out.append(NewFile(path: "index.html", content: String(decoding: data, as: UTF8.self)))
            if !note.isEmpty { out.append(NewFile(path: "notes.md", content: note + "\n")) }
            return out
        }

        var blocks: [String] = []
        for item in items {
            switch item {
            case .text(let s):
                out.append(NewFile(path: unique("text.md"), content: s))
                blocks.append(Self.paragraphs(s))
            case .url(let u, let t):
                let label = Self.escape(t ?? u.absoluteString)
                blocks.append("<a class=\"link\" href=\"\(Self.escape(u.absoluteString))\"><b>\(label)</b><span>\(Self.escape(u.host ?? u.absoluteString))</span></a>")
            case .file(let name, let data):
                let path = unique(name)
                if let text = Self.textContent(name, data) {
                    out.append(NewFile(path: path, content: text))
                    if Self.isHTML(name) {
                        blocks.append("<p><a href=\"\(Self.escape(path))\">\(Self.escape(path))</a></p>")
                    } else {
                        blocks.append("<h2>\(Self.escape(path))</h2>\(Self.paragraphs(text))")
                    }
                } else {
                    out.append(NewFile(path: path, data: data))
                    if Self.isImage(name) {
                        blocks.append("<figure><img src=\"\(Self.escape(path))\" alt=\"\(Self.escape(path))\"></figure>")
                    } else {
                        blocks.append("<p><a href=\"\(Self.escape(path))\">\(Self.escape(path))</a> (\(ByteCountFormatter.string(fromByteCount: Int64(data.count), countStyle: .file)))</p>")
                    }
                }
            }
        }
        let noteBlock = note.isEmpty ? "" : "<aside>\(Self.paragraphs(note))</aside>\n"
        let page = """
        <!doctype html>
        <html lang="en">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>\(Self.escape(title))</title>
          <style>
            :root { color-scheme: light dark; }
            body { font: 17px/1.55 system-ui, sans-serif; max-width: 42rem; margin: 0 auto; padding: 1.5rem; }
            h1 { font-size: 1.8rem; margin: 0 0 1rem; }
            aside { border-left: 3px solid #6d5efc; padding-left: .9rem; opacity: .85; margin-bottom: 1.25rem; }
            img { max-width: 100%; height: auto; border-radius: 10px; }
            figure { margin: 1rem 0; }
            .link { display: block; padding: .9rem 1rem; border: 1px solid color-mix(in srgb, currentColor 18%, transparent); border-radius: 12px; text-decoration: none; color: inherit; margin: 1rem 0; }
            .link span { display: block; opacity: .65; font-size: .9rem; }
          </style>
        </head>
        <body>
          <h1>\(Self.escape(title))</h1>
          \(noteBlock)\(blocks.joined(separator: "\n  "))
        </body>
        </html>

        """
        out.insert(NewFile(path: "index.html", content: page), at: 0)
        return out
    }

    // MARK: helpers

    static func clip(_ s: String) -> String {
        let t = s.trimmingCharacters(in: .whitespacesAndNewlines)
        return t.count > 80 ? String(t.prefix(79)) + "…" : t
    }

    static func isHTML(_ name: String) -> Bool { ["html", "htm"].contains((name as NSString).pathExtension.lowercased()) }
    static func isImage(_ name: String) -> Bool { ["png", "jpg", "jpeg", "gif", "webp", "heic", "svg"].contains((name as NSString).pathExtension.lowercased()) }

    static func textContent(_ name: String, _ data: Data) -> String? {
        let textExt = ["html", "htm", "md", "markdown", "txt", "css", "js", "json", "csv", "svg", "xml", "yaml", "yml"]
        guard textExt.contains((name as NSString).pathExtension.lowercased()), let s = String(data: data, encoding: .utf8) else { return nil }
        return s
    }

    static func htmlTitle(_ html: String) -> String? {
        guard let r = html.range(of: "<title[^>]*>([^<]{1,200})</title>", options: [.regularExpression, .caseInsensitive]) else { return nil }
        let tag = String(html[r])
        let inner = tag.replacingOccurrences(of: "<[^>]+>", with: "", options: .regularExpression).trimmingCharacters(in: .whitespacesAndNewlines)
        return inner.isEmpty ? nil : inner
    }

    /// A file name Folio accepts: letters, digits, `-`, `_`, `.`; no folders.
    static func safeName(_ name: String) -> String {
        let last = (name as NSString).lastPathComponent
        let allowed = CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "-_."))
        let cleaned = String(last.unicodeScalars.map { allowed.contains($0) ? Character($0) : "-" })
            .replacingOccurrences(of: "-+", with: "-", options: .regularExpression)
            .trimmingCharacters(in: CharacterSet(charactersIn: "-."))
        return cleaned.isEmpty ? "file" : String(cleaned.prefix(80))
    }

    static func escape(_ s: String) -> String {
        s.replacingOccurrences(of: "&", with: "&amp;").replacingOccurrences(of: "<", with: "&lt;")
            .replacingOccurrences(of: ">", with: "&gt;").replacingOccurrences(of: "\"", with: "&quot;")
    }

    static func paragraphs(_ s: String) -> String {
        s.components(separatedBy: "\n\n").map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }
            .map { "<p>\(escape($0).replacingOccurrences(of: "\n", with: "<br>"))</p>" }.joined(separator: "\n  ")
    }
}

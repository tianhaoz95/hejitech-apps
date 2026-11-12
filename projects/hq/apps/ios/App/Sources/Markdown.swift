// Card text (why, plan, verify), comments and request threads are markdown that agents wrote; their
// drawings are figures. This mirrors the portal (packages/core/src/markdown.ts): blocks become
// SwiftUI views, inline styles go through AttributedString, raw HTML stays text, links open only
// when they're http(s) or mailto, nothing is loaded from the network, and a figure is a web view
// with JavaScript off, no network and no navigation.
import SwiftUI
import WebKit

struct Figure: Codable, Hashable, Identifiable {
    var id: String
    var title: String
    var html: String
    var height: Double
}

// MARK: - Blocks

enum MDBlock: Hashable {
    case heading(Int, String)
    case paragraph(String)
    case list(ordered: Bool, start: Int, items: [String])
    case quote(String)
    case code(String)
    case table(head: [String], rows: [[String]])
    case figure(id: String, title: String)
    case rule
}

enum Markdown {
    private static func match(_ s: String, _ pattern: String) -> [String]? {
        guard let re = try? NSRegularExpression(pattern: pattern), let m = re.firstMatch(in: s, range: NSRange(s.startIndex..., in: s)) else { return nil }
        return (0..<m.numberOfRanges).map { i in Range(m.range(at: i), in: s).map { String(s[$0]) } ?? "" }
    }

    static let fence = #"^ {0,3}(```+|~~~+)\s*[\w+-]*\s*$"#
    static let heading = #"^ {0,3}(#{1,6})\s+(.*?)\s*#*\s*$"#
    static let rule = #"^ {0,3}([-*_])(?:\s*\1){2,}\s*$"#
    static let item = #"^(\s*)([-*+]|\d{1,9}[.)])\s+(.*)$"#
    static let quote = #"^ {0,3}>\s?(.*)$"#
    static let tableSep = #"^\s*\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)*\|?\s*$"#
    static let figureLine = #"^\s*!\[([^\]]*)\]\(\s*figure:([a-z0-9][a-z0-9-]{0,39})\s*\)\s*$"#

    private static func cells(_ line: String) -> [String] {
        var t = line.trimmingCharacters(in: .whitespaces)
        if t.hasPrefix("|") { t.removeFirst() }
        if t.hasSuffix("|") { t.removeLast() }
        return t.components(separatedBy: "|").map { $0.trimmingCharacters(in: .whitespaces) }
    }

    private static func startsBlock(_ l: String, _ next: String?) -> Bool {
        match(l, fence) != nil || match(l, heading) != nil || match(l, rule) != nil || match(l, item) != nil || match(l, quote) != nil || match(l, figureLine) != nil
            || (l.contains("|") && next.map { match($0, tableSep) != nil && $0.contains("-") } == true)
    }

    static func blocks(_ text: String) -> [MDBlock] {
        let lines = text.replacingOccurrences(of: "\r\n", with: "\n").replacingOccurrences(of: "\t", with: "    ").components(separatedBy: "\n")
        var out: [MDBlock] = []
        var i = 0
        func next(_ k: Int) -> String? { k < lines.count ? lines[k] : nil }
        while i < lines.count {
            let line = lines[i]
            if line.trimmingCharacters(in: .whitespaces).isEmpty { i += 1; continue }
            if match(line, fence) != nil {
                var body: [String] = []
                i += 1
                while i < lines.count, match(lines[i], #"^ {0,3}(`{3,}|~{3,})\s*$"#) == nil { body.append(lines[i]); i += 1 }
                i += 1
                out.append(.code(body.joined(separator: "\n")))
                continue
            }
            if let f = match(line, figureLine) { out.append(.figure(id: f[2], title: f[1])); i += 1; continue }
            if let h = match(line, heading) { out.append(.heading(h[1].count, h[2])); i += 1; continue }
            if match(line, rule) != nil { out.append(.rule); i += 1; continue }
            if match(line, quote) != nil {
                var body: [String] = []
                while i < lines.count, !lines[i].trimmingCharacters(in: .whitespaces).isEmpty, match(lines[i], quote) != nil || !startsBlock(lines[i], next(i + 1)) {
                    body.append(match(lines[i], quote)?[1] ?? lines[i]); i += 1
                }
                out.append(.quote(body.joined(separator: "\n")))
                continue
            }
            if line.contains("|"), let n = next(i + 1), match(n, tableSep) != nil, n.contains("-") {
                let head = cells(line)
                i += 2
                var rows: [[String]] = []
                while i < lines.count, !lines[i].trimmingCharacters(in: .whitespaces).isEmpty, lines[i].contains("|") { rows.append(cells(lines[i])); i += 1 }
                out.append(.table(head: head, rows: rows))
                continue
            }
            if let m = match(line, item) {
                let ordered = m[2].first?.isNumber == true
                let start = Int(m[2].filter(\.isNumber)) ?? 1
                var items: [String] = []
                while i < lines.count {
                    if let n = match(lines[i], item), (n[2].first?.isNumber == true) == ordered {
                        // Nested items flatten into the list, indented with a bullet.
                        items.append(n[1].count > m[1].count + 1 ? "◦ " + n[3] : n[3]); i += 1; continue
                    }
                    let blank = lines[i].trimmingCharacters(in: .whitespaces).isEmpty
                    if !blank, !startsBlock(lines[i], next(i + 1)), !items.isEmpty { items[items.count - 1] += " " + lines[i].trimmingCharacters(in: .whitespaces); i += 1; continue }
                    if blank, let n = next(i + 1), match(n, item) != nil { i += 1; continue }
                    break
                }
                out.append(.list(ordered: ordered, start: start, items: items))
                continue
            }
            var para = [line.trimmingCharacters(in: .whitespaces)]
            i += 1
            while i < lines.count, !lines[i].trimmingCharacters(in: .whitespaces).isEmpty, !startsBlock(lines[i], next(i + 1)) { para.append(lines[i].trimmingCharacters(in: .whitespaces)); i += 1 }
            out.append(.paragraph(para.joined(separator: "\n")))
        }
        return out
    }

    /// Inline markdown (bold, italic, code, links). Images become links; unsafe links become text.
    static func inline(_ s: String) -> AttributedString {
        var src = s
        // ![alt](url) never loads: a figure reference becomes its title, anything else a link.
        if let re = try? NSRegularExpression(pattern: #"!\[([^\]]*)\]\(([^()\s]+)\)"#) {
            src = re.stringByReplacingMatches(in: src, range: NSRange(src.startIndex..., in: src), withTemplate: "[$1]($2)")
        }
        let opts = AttributedString.MarkdownParsingOptions(allowsExtendedAttributes: false, interpretedSyntax: .inlineOnlyPreservingWhitespace, failurePolicy: .returnPartiallyParsedIfPossible)
        var a = (try? AttributedString(markdown: src, options: opts)) ?? AttributedString(s)
        for run in a.runs {
            guard let url = run.link else { continue }
            if !["http", "https", "mailto"].contains(url.scheme?.lowercased() ?? "") { a[run.range].link = nil }
        }
        return a
    }

    /// One line of plain text, for list rows and notifications.
    static func plain(_ s: String, max: Int = 180) -> String {
        var t = String(inline(s.replacingOccurrences(of: "\n", with: " ")).characters)
        for p in [#"^ {0,3}(#{1,6}|>|[-*+]|\d{1,9}[.)])\s+"#, #"\s*\|\s*"#] {
            if let re = try? NSRegularExpression(pattern: p, options: .anchorsMatchLines) { t = re.stringByReplacingMatches(in: t, range: NSRange(t.startIndex..., in: t), withTemplate: " ") }
        }
        t = t.split(whereSeparator: \.isWhitespace).joined(separator: " ")
        return t.count > max ? String(t.prefix(max - 1)) + "…" : t
    }
}

// MARK: - Views

struct MarkdownText: View {
    var text: String
    var figures: [Figure] = []
    var font: Font = .callout

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            ForEach(Array(Markdown.blocks(text).enumerated()), id: \.offset) { _, b in block(b) }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    @ViewBuilder private func block(_ b: MDBlock) -> some View {
        switch b {
        case .heading(let level, let s):
            Text(Markdown.inline(s)).font(level <= 2 ? .headline : .subheadline.weight(.semibold)).padding(.top, 4)
        case .paragraph(let s):
            Text(Markdown.inline(s)).font(font)
        case .list(let ordered, let start, let items):
            VStack(alignment: .leading, spacing: 4) {
                ForEach(Array(items.enumerated()), id: \.offset) { k, item in
                    let nested = item.hasPrefix("◦ ")
                    HStack(alignment: .firstTextBaseline, spacing: 6) {
                        Text(nested ? "◦" : ordered ? "\(start + k)." : "•").font(font).foregroundStyle(.secondary).monospacedDigit()
                        Text(Markdown.inline(nested ? String(item.dropFirst(2)) : item)).font(font)
                    }.padding(.leading, nested ? 16 : 0)
                }
            }
        case .quote(let s):
            Text(Markdown.inline(s)).font(font).foregroundStyle(.secondary)
                .padding(.leading, 10).overlay(alignment: .leading) { Rectangle().fill(.quaternary).frame(width: 3) }
        case .code(let s):
            ScrollView(.horizontal, showsIndicators: false) { Text(s).font(.caption.monospaced()).textSelection(.enabled).padding(8) }
                .background(Color.secondary.opacity(0.1), in: RoundedRectangle(cornerRadius: 8))
        case .table(let head, let rows):
            ScrollView(.horizontal, showsIndicators: false) {
                Grid(alignment: .leading, horizontalSpacing: 12, verticalSpacing: 6) {
                    GridRow { ForEach(Array(head.enumerated()), id: \.offset) { _, h in Text(Markdown.inline(h)).font(.caption.weight(.semibold)) } }
                    Divider()
                    ForEach(Array(rows.enumerated()), id: \.offset) { _, r in
                        GridRow { ForEach(0..<head.count, id: \.self) { k in Text(Markdown.inline(k < r.count ? r[k] : "")).font(.caption) } }
                    }
                }.padding(8)
            }
            .background(Color.secondary.opacity(0.07), in: RoundedRectangle(cornerRadius: 8))
        case .figure(let id, let title):
            if let f = figures.first(where: { $0.id == id && !$0.html.isEmpty }) { FigureView(figure: f) }
            else { Text("[figure: \(title.isEmpty ? id : title)]").font(.caption).foregroundStyle(.secondary) }
        case .rule:
            Divider()
        }
    }
}

/// Figures the text didn't place, so none is ever lost.
func unplacedFigures(_ figures: [Figure], in texts: [String]) -> [Figure] {
    let placed = Set(texts.flatMap { Markdown.blocks($0) }.compactMap { if case .figure(let id, _) = $0 { return id } else { return nil } })
    return figures.filter { !placed.contains($0.id) && !$0.html.isEmpty }
}

struct FigureView: View {
    var figure: Figure
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            FigureWebView(html: figureDocument(figure.html))
                .frame(height: min(max(figure.height, 80), 1200))
            Text(figure.title).font(.caption2).foregroundStyle(.secondary).padding(.horizontal, 8).padding(.vertical, 5)
        }
        .background(Color.secondary.opacity(0.07))
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(.quaternary))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Figure: \(figure.title)")
    }
}

/// A web view that runs no JavaScript, loads nothing and goes nowhere: the drawing is all it shows.
struct FigureWebView: UIViewRepresentable {
    var html: String

    final class Guard: NSObject, WKNavigationDelegate {
        func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, preferences: WKWebpagePreferences) async -> (WKNavigationActionPolicy, WKWebpagePreferences) {
            preferences.allowsContentJavaScript = false
            // Only the document we hand it; links, redirects and form posts are refused.
            return (action.navigationType == .other && action.request.url?.absoluteString == "about:blank" ? .allow : .cancel, preferences)
        }
    }

    func makeCoordinator() -> Guard { Guard() }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.defaultWebpagePreferences.allowsContentJavaScript = false
        config.websiteDataStore = .nonPersistent()
        config.dataDetectorTypes = []
        let v = WKWebView(frame: .zero, configuration: config)
        v.navigationDelegate = context.coordinator
        v.isOpaque = false
        v.backgroundColor = .clear
        v.scrollView.backgroundColor = .clear
        v.scrollView.bounces = false
        v.allowsLinkPreview = false
        v.loadHTMLString(html, baseURL: nil)
        return v
    }

    func updateUIView(_ v: WKWebView, context: Context) {}
}

/// The same document the portal frames (packages/core/src/markdown.ts figureDocument).
func figureDocument(_ html: String) -> String {
    """
    <!doctype html><html><head><meta charset="utf-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light dark">
    <style>
    :root{color-scheme:light dark;--fg:#1c2230;--muted:#6a7080;--panel:#fffefb;--soft:#eeebe3;--line:#cfcabd;--accent:#2b6cb0;--ok:#2f7d4f;--warn:#a66b00;--bad:#b4412f}
    @media (prefers-color-scheme:dark){:root{--fg:#e8e9ee;--muted:#9aa0ae;--panel:#1a1e27;--soft:#252a35;--line:#3a4150;--accent:#7fb0e6;--ok:#6cc08c;--warn:#f4b860;--bad:#ef8a78}}
    *{box-sizing:border-box}
    html,body{margin:0;background:transparent;color:var(--fg);font:14px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;-webkit-text-size-adjust:100%}
    body{padding:8px;min-height:100vh;display:flex;flex-direction:column;justify-content:center}
    body>*{flex:none}
    svg{max-width:100%;height:auto;display:block;margin:0 auto}
    svg text{fill:var(--fg);font-family:inherit}
    table{border-collapse:collapse}td,th{border:1px solid var(--line);padding:4px 8px;text-align:left}
    a{color:inherit;pointer-events:none;text-decoration:none}
    </style></head><body>
    \(html)
    </body></html>
    """
}

import FolioKit
import SwiftUI
import WebKit

/// An artifact rendered by the Worker's sandbox (`/r/…`). It keeps no cookies or storage, and links
/// that leave the artifact open in Safari instead of inside it.
///
/// With `onComment`, selecting text adds "Comment" to the edit menu; it hands back the selection as
/// an anchor (the text and a CSS selector of its element) and the file it's in. `highlight` finds
/// a comment's quoted text in the page, scrolls to it and selects it. Both run in an isolated
/// JavaScript world, so the artifact's own scripts can't see or change them.
struct WebPreview: UIViewRepresentable {
    let url: URL
    var onComment: ((CommentAnchor, String?) -> Void)? = nil
    var highlight: QuoteRequest? = nil
    var highlightMissed: (() -> Void)? = nil

    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> SelectableWebView {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .nonPersistent()
        config.allowsInlineMediaPlayback = true
        // Tells the app whether text is selected, so "Comment" only shows up over a selection.
        config.userContentController.addUserScript(WKUserScript(source: PreviewScript.watchSelection, injectionTime: .atDocumentEnd, forMainFrameOnly: true, in: .defaultClient))
        config.userContentController.add(context.coordinator, contentWorld: .defaultClient, name: "folioSelection")
        let web = SelectableWebView(frame: .zero, configuration: config)
        web.navigationDelegate = context.coordinator
        web.uiDelegate = context.coordinator
        web.isOpaque = false
        web.backgroundColor = .systemBackground
        web.allowsBackForwardNavigationGestures = true
        context.coordinator.base = url
        context.coordinator.web = web
        web.load(URLRequest(url: url))
        return web
    }

    func updateUIView(_ web: SelectableWebView, context: Context) {
        let c = context.coordinator
        c.onComment = onComment
        c.highlightMissed = highlightMissed
        web.onComment = onComment == nil ? nil : { [weak c] in c?.commentOnSelection() }
        if c.base != url {
            c.base = url
            web.load(URLRequest(url: url))
        }
        if let highlight, highlight.id != c.lastHighlight {
            c.lastHighlight = highlight.id
            c.show(highlight)
        }
    }

    static func dismantleUIView(_ web: SelectableWebView, coordinator: Coordinator) {
        web.configuration.userContentController.removeScriptMessageHandler(forName: "folioSelection", contentWorld: .defaultClient)
    }

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
        var base: URL?
        weak var web: WKWebView?
        var onComment: ((CommentAnchor, String?) -> Void)?
        var highlightMissed: (() -> Void)?
        var lastHighlight: UUID?
        private var pending: QuoteRequest?
        private var loading = true

        func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
            (web as? SelectableWebView)?.hasSelection = (message.body as? Bool) ?? false
        }

        func commentOnSelection() {
            guard let web, let base else { return }
            web.evaluateJavaScript(PreviewScript.selection, in: nil, in: .defaultClient) { [weak self] result in
                guard let self, case .success(let value) = result, let json = value as? String,
                      let d = try? JSONSerialization.jsonObject(with: Data(json.utf8)) as? [String: String],
                      let text = d["text"], !text.isEmpty else { return }
                let path = web.url.flatMap { RenderPath.file(of: $0, base: base) }
                self.onComment?(CommentAnchor(selector: d["selector"], text: text), path)
            }
        }

        /// Opens the comment's file when it's another one, then finds the quote once it has loaded.
        func show(_ q: QuoteRequest) {
            guard let web, let base else { return }
            let current = web.url.flatMap { RenderPath.file(of: $0, base: base) }
            if let path = q.path, path != current, let u = URL(string: path.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? path, relativeTo: base) {
                pending = q
                loading = true
                web.load(URLRequest(url: u.absoluteURL))
            } else if loading {
                pending = q
            } else {
                find(q)
            }
        }

        private func find(_ q: QuoteRequest) {
            guard let web else { return }
            web.evaluateJavaScript(PreviewScript.find, in: nil, in: .defaultClient, completionHandler: nil)
            web.callAsyncJavaScript("return folioFind(text, selector)", arguments: ["text": q.text ?? "", "selector": q.selector ?? ""], in: nil, in: .defaultClient) { [weak self] result in
                if case .success(let found) = result, (found as? Bool) == true { return }
                self?.highlightMissed?()
            }
        }

        func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
            loading = true
            (webView as? SelectableWebView)?.hasSelection = false
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            loading = false
            if let q = pending {
                pending = nil
                find(q)
            }
        }

        func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction) async -> WKNavigationActionPolicy {
            guard let u = action.request.url, let base else { return .allow }
            // Inside the artifact's own render path: allow. Anything else: Safari (taps only).
            let prefix = base.absoluteString // ends in "/": every file of this version
            if u.absoluteString.hasPrefix(prefix) || u.scheme == "about" || u.scheme == "data" || u.scheme == "blob" { return .allow }
            if action.navigationType == .linkActivated, ["http", "https", "mailto", "tel"].contains(u.scheme ?? "") {
                await UIApplication.shared.open(u)
            }
            return action.targetFrame?.isMainFrame == false ? .allow : .cancel
        }

        // target="_blank": open outside.
        func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
            if let u = action.request.url { UIApplication.shared.open(u) }
            return nil
        }
    }
}

/// A request to find a comment's quote in the preview; a new id runs it again.
struct QuoteRequest: Equatable {
    let id = UUID()
    let text: String?
    let selector: String?
    let path: String?
}

/// Adds "Comment" to the menu that appears over selected text.
final class SelectableWebView: WKWebView {
    var onComment: (() -> Void)?
    var hasSelection = false

    override func buildMenu(with builder: UIMenuBuilder) {
        super.buildMenu(with: builder)
        guard let onComment, hasSelection, builder.system == .context else { return }
        let action = UIAction(title: "Comment", image: UIImage(systemName: "text.bubble")) { _ in onComment() }
        builder.insertChild(UIMenu(options: .displayInline, children: [action]), atStartOfMenu: .root)
    }
}

/// Scripts the app runs in its own JavaScript world (`WKContentWorld.defaultClient`): the page's
/// scripts share the DOM but not these functions or variables.
enum PreviewScript {
    /// The selected text (whitespace collapsed, at most 500 characters, the server's limit) and a
    /// CSS selector for the element around it: from the nearest id, else from body, at most six steps.
    static let selection = """
    (() => {
      const s = getSelection();
      const text = s ? s.toString().replace(/\\s+/g, " ").trim() : "";
      if (!text || !s.rangeCount) return null;
      let n = s.getRangeAt(0).commonAncestorContainer;
      if (n.nodeType !== 1) n = n.parentElement;
      const parts = [];
      while (n && n.nodeType === 1 && n !== document.body && n !== document.documentElement && parts.length < 6) {
        if (n.id) { parts.unshift("#" + CSS.escape(n.id)); break; }
        let i = 1, p = n;
        while ((p = p.previousElementSibling)) if (p.tagName === n.tagName) i++;
        parts.unshift(n.tagName.toLowerCase() + ":nth-of-type(" + i + ")");
        n = n.parentElement;
      }
      if (parts.length && n === document.body) parts.unshift("body");
      return JSON.stringify({ text: text.slice(0, 500), selector: parts.join(" > ") });
    })()
    """

    /// Reports whether any text is selected, whenever that changes.
    static let watchSelection = """
    (() => {
      let last = null;
      document.addEventListener("selectionchange", () => {
        const s = getSelection();
        const has = !!s && !s.isCollapsed && s.toString().trim().length > 0;
        if (has !== last) { last = has; window.webkit.messageHandlers.folioSelection.postMessage(has); }
      });
    })();
    """

    /// `folioFind(text, selector)`: selects and scrolls to the quote (whole, then its first words, for
    /// a quote that spans paragraphs), else scrolls to the selector's element. True when it found either.
    static let find = """
    window.folioFind = (text, selector) => {
      const sel = getSelection();
      const tryFind = (q) => {
        if (!q) return false;
        sel.removeAllRanges();
        const ok = window.find(q, false, false, true, false, false, false);
        if (ok && sel.rangeCount) {
          const r = sel.getRangeAt(0).getBoundingClientRect();
          window.scrollBy({ top: r.top - innerHeight / 3, behavior: "smooth" });
        }
        return ok;
      };
      const words = (text || "").split(" ");
      if (tryFind(text) || tryFind(words.slice(0, 8).join(" ")) || tryFind(words.slice(0, 4).join(" "))) return true;
      sel.removeAllRanges();
      try {
        const el = selector && document.querySelector(selector);
        if (el) { el.scrollIntoView({ behavior: "smooth", block: "center" }); return true; }
      } catch (e) {}
      return false;
    };
    """
}

struct FullScreenPreview: View {
    let url: URL
    let title: String
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            WebPreview(url: url)
                .ignoresSafeArea(edges: .bottom)
                .navigationTitle(title)
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } }
                }
        }
    }
}

/// The system share sheet for files (an exported .zip).
struct ShareSheet: UIViewControllerRepresentable {
    let items: [Any]
    func makeUIViewController(context: Context) -> UIActivityViewController { UIActivityViewController(activityItems: items, applicationActivities: nil) }
    func updateUIViewController(_ vc: UIActivityViewController, context: Context) {}
}

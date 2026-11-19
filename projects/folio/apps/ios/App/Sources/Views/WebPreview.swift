import SwiftUI
import WebKit

/// An artifact rendered by the Worker's sandbox (`/r/…`). It keeps no cookies or storage, and links
/// that leave the artifact open in Safari instead of inside it.
struct WebPreview: UIViewRepresentable {
    let url: URL

    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .nonPersistent()
        config.allowsInlineMediaPlayback = true
        let web = WKWebView(frame: .zero, configuration: config)
        web.navigationDelegate = context.coordinator
        web.uiDelegate = context.coordinator
        web.isOpaque = false
        web.backgroundColor = .systemBackground
        web.allowsBackForwardNavigationGestures = true
        context.coordinator.base = url
        web.load(URLRequest(url: url))
        return web
    }

    func updateUIView(_ web: WKWebView, context: Context) {
        if context.coordinator.base != url {
            context.coordinator.base = url
            web.load(URLRequest(url: url))
        }
    }

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
        var base: URL?

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

import TetherKit
import UIKit
import WebKit

@MainActor
public final class WebTabViewController: UIViewController, WKNavigationDelegate, WKUIDelegate, WKDownloadDelegate, UITextFieldDelegate, WKScriptMessageHandler {
    private let store: WorkspaceStore
    public var paneId: String
    public var tabItem: TetherKit.Tab

    private var webView: WKWebView!
    private let addressField = UITextField()
    private let backButton = UIButton(type: .system)
    private let forwardButton = UIButton(type: .system)
    private let reloadStopButton = UIButton(type: .system)
    private let safariButton = UIButton(type: .system)
    private let bookmarkButton = UIButton(type: .system)
    private let progressView = UIProgressView(progressViewStyle: .bar)
    private let statusBanner = UILabel()
    private var progressObservation: NSKeyValueObservation?
    private var titleObservation: NSKeyValueObservation?
    private var urlObservation: NSKeyValueObservation?

    public init(store: WorkspaceStore, paneId: String, tab: TetherKit.Tab) {
        self.store = store
        self.paneId = paneId
        self.tabItem = tab
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    public override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 0.05, green: 0.08, blue: 0.13, alpha: 1.0)
        setupToolbarAndWebView()
        let initialURLString = tabItem.url ?? TetherConstants.defaultWebHomeURL
        loadInput(initialURLString)
    }

    public func focusAddressBar() {
        addressField.becomeFirstResponder()
        addressField.selectAll(nil)
    }

    public func reloadCurrentPage() {
        webView.reload()
    }

    public func simulateClick(at pointInView: CGPoint) {
        let ptInWeb = view.convert(pointInView, to: webView)
        let script = """
        (function() {
            var el = document.elementFromPoint(\(ptInWeb.x), \(ptInWeb.y));
            if (el) {
                el.focus();
                el.click();
                var evt = new MouseEvent('click', {
                    bubbles: true,
                    cancelable: true,
                    view: window,
                    clientX: \(ptInWeb.x),
                    clientY: \(ptInWeb.y)
                });
                el.dispatchEvent(evt);
            }
        })();
        """
        webView.evaluateJavaScript(script, completionHandler: nil)
    }

    public func handleKeyInput(text: String) {
        if addressField.isFirstResponder {
            if text == "\r" || text == "\n" {
                _ = textFieldShouldReturn(addressField)
            } else if text == "\u{7F}" || text == "\u{08}" {
                var cur = addressField.text ?? ""
                if !cur.isEmpty {
                    cur.removeLast()
                    addressField.text = cur
                }
            } else {
                addressField.text = (addressField.text ?? "") + text
            }
            return
        }
        if text == " " {
            let cur = webView.scrollView.contentOffset
            webView.scrollView.setContentOffset(CGPoint(x: cur.x, y: cur.y + 200), animated: true)
        }
    }

    public func handleSpecialKey(_ key: SpecialKey) {
        switch key {
        case .up:
            let cur = webView.scrollView.contentOffset
            webView.scrollView.setContentOffset(CGPoint(x: cur.x, y: max(0, cur.y - 120)), animated: true)
        case .down:
            let cur = webView.scrollView.contentOffset
            webView.scrollView.setContentOffset(CGPoint(x: cur.x, y: cur.y + 120), animated: true)
        case .left:
            let cur = webView.scrollView.contentOffset
            webView.scrollView.setContentOffset(CGPoint(x: max(0, cur.x - 80), y: cur.y), animated: true)
        case .right:
            let cur = webView.scrollView.contentOffset
            webView.scrollView.setContentOffset(CGPoint(x: cur.x + 80, y: cur.y), animated: true)
        case .escape:
            addressField.resignFirstResponder()
        case .enter:
            if addressField.isFirstResponder {
                _ = textFieldShouldReturn(addressField)
            }
        case .backspace:
            handleKeyInput(text: "\u{7F}")
        default:
            break
        }
    }

    private func setupToolbarAndWebView() {
        // Toolbar container
        let toolbar = UIView()
        toolbar.translatesAutoresizingMaskIntoConstraints = false
        toolbar.backgroundColor = UIColor(red: 0.06, green: 0.09, blue: 0.16, alpha: 1.0)

        backButton.setImage(UIImage(systemName: "chevron.left"), for: .normal)
        backButton.tintColor = .white
        backButton.addTarget(self, action: #selector(goBackTapped), for: .touchUpInside)

        forwardButton.setImage(UIImage(systemName: "chevron.right"), for: .normal)
        forwardButton.tintColor = .white
        forwardButton.addTarget(self, action: #selector(goForwardTapped), for: .touchUpInside)

        reloadStopButton.setImage(UIImage(systemName: "arrow.clockwise"), for: .normal)
        reloadStopButton.tintColor = .white
        reloadStopButton.addTarget(self, action: #selector(reloadOrStopTapped), for: .touchUpInside)

        safariButton.setImage(UIImage(systemName: "safari"), for: .normal)
        safariButton.tintColor = UIColor(red: 0.22, green: 0.74, blue: 0.97, alpha: 1.0)
        safariButton.accessibilityLabel = "Open in Safari"
        safariButton.addTarget(self, action: #selector(openInSafariTapped), for: .touchUpInside)

        bookmarkButton.setImage(UIImage(systemName: "star"), for: .normal)
        bookmarkButton.tintColor = UIColor(red: 0.22, green: 0.74, blue: 0.97, alpha: 1.0)
        bookmarkButton.addTarget(self, action: #selector(bookmarkTapped), for: .touchUpInside)

        addressField.delegate = self
        addressField.font = UIFont.monospacedSystemFont(ofSize: 12, weight: .regular)
        addressField.textColor = .white
        addressField.backgroundColor = UIColor(red: 0.03, green: 0.05, blue: 0.09, alpha: 1.0)
        addressField.layer.cornerRadius = 5
        addressField.layer.borderWidth = 1
        addressField.layer.borderColor = UIColor(white: 1.0, alpha: 0.14).cgColor
        addressField.leftView = UIView(frame: CGRect(x: 0, y: 0, width: 8, height: 1))
        addressField.leftViewMode = .always
        addressField.autocapitalizationType = .none
        addressField.autocorrectionType = .no
        addressField.keyboardType = .URL
        addressField.returnKeyType = .go
        addressField.clearButtonMode = .whileEditing
        addressField.placeholder = "Enter URL or search query…"
        addressField.text = (tabItem.url == "about:home") ? "" : (tabItem.url ?? "")

        let stack = UIStackView(arrangedSubviews: [backButton, forwardButton, reloadStopButton, addressField, safariButton, bookmarkButton])
        stack.translatesAutoresizingMaskIntoConstraints = false
        stack.axis = .horizontal
        stack.spacing = 6
        stack.alignment = .center
        toolbar.addSubview(stack)

        progressView.translatesAutoresizingMaskIntoConstraints = false
        progressView.progressTintColor = UIColor(red: 0.22, green: 0.74, blue: 0.97, alpha: 1.0)
        progressView.trackTintColor = .clear
        progressView.isHidden = true
        toolbar.addSubview(progressView)

        // Native WKWebView configured for desktop mode & shared cookie store
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()
        config.defaultWebpagePreferences.preferredContentMode = .desktop
        config.allowsInlineMediaPlayback = true

        let userContentController = WKUserContentController()
        userContentController.add(self, name: "passkeyHandler")

        // Intercept WebAuthn credential calls to provide clear user guidance
        // when iOS restricts platform passkeys in embedded web views.
        let passkeySupportScript = WKUserScript(
            source: """
            (function() {
              if (window.navigator && window.navigator.credentials && window.navigator.credentials.get) {
                var origGet = window.navigator.credentials.get.bind(window.navigator.credentials);
                window.navigator.credentials.get = function(options) {
                  return origGet(options).catch(function(err) {
                    try {
                      if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.passkeyHandler) {
                        window.webkit.messageHandlers.passkeyHandler.postMessage({
                          error: err ? (err.message || err.name) : 'NotAllowedError'
                        });
                      }
                    } catch(e) {}
                    throw err;
                  });
                };
              }
            })();
            """,
            injectionTime: .atDocumentStart,
            forMainFrameOnly: false
        )
        userContentController.addUserScript(passkeySupportScript)
        config.userContentController = userContentController

        webView = WKWebView(frame: .zero, configuration: config)
        webView.translatesAutoresizingMaskIntoConstraints = false
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsBackForwardNavigationGestures = true

        statusBanner.translatesAutoresizingMaskIntoConstraints = false
        statusBanner.backgroundColor = UIColor(red: 0.06, green: 0.32, blue: 0.20, alpha: 0.95)
        statusBanner.textColor = .white
        statusBanner.font = .systemFont(ofSize: 12, weight: .medium)
        statusBanner.textAlignment = .center
        statusBanner.isHidden = true
        statusBanner.numberOfLines = 0

        view.addSubview(toolbar)
        view.addSubview(webView)
        view.addSubview(statusBanner)

        NSLayoutConstraint.activate([
            toolbar.topAnchor.constraint(equalTo: view.topAnchor),
            toolbar.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            toolbar.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            toolbar.heightAnchor.constraint(equalToConstant: 36),

            stack.leadingAnchor.constraint(equalTo: toolbar.leadingAnchor, constant: 8),
            stack.trailingAnchor.constraint(equalTo: toolbar.trailingAnchor, constant: -8),
            stack.centerYAnchor.constraint(equalTo: toolbar.centerYAnchor),
            addressField.heightAnchor.constraint(equalToConstant: 26),
            backButton.widthAnchor.constraint(equalToConstant: 26),
            forwardButton.widthAnchor.constraint(equalToConstant: 26),
            reloadStopButton.widthAnchor.constraint(equalToConstant: 26),
            safariButton.widthAnchor.constraint(equalToConstant: 26),
            bookmarkButton.widthAnchor.constraint(equalToConstant: 26),

            progressView.leadingAnchor.constraint(equalTo: toolbar.leadingAnchor),
            progressView.trailingAnchor.constraint(equalTo: toolbar.trailingAnchor),
            progressView.bottomAnchor.constraint(equalTo: toolbar.bottomAnchor),
            progressView.heightAnchor.constraint(equalToConstant: 2),

            webView.topAnchor.constraint(equalTo: toolbar.bottomAnchor),
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            webView.bottomAnchor.constraint(equalTo: view.bottomAnchor),

            statusBanner.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            statusBanner.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            statusBanner.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            statusBanner.heightAnchor.constraint(greaterThanOrEqualToConstant: 28),
        ])

        progressObservation = webView.observe(\.estimatedProgress, options: [.new]) { [weak self] wv, _ in
            Task { @MainActor in
                guard let self else { return }
                let p = Float(wv.estimatedProgress)
                self.progressView.isHidden = p >= 1.0
                self.progressView.setProgress(p, animated: true)
                let icon = wv.isLoading ? "xmark" : "arrow.clockwise"
                self.reloadStopButton.setImage(UIImage(systemName: icon), for: .normal)
                self.backButton.isEnabled = wv.canGoBack
                self.forwardButton.isEnabled = wv.canGoForward
            }
        }

        titleObservation = webView.observe(\.title, options: [.new]) { [weak self] wv, _ in
            Task { @MainActor in
                guard let self, let pageTitle = wv.title, !pageTitle.isEmpty else { return }
                self.updateTabState(url: wv.url?.absoluteString, pageTitle: pageTitle)
            }
        }

        urlObservation = webView.observe(\.url, options: [.new]) { [weak self] wv, _ in
            Task { @MainActor in
                guard let self, let urlStr = wv.url?.absoluteString else { return }
                if !self.addressField.isFirstResponder {
                    self.addressField.text = urlStr
                }
                self.updateTabState(url: urlStr, pageTitle: wv.title)
            }
        }
    }

    private func loadInput(_ raw: String) {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed == "about:home" || trimmed == "tether://start" || trimmed.isEmpty {
            addressField.text = ""
            updateTabState(url: "about:home", pageTitle: "New Tab")
            loadStarterPage()
            return
        }

        let resolved = PaneTreeOps.resolveAddressBarInput(
            raw,
            searchEngineUrl: store.settings.defaultSearchEngineUrl
        )
        addressField.text = resolved
        updateTabState(url: resolved, pageTitle: nil)
        if let url = URL(string: resolved) {
            if url.isFileURL {
                webView.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
            } else {
                webView.load(URLRequest(url: url))
            }
        }
    }

    private func loadStarterPage() {
        let defaultEngine = store.settings.defaultSearchEngineUrl
        let formAction = defaultEngine.contains("%s") ? defaultEngine.replacingOccurrences(of: "%s", with: "") : "https://duckduckgo.com/?q="
        let html = """
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>New Tab</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body {
              background: #060911;
              color: #f1f5f9;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              min-height: 100vh;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              padding: 24px;
            }
            .hero {
              text-align: center;
              margin-bottom: 24px;
            }
            .logo {
              font-size: 30px;
              font-weight: 800;
              letter-spacing: -0.5px;
              background: linear-gradient(135deg, #38bdf8 0%, #818cf8 100%);
              -webkit-background-clip: text;
              -webkit-text-fill-color: transparent;
              margin-bottom: 6px;
            }
            .tagline {
              font-size: 13px;
              color: #94a3b8;
            }
            .search-box {
              width: 100%;
              max-width: 560px;
              margin-bottom: 24px;
            }
            .search-form {
              display: flex;
              background: #0d1322;
              border: 1px solid rgba(255, 255, 255, 0.12);
              border-radius: 10px;
              overflow: hidden;
              box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
            }
            .search-input {
              flex: 1;
              background: transparent;
              border: none;
              padding: 12px 16px;
              font-size: 14px;
              color: #ffffff;
              outline: none;
            }
            .search-btn {
              background: #0284c7;
              color: #ffffff;
              border: none;
              padding: 0 18px;
              font-weight: 600;
              font-size: 13px;
              cursor: pointer;
            }
            .grid {
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
              gap: 10px;
              width: 100%;
              max-width: 560px;
              margin-bottom: 24px;
            }
            .card {
              background: #0f172a;
              border: 1px solid rgba(255, 255, 255, 0.08);
              border-radius: 8px;
              padding: 12px 10px;
              text-align: center;
              text-decoration: none;
              color: #e2e8f0;
              display: flex;
              flex-direction: column;
              align-items: center;
              gap: 6px;
              transition: all 0.15s ease;
            }
            .card:hover {
              background: #1e293b;
              border-color: #38bdf8;
              transform: translateY(-2px);
            }
            .card-icon {
              font-size: 20px;
            }
            .card-title {
              font-size: 12px;
              font-weight: 600;
            }
            .shortcuts {
              max-width: 560px;
              width: 100%;
              background: rgba(15, 23, 42, 0.6);
              border: 1px solid rgba(255, 255, 255, 0.06);
              border-radius: 8px;
              padding: 14px 18px;
            }
            .shortcuts-title {
              font-size: 11px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              color: #64748b;
              font-weight: 700;
              margin-bottom: 8px;
            }
            .shortcut-row {
              display: flex;
              justify-content: space-between;
              font-size: 12px;
              color: #94a3b8;
              padding: 3px 0;
            }
            .kbd {
              background: #1e293b;
              border: 1px solid rgba(255, 255, 255, 0.15);
              border-radius: 4px;
              padding: 2px 6px;
              font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
              color: #38bdf8;
              font-size: 11px;
            }
          </style>
        </head>
        <body>
          <div class="hero">
            <div class="logo">Tether Web</div>
            <div class="tagline">Desktop browser for your split-pane workspace</div>
          </div>

          <div class="search-box">
            <form class="search-form" action="\(formAction)" method="get">
              <input class="search-input" type="text" name="q" placeholder="Search the web or type a URL..." autofocus>
              <button class="search-btn" type="submit">Search</button>
            </form>
          </div>

          <div class="grid">
            <a class="card" href="https://github.com">
              <span class="card-icon">🐙</span>
              <span class="card-title">GitHub</span>
            </a>
            <a class="card" href="https://news.ycombinator.com">
              <span class="card-icon">⚡</span>
              <span class="card-title">Hacker News</span>
            </a>
            <a class="card" href="https://duckduckgo.com">
              <span class="card-icon">🦆</span>
              <span class="card-title">DuckDuckGo</span>
            </a>
            <a class="card" href="https://en.wikipedia.org">
              <span class="card-icon">📚</span>
              <span class="card-title">Wikipedia</span>
            </a>
            <a class="card" href="https://supabase.com">
              <span class="card-icon">⚡</span>
              <span class="card-title">Supabase</span>
            </a>
            <a class="card" href="http://localhost:3000">
              <span class="card-icon">💻</span>
              <span class="card-title">Localhost:3000</span>
            </a>
          </div>

          <div class="shortcuts">
            <div class="shortcuts-title">Keyboard Shortcuts</div>
            <div class="shortcut-row"><span>Global Command Palette</span><span class="kbd">⌘K / Ctrl+K</span></div>
            <div class="shortcut-row"><span>New Web Tab</span><span class="kbd">⌘T / Ctrl+T</span></div>
            <div class="shortcut-row"><span>Focus Address Bar</span><span class="kbd">⌘L / Ctrl+L</span></div>
            <div class="shortcut-row"><span>Cycle Split Layouts</span><span class="kbd">⌘1 – ⌘4</span></div>
          </div>
        </body>
        </html>
        """
        webView.loadHTMLString(html, baseURL: URL(string: "about:home"))
    }

    @objc private func openInSafariTapped() {
        guard let currentURL = webView.url ?? URL(string: addressField.text ?? "") else { return }
        if currentURL.scheme?.hasPrefix("http") == true {
            UIApplication.shared.open(currentURL)
        }
    }

    public func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        if message.name == "passkeyHandler" {
            showStatusBanner("Passkeys in embedded views are restricted by iOS. Tap password & use Face ID AutoFill to sign in.", isWarning: true)
        }
    }

    public func showStatusBanner(_ message: String, isWarning: Bool = false) {
        statusBanner.text = message
        statusBanner.backgroundColor = isWarning
            ? UIColor(red: 0.65, green: 0.25, blue: 0.05, alpha: 0.95)
            : UIColor(red: 0.06, green: 0.32, blue: 0.20, alpha: 0.95)
        statusBanner.isHidden = false
        Task { @MainActor in
            try? await Task.sleep(nanoseconds: 5_000_000_000)
            self.statusBanner.isHidden = true
        }
    }

    private func updateTabState(url: String?, pageTitle: String?) {
        store.tree = PaneTreeOps.updateTab(store.tree, paneId: paneId, tabId: tabItem.id) { t in
            if let url { t.url = url }
            if let pageTitle, !pageTitle.isEmpty {
                t.title = "Web: \(pageTitle)"
            } else {
                t.title = PaneTreeOps.computeTabTitle(tab: t, hosts: store.hosts)
            }
            self.tabItem = t
        }
    }

    @objc private func goBackTapped() {
        if webView.canGoBack { webView.goBack() }
    }

    @objc private func goForwardTapped() {
        if webView.canGoForward { webView.goForward() }
    }

    @objc private func reloadOrStopTapped() {
        if webView.isLoading {
            webView.stopLoading()
        } else {
            webView.reload()
        }
    }

    @objc private func bookmarkTapped() {
        let currentURL = webView.url?.absoluteString ?? tabItem.url ?? TetherConstants.defaultWebHomeURL
        let currentTitle = webView.title ?? tabItem.title

        var actions: [DesktopAlertAction] = []
        actions.append(DesktopAlertAction(title: "Bookmark This Page", style: .default) { [weak self] _ in
            guard let self else { return }
            let bm = Bookmark(title: currentTitle.isEmpty ? currentURL : currentTitle, url: currentURL)
            self.store.bookmarks.insert(bm, at: 0)
        })
        if let url = webView.url ?? URL(string: currentURL), url.scheme?.hasPrefix("http") == true {
            actions.append(DesktopAlertAction(title: "Open in Safari", style: .default) { _ in
                UIApplication.shared.open(url)
            })
        }
        for bm in store.bookmarks.prefix(6) {
            actions.append(DesktopAlertAction(title: "Open: \(bm.title)", style: .default) { [weak self] _ in
                self?.loadInput(bm.url)
            })
        }
        actions.append(DesktopAlertAction(title: "Cancel", style: .cancel))

        showDesktopAlert(
            title: "Bookmarks",
            message: currentURL,
            actions: actions
        )
    }

    public func textFieldShouldReturn(_ textField: UITextField) -> Bool {
        textField.resignFirstResponder()
        loadInput(textField.text ?? "")
        return true
    }

    // MARK: - WKUIDelegate (target="_blank" -> new tab in same pane, PRD §9.2)

    public func webView(
        _ webView: WKWebView,
        createWebViewWith configuration: WKWebViewConfiguration,
        for navigationAction: WKNavigationAction,
        windowFeatures: WKWindowFeatures
    ) -> WKWebView? {
        if navigationAction.targetFrame == nil || !(navigationAction.targetFrame?.isMainFrame ?? false) {
            if let targetURL = navigationAction.request.url?.absoluteString {
                store.openTab(type: .web, inPaneId: paneId, url: targetURL)
            }
        }
        return nil
    }

    // MARK: - WKNavigationDelegate & WKDownloadDelegate (PRD §9.2 Downloads)

    public func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationResponse: WKNavigationResponse,
        decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void
    ) {
        if !navigationResponse.canShowMIMEType {
            decisionHandler(.download)
        } else {
            decisionHandler(.allow)
        }
    }

    public func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) {
        download.delegate = self
    }

    public func download(
        _ download: WKDownload,
        decideDestinationUsing response: URLResponse,
        suggestedFilename: String,
        completionHandler: @escaping (URL?) -> Void
    ) {
        let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
        let downloadsDir = docs.appendingPathComponent("Downloads", isDirectory: true)
        try? FileManager.default.createDirectory(at: downloadsDir, withIntermediateDirectories: true)
        let dest = downloadsDir.appendingPathComponent(suggestedFilename)
        try? FileManager.default.removeItem(at: dest)
        completionHandler(dest)
    }

    public func downloadDidFinish(_ download: WKDownload) {
        showStatusBanner("Downloaded to Documents/Downloads", isWarning: false)
    }
}

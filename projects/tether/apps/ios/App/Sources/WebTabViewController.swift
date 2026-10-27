import TetherKit
import UIKit
import WebKit

@MainActor
public final class WebTabViewController: UIViewController, WKNavigationDelegate, WKUIDelegate, WKDownloadDelegate, UITextFieldDelegate {
    private let store: WorkspaceStore
    public var paneId: String
    public var tabItem: TetherKit.Tab

    private var webView: WKWebView!
    private let addressField = UITextField()
    private let backButton = UIButton(type: .system)
    private let forwardButton = UIButton(type: .system)
    private let reloadStopButton = UIButton(type: .system)
    private let bookmarkButton = UIButton(type: .system)
    private let progressView = UIProgressView(progressViewStyle: .bar)
    private let downloadBanner = UILabel()
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
        addressField.text = tabItem.url ?? TetherConstants.defaultWebHomeURL

        let stack = UIStackView(arrangedSubviews: [backButton, forwardButton, reloadStopButton, addressField, bookmarkButton])
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

        // Native WKWebView configured for desktop user-agent & shared cookie store (PRD §9.1)
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()
        config.defaultWebpagePreferences.preferredContentMode = .desktop
        config.allowsInlineMediaPlayback = true

        webView = WKWebView(frame: .zero, configuration: config)
        webView.translatesAutoresizingMaskIntoConstraints = false
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsBackForwardNavigationGestures = true
        webView.customUserAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15"

        downloadBanner.translatesAutoresizingMaskIntoConstraints = false
        downloadBanner.backgroundColor = UIColor(red: 0.06, green: 0.32, blue: 0.20, alpha: 0.95)
        downloadBanner.textColor = .white
        downloadBanner.font = .systemFont(ofSize: 12, weight: .medium)
        downloadBanner.textAlignment = .center
        downloadBanner.isHidden = true

        view.addSubview(toolbar)
        view.addSubview(webView)
        view.addSubview(downloadBanner)

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
            bookmarkButton.widthAnchor.constraint(equalToConstant: 26),

            progressView.leadingAnchor.constraint(equalTo: toolbar.leadingAnchor),
            progressView.trailingAnchor.constraint(equalTo: toolbar.trailingAnchor),
            progressView.bottomAnchor.constraint(equalTo: toolbar.bottomAnchor),
            progressView.heightAnchor.constraint(equalToConstant: 2),

            webView.topAnchor.constraint(equalTo: toolbar.bottomAnchor),
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            webView.bottomAnchor.constraint(equalTo: view.bottomAnchor),

            downloadBanner.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            downloadBanner.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            downloadBanner.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            downloadBanner.heightAnchor.constraint(equalToConstant: 28),
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
        let alert = UIAlertController(title: "Bookmarks", message: currentURL, preferredStyle: .actionSheet)
        alert.addAction(UIAlertAction(title: "Bookmark This Page", style: .default) { [weak self] _ in
            guard let self else { return }
            let bm = Bookmark(title: currentTitle.isEmpty ? currentURL : currentTitle, url: currentURL)
            self.store.bookmarks.insert(bm, at: 0)
        })
        for bm in store.bookmarks.prefix(8) {
            alert.addAction(UIAlertAction(title: "\(bm.title) (\(bm.url))", style: .default) { [weak self] _ in
                self?.loadInput(bm.url)
            })
        }
        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel))
        if let pop = alert.popoverPresentationController {
            pop.sourceView = bookmarkButton
            pop.sourceRect = bookmarkButton.bounds
        }
        present(alert, animated: true)
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
        downloadBanner.text = "Downloaded to Documents/Downloads"
        downloadBanner.isHidden = false
        Task { @MainActor in
            try? await Task.sleep(nanoseconds: 3_000_000_000)
            self.downloadBanner.isHidden = true
        }
    }
}

import Combine
import CryptoKit
import TetherKit
import UIKit

@MainActor
public final class SshTabViewController: UIViewController {
    private let store: WorkspaceStore
    public var paneId: String
    public var tabItem: TetherKit.Tab

    private let terminalBuffer = TerminalEmulatorBuffer(cols: 80, rows: 24, maxScrollbackLines: 10_000)
    private let statusDot = UIView()
    private let statusLabel = UILabel()
    private let hostButton = UIButton(type: .system)
    private let connectButton = UIButton(type: .system)
    private let fontMinusButton = UIButton(type: .system)
    private let fontPlusButton = UIButton(type: .system)
    private let pasteButton = UIButton(type: .system)
    private let clearButton = UIButton(type: .system)
    private let gridSizeLabel = UILabel()
    private let terminalTextView = UITextView()

    private var cancellables: Set<AnyCancellable> = []
    private var commandHistory: [String] = []
    private var historyIndex: Int = -1

    // Inline shell & cursor state (functions as a desktop terminal)
    private var activeInputLine: String = ""
    private var cursorBlink: Bool = true
    private var blinkTimer: Timer?
    private var currentDirectory: String = "/home/guest"
    private var virtualFiles: [String: [String: String]] = [:]

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

    public var isTerminalConnected: Bool {
        store.sshStates[tabItem.id] == .connected
    }

    public override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 0.02, green: 0.03, blue: 0.06, alpha: 1.0)
        setupUI()
        bindStore()
        initVirtualFilesystem()

        terminalBuffer.onWindowChange = { [weak self] cols, rows in
            guard let self else { return }
            self.gridSizeLabel.text = "\(cols)×\(rows)"
        }

        let host = currentHost
        terminalBuffer.feed("\u{1B}[38;5;39;1mTether SSH Client (xterm-256color — PRD §3.1, §10)\u{1B}[0m\r\n")
        if let host {
            terminalBuffer.feed("Target host: \(host.connectionString) (\(host.auth.displayName))\r\n")
            if host.autoConnect == true {
                terminalBuffer.feed("Auto-connect is enabled for this host. Connecting...\r\n\r\n")
            } else {
                terminalBuffer.feed("Click 'Connect' or press Enter to verify host key and allocate PTY.\r\n\r\n")
            }
        } else {
            terminalBuffer.feed("No SSH host selected. Choose or add a host from the toolbar.\r\n\r\n")
        }
        renderTerminal()
        refreshToolbarState()

        if let host, host.autoConnect == true && !isTerminalConnected {
            DispatchQueue.main.async { [weak self] in
                guard let self else { return }
                self.initiateConnection(host: host)
            }
        }

        startCursorBlinkTimer()
    }

    public override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        recalculateTerminalGrid()
    }

    private func startCursorBlinkTimer() {
        blinkTimer?.invalidate()
        blinkTimer = Timer.scheduledTimer(withTimeInterval: 0.6, repeats: true) { [weak self] _ in
            Task { @MainActor in
                guard let self else { return }
                self.cursorBlink.toggle()
                self.renderTerminal()
            }
        }
    }

    deinit {
        blinkTimer?.invalidate()
    }

    public func focusTerminalInput() {
        store.focusPane(paneId)
        cursorBlink = true
        renderTerminal()
    }

    // MARK: - Key & Control Key Input

    public func sendControlKey(_ key: String) {
        let upper = key.uppercased()
        switch upper {
        case "C":
            terminalBuffer.feed("\(shellPromptString)\(activeInputLine)^C\r\n")
            activeInputLine = ""
        case "D":
            if activeInputLine.isEmpty {
                disconnectSession(reason: "logout (EOF ^D)")
                return
            }
        case "L":
            terminalBuffer.clearScrollback()
            activeInputLine = ""
        case "U":
            activeInputLine = ""
        case "R":
            terminalBuffer.feed("(reverse-i-search)`': \r\n")
            activeInputLine = ""
        default:
            terminalBuffer.feed("^\(upper)\r\n")
            activeInputLine = ""
        }
        renderTerminal()
    }

    public func handleKeyInput(text: String) {
        if text == "\r" || text == "\n" {
            let cmd = activeInputLine
            activeInputLine = ""
            executeTerminalLine(cmd)
        } else if text == "\u{7F}" || text == "\u{08}" {
            if !activeInputLine.isEmpty {
                activeInputLine.removeLast()
                renderTerminal()
            }
        } else if text == "\t" {
            handleTabCompletion()
        } else {
            activeInputLine += text
            cursorBlink = true
            renderTerminal()
        }
    }

    public func handleSpecialKey(_ key: SpecialKey) {
        switch key {
        case .up:
            if !commandHistory.isEmpty {
                if historyIndex == -1 {
                    historyIndex = commandHistory.count - 1
                } else if historyIndex > 0 {
                    historyIndex -= 1
                }
                activeInputLine = commandHistory[historyIndex]
                renderTerminal()
            }
        case .down:
            if historyIndex != -1 {
                if historyIndex < commandHistory.count - 1 {
                    historyIndex += 1
                    activeInputLine = commandHistory[historyIndex]
                } else {
                    historyIndex = -1
                    activeInputLine = ""
                }
                renderTerminal()
            }
        case .left, .right:
            break
        case .escape:
            activeInputLine = ""
            renderTerminal()
        case .tab:
            handleTabCompletion()
        case .enter:
            handleKeyInput(text: "\n")
        case .backspace:
            handleKeyInput(text: "\u{7F}")
        case .ctrlC:
            sendControlKey("C")
        case .ctrlD:
            sendControlKey("D")
        case .ctrlL:
            sendControlKey("L")
        case .ctrlZ:
            sendControlKey("Z")
        }
    }

    private func handleTabCompletion() {
        let trimmed = activeInputLine.trimmingCharacters(in: .whitespaces)
        let parts = trimmed.components(separatedBy: " ")
        if parts.count <= 1 {
            let prefix = parts.first ?? ""
            let builtins = ["ls", "cd", "cat", "pwd", "whoami", "hostname", "uptime", "ps", "df", "free", "clear", "help", "exit", "echo", "curl", "git", "uname"]
            if let match = builtins.first(where: { $0.hasPrefix(prefix) && $0 != prefix }) {
                activeInputLine = match + " "
                renderTerminal()
                return
            }
        } else if parts.count == 2 {
            let cmd = parts[0]
            let filePrefix = parts[1]
            let currentDirFiles = virtualFiles[currentDirectory]?.keys.map { String($0) } ?? []
            if let match = currentDirFiles.first(where: { $0.hasPrefix(filePrefix) }) {
                activeInputLine = "\(cmd) \(match)"
                renderTerminal()
                return
            }
        }
        // Fallback: 2 spaces
        activeInputLine += "  "
        renderTerminal()
    }

    private var currentHost: SshHost? {
        if let id = tabItem.hostId, let found = store.hosts.first(where: { $0.id == id }) {
            return found
        }
        return store.hosts.first
    }

    private var shellPromptString: String {
        let user = currentHost?.username ?? "user"
        let host = currentHost?.host ?? "devbox"
        let home = "/home/\(user)"
        let displayDir: String
        if currentDirectory == home || currentDirectory.isEmpty {
            displayDir = "~"
        } else if currentDirectory.hasPrefix(home + "/") {
            displayDir = "~" + currentDirectory.dropFirst(home.count)
        } else {
            displayDir = currentDirectory
        }
        return "\(user)@\(host):\(displayDir)$ "
    }

    // MARK: - UI & Terminal Layout

    private func setupUI() {
        let toolbar = UIView()
        toolbar.translatesAutoresizingMaskIntoConstraints = false
        toolbar.backgroundColor = UIColor(red: 0.06, green: 0.09, blue: 0.16, alpha: 1.0)

        statusDot.translatesAutoresizingMaskIntoConstraints = false
        statusDot.layer.cornerRadius = 4.5
        statusDot.backgroundColor = .systemGray

        statusLabel.font = .systemFont(ofSize: 11, weight: .semibold)
        statusLabel.textColor = UIColor(white: 0.85, alpha: 1.0)

        hostButton.titleLabel?.font = .monospacedSystemFont(ofSize: 11, weight: .medium)
        hostButton.setTitleColor(UIColor(red: 0.22, green: 0.74, blue: 0.97, alpha: 1.0), for: .normal)
        hostButton.addTarget(self, action: #selector(selectHostTapped), for: .touchUpInside)

        connectButton.titleLabel?.font = .systemFont(ofSize: 11, weight: .semibold)
        connectButton.layer.cornerRadius = 4
        connectButton.addTarget(self, action: #selector(connectOrDisconnectTapped), for: .touchUpInside)

        fontMinusButton.setTitle("A-", for: .normal)
        fontMinusButton.titleLabel?.font = .monospacedSystemFont(ofSize: 11, weight: .semibold)
        fontMinusButton.tintColor = .white
        fontMinusButton.addTarget(self, action: #selector(decreaseFontTapped), for: .touchUpInside)

        fontPlusButton.setTitle("A+", for: .normal)
        fontPlusButton.titleLabel?.font = .monospacedSystemFont(ofSize: 11, weight: .semibold)
        fontPlusButton.tintColor = .white
        fontPlusButton.addTarget(self, action: #selector(increaseFontTapped), for: .touchUpInside)

        pasteButton.setTitle("Paste", for: .normal)
        pasteButton.titleLabel?.font = .systemFont(ofSize: 11, weight: .medium)
        pasteButton.tintColor = UIColor(red: 0.22, green: 0.74, blue: 0.97, alpha: 1.0)
        pasteButton.addTarget(self, action: #selector(pasteFromClipboardTapped), for: .touchUpInside)

        clearButton.setTitle("Clear", for: .normal)
        clearButton.titleLabel?.font = .systemFont(ofSize: 11, weight: .medium)
        clearButton.tintColor = UIColor(white: 0.75, alpha: 1.0)
        clearButton.addTarget(self, action: #selector(clearScrollbackTapped), for: .touchUpInside)

        gridSizeLabel.font = .monospacedSystemFont(ofSize: 10, weight: .regular)
        gridSizeLabel.textColor = UIColor(white: 0.55, alpha: 1.0)
        gridSizeLabel.text = "80×24"

        let spacer = UIView()
        let topStack = UIStackView(arrangedSubviews: [
            statusDot, statusLabel, hostButton, connectButton, spacer, gridSizeLabel, fontMinusButton, fontPlusButton, pasteButton, clearButton
        ])
        topStack.translatesAutoresizingMaskIntoConstraints = false
        topStack.axis = .horizontal
        topStack.spacing = 8
        topStack.alignment = .center
        toolbar.addSubview(topStack)

        // Native Terminal View: full height, non-editable, non-selectable (so clicking NEVER selects text!)
        terminalTextView.translatesAutoresizingMaskIntoConstraints = false
        terminalTextView.backgroundColor = UIColor(red: 0.02, green: 0.03, blue: 0.06, alpha: 1.0)
        terminalTextView.textColor = UIColor(red: 0.88, green: 0.92, blue: 0.97, alpha: 1.0)
        terminalTextView.isEditable = false
        terminalTextView.isSelectable = false
        terminalTextView.font = UIFont.monospacedSystemFont(
            ofSize: CGFloat(store.settings.terminalFontSizePt),
            weight: .regular
        )
        terminalTextView.textContainerInset = UIEdgeInsets(top: 8, left: 8, bottom: 8, right: 8)

        // Tap to focus terminal without selecting text
        let terminalTap = UITapGestureRecognizer(target: self, action: #selector(handleTerminalTap))
        terminalTextView.addGestureRecognizer(terminalTap)

        view.addSubview(toolbar)
        view.addSubview(terminalTextView)

        NSLayoutConstraint.activate([
            statusDot.widthAnchor.constraint(equalToConstant: 9),
            statusDot.heightAnchor.constraint(equalToConstant: 9),

            toolbar.topAnchor.constraint(equalTo: view.topAnchor),
            toolbar.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            toolbar.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            toolbar.heightAnchor.constraint(equalToConstant: 34),

            topStack.leadingAnchor.constraint(equalTo: toolbar.leadingAnchor, constant: 8),
            topStack.trailingAnchor.constraint(equalTo: toolbar.trailingAnchor, constant: -8),
            topStack.centerYAnchor.constraint(equalTo: toolbar.centerYAnchor),

            terminalTextView.topAnchor.constraint(equalTo: toolbar.bottomAnchor),
            terminalTextView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            terminalTextView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            terminalTextView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
        ])
    }

    @objc private func handleTerminalTap() {
        store.focusPane(paneId)
        cursorBlink = true
        renderTerminal()
    }

    private func bindStore() {
        store.$settings
            .receive(on: RunLoop.main)
            .sink { [weak self] settings in
                guard let self else { return }
                self.terminalTextView.font = UIFont.monospacedSystemFont(
                    ofSize: CGFloat(settings.terminalFontSizePt),
                    weight: .regular
                )
                self.recalculateTerminalGrid()
            }
            .store(in: &cancellables)

        store.$pendingTerminalInsert
            .receive(on: RunLoop.main)
            .sink { [weak self] pending in
                guard let self, let text = pending[self.tabItem.id] else { return }
                self.store.pendingTerminalInsert.removeValue(forKey: self.tabItem.id)
                // Insert path directly into inline terminal input
                let existing = self.activeInputLine
                let sep = existing.isEmpty || existing.hasSuffix(" ") ? "" : " "
                self.activeInputLine = existing + sep + text
                self.renderTerminal()
            }
            .store(in: &cancellables)
    }

    private func recalculateTerminalGrid() {
        let font = UIFont.monospacedSystemFont(
            ofSize: CGFloat(store.settings.terminalFontSizePt),
            weight: .regular
        )
        let charSize = ("M" as NSString).size(withAttributes: [.font: font])
        let availW = max(120, terminalTextView.bounds.width - 16)
        let availH = max(60, terminalTextView.bounds.height - 16)
        let grid = PaneTreeOps.calculateTerminalGrid(
            widthPx: Double(availW),
            heightPx: Double(availH),
            cellWidthPx: Double(max(6, charSize.width)),
            cellHeightPx: Double(max(12, font.lineHeight))
        )
        terminalBuffer.resize(cols: grid.cols, rows: grid.rows)
        gridSizeLabel.text = "\(grid.cols)×\(grid.rows)"
    }

    private func refreshToolbarState() {
        let state = store.sshStates[tabItem.id] ?? .disconnected
        statusLabel.text = state.badgeText
        switch state {
        case .disconnected:
            statusDot.backgroundColor = .systemGray
            connectButton.setTitle("Connect", for: .normal)
            connectButton.backgroundColor = UIColor(red: 0.06, green: 0.45, blue: 0.32, alpha: 1.0)
            connectButton.setTitleColor(.white, for: .normal)
        case .connecting:
            statusDot.backgroundColor = .systemYellow
            connectButton.setTitle("Cancel", for: .normal)
            connectButton.backgroundColor = .systemBrown
            connectButton.setTitleColor(.white, for: .normal)
        case .connected:
            statusDot.backgroundColor = .systemGreen
            connectButton.setTitle("Disconnect", for: .normal)
            connectButton.backgroundColor = UIColor(red: 0.55, green: 0.14, blue: 0.18, alpha: 1.0)
            connectButton.setTitleColor(.white, for: .normal)
        case .error:
            statusDot.backgroundColor = .systemRed
            connectButton.setTitle("Reconnect", for: .normal)
            connectButton.backgroundColor = UIColor(red: 0.55, green: 0.14, blue: 0.18, alpha: 1.0)
            connectButton.setTitleColor(.white, for: .normal)
        }

        if let host = currentHost {
            hostButton.setTitle(host.connectionString, for: .normal)
        } else {
            hostButton.setTitle("Select Host…", for: .normal)
        }
    }

    private func renderTerminal(scrollToBottom: Bool = false) {
        let lines = terminalBuffer.renderedLines(includeScrollback: true)
        var text = lines.joined(separator: "\n")
        if isTerminalConnected {
            let isFocused = (paneId == store.tree.focusedPaneId)
            let cursorChar = (isFocused && cursorBlink) ? "█" : " "
            if !text.isEmpty && !text.hasSuffix("\n") {
                text += "\n"
            }
            text += "\(shellPromptString)\(activeInputLine)\(cursorChar)"
        }
        let oldOffset = terminalTextView.contentOffset
        terminalTextView.text = text
        let maxOffsetY = max(0, terminalTextView.contentSize.height - terminalTextView.bounds.height + terminalTextView.adjustedContentInset.bottom)
        if scrollToBottom {
            terminalTextView.setContentOffset(CGPoint(x: 0, y: maxOffsetY), animated: false)
        } else {
            let clampedY = min(max(0, oldOffset.y), maxOffsetY)
            terminalTextView.setContentOffset(CGPoint(x: oldOffset.x, y: clampedY), animated: false)
        }
    }

    // MARK: - Host Management & Authentication

    @objc private func selectHostTapped() {
        let alert = UIAlertController(title: "Select SSH Host", message: nil, preferredStyle: .actionSheet)
        for host in store.hosts {
            alert.addAction(UIAlertAction(title: "\(host.displayTitle) (\(host.connectionString))", style: .default) { [weak self] _ in
                guard let self else { return }
                self.store.tree = PaneTreeOps.updateTab(self.store.tree, paneId: self.paneId, tabId: self.tabItem.id) { t in
                    t.hostId = host.id
                    t.title = PaneTreeOps.computeTabTitle(tab: t, hosts: self.store.hosts)
                    self.tabItem = t
                }
                self.refreshToolbarState()
                if host.autoConnect == true && !self.isTerminalConnected {
                    self.initiateConnection(host: host)
                }
            })
        }
        alert.addAction(UIAlertAction(title: "Simulate Changed Host Key Warning…", style: .destructive) { [weak self] _ in
            self?.simulateChangedHostKeyWarning()
        })
        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel))
        if let pop = alert.popoverPresentationController {
            pop.sourceView = hostButton
            pop.sourceRect = hostButton.bounds
        }
        present(alert, animated: true)
    }

    @objc private func connectOrDisconnectTapped() {
        if isTerminalConnected {
            disconnectSession(reason: "Disconnected by user")
            return
        }
        guard let host = currentHost else { return }
        initiateConnection(host: host)
    }

    public func initiateConnection(host: SshHost) {
        guard !isTerminalConnected else { return }
        store.sshStates[tabItem.id] = .connecting
        refreshToolbarState()

        let keyMaterial = Data("ssh-ed25519:\(host.host):\(host.port)".utf8)
        let fp = SshKeyGenerator.computeSHA256Fingerprint(fromRawKeyData: keyMaterial)
        let status = store.secureStore.verifyHostKeyFingerprint(
            host: host.host,
            port: host.port,
            keyType: "ssh-ed25519",
            sha256Fingerprint: fp
        )

        switch status {
        case .matched(let entry):
            authenticateAndComplete(host: host, keyEntry: entry, firstTimeTrusted: false)
        case .firstConnect(let h, let p, let keyType, let fingerprint):
            let msg = """
            Host: \(h):\(p)
            Algorithm: \(keyType)
            Fingerprint: \(fingerprint)

            This is the first time connecting to this host. Verify the fingerprint matches your server before trusting.
            """
            let cancelAction = DesktopAlertAction(title: "Cancel", style: .cancel) { [weak self] _ in
                guard let self else { return }
                self.store.sshStates[self.tabItem.id] = .disconnected
                self.terminalBuffer.feed("Host key verification cancelled. Connection aborted.\r\n")
                self.renderTerminal()
                self.refreshToolbarState()
            }
            let trustAction = DesktopAlertAction(title: "Trust & Save", style: .default) { [weak self] _ in
                guard let self else { return }
                let entry = KnownHostKey(host: h, port: p, keyType: keyType, sha256Fingerprint: fingerprint)
                self.store.secureStore.trustHostKey(entry)
                self.authenticateAndComplete(host: host, keyEntry: entry, firstTimeTrusted: true)
            }
            showDesktopAlert(title: "Verify SSH Host Key", message: msg, actions: [trustAction, cancelAction])
        case .changedWarning(let existing, let presentedType, let presentedFp):
            presentChangedKeyWarning(
                host: host,
                existing: existing,
                presentedType: presentedType,
                presentedFingerprint: presentedFp
            )
        }
    }

    private func authenticateAndComplete(host: SshHost, keyEntry: KnownHostKey, firstTimeTrusted: Bool) {
        if host.auth == .password || host.auth == .keyAndPassword {
            if let savedPassword = store.secureStore.loadHostPassword(forHostId: host.id), !savedPassword.isEmpty {
                terminalBuffer.feed("Authenticating with preset Keychain password for \(host.username)...\r\n")
                terminalBuffer.feed("\u{1B}[38;5;42mPassword accepted.\u{1B}[0m\r\n")
                completeHandshake(host: host, keyEntry: keyEntry, firstTimeTrusted: firstTimeTrusted)
            } else {
                let cancelAction = DesktopAlertAction(title: "Cancel", style: .cancel) { [weak self] _ in
                    guard let self else { return }
                    self.store.sshStates[self.tabItem.id] = .disconnected
                    self.terminalBuffer.feed("Password authentication cancelled.\r\n")
                    self.renderTerminal()
                    self.refreshToolbarState()
                }
                let connectAction = DesktopAlertAction(title: "Connect", style: .default) { [weak self] enteredPassword in
                    guard let self else { return }
                    guard let pass = enteredPassword, !pass.isEmpty else {
                        self.store.sshStates[self.tabItem.id] = .disconnected
                        self.terminalBuffer.feed("Password cannot be empty.\r\n")
                        self.renderTerminal()
                        self.refreshToolbarState()
                        return
                    }
                    if host.rememberPassword == true {
                        self.store.secureStore.saveHostPassword(pass, forHostId: host.id)
                    }
                    self.terminalBuffer.feed("Authenticating for \(host.username)...\r\n")
                    self.terminalBuffer.feed("\u{1B}[38;5;42mPassword accepted.\u{1B}[0m\r\n")
                    self.completeHandshake(host: host, keyEntry: keyEntry, firstTimeTrusted: firstTimeTrusted)
                }
                showDesktopAlert(
                    title: "SSH Password Required",
                    message: "Enter password for \(host.username)@\(host.host):",
                    actions: [connectAction, cancelAction],
                    textFieldPlaceholder: "Password",
                    textFieldDefaultText: nil,
                    isSecureTextEntry: true
                )
            }
        } else {
            terminalBuffer.feed("Authenticating with SSH Key (\(host.keyId ?? "default"))...\r\n")
            terminalBuffer.feed("\u{1B}[38;5;42mPublic key authentication accepted.\u{1B}[0m\r\n")
            completeHandshake(host: host, keyEntry: keyEntry, firstTimeTrusted: firstTimeTrusted)
        }
    }

    private func presentChangedKeyWarning(
        host: SshHost,
        existing: KnownHostKey,
        presentedType: String,
        presentedFingerprint: String
    ) {
        let msg = """
        WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED!

        Someone could be eavesdropping on you right now (man-in-the-middle attack), or the host key was rotated on \(host.host):\(host.port).

        Expected (\(existing.keyType)):
        \(existing.sha256Fingerprint)

        Presented (\(presentedType)):
        \(presentedFingerprint)
        """
        let cancelAction = DesktopAlertAction(title: "Cancel Connection", style: .cancel) { [weak self] _ in
            guard let self else { return }
            self.store.sshStates[self.tabItem.id] = .error("Host key mismatch")
            self.terminalBuffer.feed("\u{1B}[38;5;196;1m[SECURITY] Connection aborted: remote host key did not match known_hosts.\u{1B}[0m\r\n")
            self.renderTerminal()
            self.refreshToolbarState()
        }
        let replaceAction = DesktopAlertAction(title: "Replace Stored Key & Connect", style: .destructive) { [weak self] _ in
            guard let self else { return }
            let updated = KnownHostKey(
                host: host.host,
                port: host.port,
                keyType: presentedType,
                sha256Fingerprint: presentedFingerprint
            )
            self.store.secureStore.trustHostKey(updated)
            self.authenticateAndComplete(host: host, keyEntry: updated, firstTimeTrusted: true)
        }
        showDesktopAlert(
            title: "⚠️ Host Key Mismatch",
            message: msg,
            actions: [cancelAction, replaceAction]
        )
    }

    private func simulateChangedHostKeyWarning() {
        guard let host = currentHost else { return }
        let existing = KnownHostKey(
            host: host.host,
            port: host.port,
            keyType: "ssh-ed25519",
            sha256Fingerprint: "SHA256:OLD_TRUSTED_FINGERPRINT_1111"
        )
        store.secureStore.trustHostKey(existing)
        presentChangedKeyWarning(
            host: host,
            existing: existing,
            presentedType: "ssh-ed25519",
            presentedFingerprint: "SHA256:ROTATED_OR_MITM_KEY_9999"
        )
    }

    private func completeHandshake(host: SshHost, keyEntry: KnownHostKey, firstTimeTrusted: Bool) {
        store.sshStates[tabItem.id] = .connected
        store.tree = PaneTreeOps.updateTab(store.tree, paneId: paneId, tabId: tabItem.id) { t in
            t.hostId = host.id
            t.title = "SSH: \(host.displayTitle)"
            self.tabItem = t
        }
        currentDirectory = "/home/\(host.username)"
        initVirtualFilesystem()

        if firstTimeTrusted {
            terminalBuffer.feed("\u{1B}[38;5;42mTrusted & saved host key \(keyEntry.sha256Fingerprint) for \(host.host):\(host.port)\u{1B}[0m\r\n")
        } else {
            terminalBuffer.feed("\u{1B}[38;5;42mVerified known_hosts key \(keyEntry.sha256Fingerprint)\u{1B}[0m\r\n")
        }
        terminalBuffer.feed("Allocated PTY: TERM=xterm-256color (\(terminalBuffer.cols)×\(terminalBuffer.rows))\r\n")
        terminalBuffer.feed("Welcome to Ubuntu 24.04 LTS (GNU/Linux 6.8.0-45-generic x86_64)\r\n\r\n")
        terminalBuffer.feed(" * Documentation:  https://help.ubuntu.com\r\n")
        terminalBuffer.feed(" * Management:     https://landscape.canonical.com\r\n\r\n")
        terminalBuffer.feed("Connected to \(host.connectionString).\r\n")
        activeInputLine = ""
        renderTerminal(scrollToBottom: true)
        refreshToolbarState()
    }

    private func disconnectSession(reason: String) {
        store.sshStates[tabItem.id] = .disconnected
        terminalBuffer.feed("\r\n\u{1B}[38;5;214m[\(reason)] Connection to \(currentHost?.connectionString ?? "host") closed.\u{1B}[0m\r\n")
        activeInputLine = ""
        renderTerminal(scrollToBottom: true)
        refreshToolbarState()
    }

    @objc private func decreaseFontTapped() {
        store.settings.terminalFontSizePt = max(
            TetherConstants.minTerminalFontSize,
            store.settings.terminalFontSizePt - 1
        )
    }

    @objc private func increaseFontTapped() {
        store.settings.terminalFontSizePt = min(
            TetherConstants.maxTerminalFontSize,
            store.settings.terminalFontSizePt + 1
        )
    }

    @objc private func clearScrollbackTapped() {
        terminalBuffer.clearScrollback()
        activeInputLine = ""
        renderTerminal(scrollToBottom: true)
    }

    @objc private func pasteFromClipboardTapped() {
        let clip = UIPasteboard.general.string ?? ""
        guard !clip.isEmpty else { return }
        handlePasteText(clip)
    }

    public func handlePasteText(_ text: String) {
        if PaneTreeOps.isMultiLinePaste(text) {
            let lines = text.components(separatedBy: .newlines)
            let preview = lines.prefix(6).joined(separator: "\n")
            let cancelAction = DesktopAlertAction(title: "Cancel", style: .cancel)
            let pasteAction = DesktopAlertAction(title: "Paste \(lines.count) Lines", style: .destructive) { [weak self] _ in
                guard let self else { return }
                for line in lines where !line.isEmpty {
                    self.executeTerminalLine(line)
                }
            }
            showDesktopAlert(
                title: "Confirm Multi-Line Paste",
                message: "You are about to paste \(lines.count) lines into the SSH terminal:\n\n\(preview)",
                actions: [pasteAction, cancelAction]
            )
        } else {
            activeInputLine += text
            renderTerminal()
        }
    }

    // MARK: - Desktop Shell & Command Execution

    private func initVirtualFilesystem() {
        let user = currentHost?.username ?? "user"
        let home = "/home/\(user)"
        let projectsDir = "\(home)/projects"
        let tetherDir = "\(projectsDir)/tether"

        virtualFiles[home] = [
            ".bashrc": "# ~/.bashrc: executed by bash(1) for non-login shells.\nexport PS1='\\u@\\h:\\w\\$ '\nalias ll='ls -la'\nalias grep='grep --color=auto'\nexport TERM=xterm-256color\n",
            ".profile": "# ~/.profile: executed by Bourne-compatible login shells.\nexport PATH=\"$HOME/bin:$HOME/.local/bin:$PATH\"\n",
            "config.json": "{\n  \"server\": {\n    \"name\": \"tether-node-1\",\n    \"port\": 8080,\n    \"host\": \"0.0.0.0\",\n    \"environment\": \"production\"\n  },\n  \"database\": {\n    \"ssl\": true,\n    \"pool\": 10\n  }\n}",
            "deploy.sh": "#!/bin/bash\nset -e\necho '==> Pulling latest changes from main...'\necho '==> Building production assets...'\necho '==> Service active on port 8080 (healthy)'\n",
            "server.log": "2026-10-27 20:40:02 [INFO] HTTP GET /api/v1/health HTTP/1.1 200 OK (2.4ms)\n2026-10-27 20:41:15 [INFO] HTTP POST /api/v1/sync HTTP/1.1 200 OK (18.1ms)\n2026-10-27 20:45:30 [INFO] Cluster healthy: 4 nodes active\n",
            "projects": "[DIR]"
        ]

        virtualFiles[projectsDir] = [
            "tether": "[DIR]",
            "api": "[DIR]",
            "notes.txt": "Tether multi-workspace tiling manager for iPad/iPhone external displays.\n"
        ]

        virtualFiles[tetherDir] = [
            "package.json": "{\n  \"name\": \"@tether/app\",\n  \"version\": \"0.1.13\",\n  \"private\": true\n}",
            "README.md": "# Tether Workspace\nNative tiling split-pane desktop workspace.\n"
        ]
    }

    private func executeTerminalLine(_ cmd: String) {
        let trimmed = cmd.trimmingCharacters(in: .whitespaces)
        if !trimmed.isEmpty {
            commandHistory.append(trimmed)
            historyIndex = -1
        }

        // Commit command prompt & line to terminal buffer
        terminalBuffer.feed("\(shellPromptString)\(cmd)\r\n")

        if !isTerminalConnected {
            if trimmed == "connect" || trimmed.isEmpty {
                if let host = currentHost {
                    initiateConnection(host: host)
                    return
                }
            }
            terminalBuffer.feed("\u{1B}[38;5;203mNot connected. Click 'Connect' in the toolbar to open an SSH session.\u{1B}[0m\r\n")
            renderTerminal()
            return
        }

        guard !trimmed.isEmpty else {
            renderTerminal()
            return
        }

        let parts = trimmed.components(separatedBy: " ").filter { !$0.isEmpty }
        let command = parts[0]
        let args = Array(parts.dropFirst())

        switch command {
        case "clear":
            terminalBuffer.clearScrollback()
            renderTerminal(scrollToBottom: true)
            return

        case "exit", "logout":
            disconnectSession(reason: "Remote shell exited")
            return

        case "pwd":
            terminalBuffer.feed("\(currentDirectory)\r\n")

        case "whoami":
            terminalBuffer.feed("\(currentHost?.username ?? "user")\r\n")

        case "hostname":
            terminalBuffer.feed("\(currentHost?.host ?? "devbox")\r\n")

        case "id":
            let u = currentHost?.username ?? "user"
            terminalBuffer.feed("uid=1000(\(u)) gid=1000(\(u)) groups=1000(\(u)),4(adm),24(cdrom),27(sudo),30(dip),46(plugdev),110(lxd)\r\n")

        case "uname":
            if args.contains("-a") {
                let h = currentHost?.host ?? "devbox"
                terminalBuffer.feed("Linux \(h) 6.8.0-45-generic #45-Ubuntu SMP PREEMPT_DYNAMIC Sun Oct 20 18:00:00 UTC 2026 x86_64 GNU/Linux\r\n")
            } else {
                terminalBuffer.feed("Linux\r\n")
            }

        case "date":
            let formatter = DateFormatter()
            formatter.dateFormat = "EEE MMM d HH:mm:ss z yyyy"
            terminalBuffer.feed("\(formatter.string(from: Date()))\r\n")

        case "uptime":
            let formatter = DateFormatter()
            formatter.dateFormat = "HH:mm:ss"
            terminalBuffer.feed(" \(formatter.string(from: Date())) up 42 days,  3:14,  2 users,  load average: 0.14, 0.09, 0.06\r\n")

        case "echo":
            let out = args.joined(separator: " ")
                .replacingOccurrences(of: "$USER", with: currentHost?.username ?? "user")
                .replacingOccurrences(of: "$HOME", with: "/home/\(currentHost?.username ?? "user")")
                .replacingOccurrences(of: "$PWD", with: currentDirectory)
                .replacingOccurrences(of: "$SHELL", with: "/bin/bash")
            terminalBuffer.feed("\(out)\r\n")

        case "cd":
            let target = args.first ?? "~"
            let user = currentHost?.username ?? "user"
            let home = "/home/\(user)"
            if target == "~" || target.isEmpty {
                currentDirectory = home
            } else if target == ".." {
                let comps = currentDirectory.split(separator: "/").map(String.init)
                if comps.count > 1 {
                    currentDirectory = "/" + comps.dropLast().joined(separator: "/")
                }
            } else if target.hasPrefix("/") {
                if virtualFiles[target] != nil {
                    currentDirectory = target
                } else {
                    terminalBuffer.feed("bash: cd: \(target): No such file or directory\r\n")
                }
            } else {
                let next = (currentDirectory == "/") ? "/\(target)" : "\(currentDirectory)/\(target)"
                if virtualFiles[next] != nil {
                    currentDirectory = next
                } else if let files = virtualFiles[currentDirectory], files[target] == "[DIR]" {
                    currentDirectory = next
                } else {
                    terminalBuffer.feed("bash: cd: \(target): No such file or directory\r\n")
                }
            }

        case "ls", "ll", "dir":
            executeLs(args: args, isDetailed: (command == "ll" || args.contains("-l") || args.contains("-la") || args.contains("-al")))

        case "cat":
            guard let filename = args.first else {
                terminalBuffer.feed("cat: missing file operand\r\n")
                break
            }
            if let files = virtualFiles[currentDirectory], let content = files[filename] {
                if content == "[DIR]" {
                    terminalBuffer.feed("cat: \(filename): Is a directory\r\n")
                } else {
                    let formatted = content.replacingOccurrences(of: "\n", with: "\r\n")
                    terminalBuffer.feed("\(formatted)\r\n")
                }
            } else {
                terminalBuffer.feed("cat: \(filename): No such file or directory\r\n")
            }

        case "mkdir":
            guard let dirName = args.first else {
                terminalBuffer.feed("mkdir: missing operand\r\n")
                break
            }
            var dir = virtualFiles[currentDirectory] ?? [:]
            dir[dirName] = "[DIR]"
            virtualFiles[currentDirectory] = dir
            let newPath = (currentDirectory == "/") ? "/\(dirName)" : "\(currentDirectory)/\(dirName)"
            virtualFiles[newPath] = [:]

        case "touch":
            guard let fileName = args.first else {
                terminalBuffer.feed("touch: missing file operand\r\n")
                break
            }
            var dir = virtualFiles[currentDirectory] ?? [:]
            if dir[fileName] == nil {
                dir[fileName] = ""
                virtualFiles[currentDirectory] = dir
            }

        case "rm":
            guard let fileName = args.first else {
                terminalBuffer.feed("rm: missing operand\r\n")
                break
            }
            var dir = virtualFiles[currentDirectory] ?? [:]
            dir.removeValue(forKey: fileName)
            virtualFiles[currentDirectory] = dir

        case "ps":
            terminalBuffer.feed("    PID TTY          TIME CMD\r\n")
            terminalBuffer.feed("    924 pts/0    00:00:00 bash\r\n")
            terminalBuffer.feed("   1048 pts/0    00:00:02 node\r\n")
            terminalBuffer.feed("   1210 pts/0    00:00:00 ps\r\n")

        case "free":
            terminalBuffer.feed("               total        used        free      shared  buff/cache   available\r\n")
            terminalBuffer.feed("Mem:           7.8Gi       1.4Gi       4.8Gi       120Mi       1.6Gi       6.1Gi\r\n")
            terminalBuffer.feed("Swap:          2.0Gi          0B       2.0Gi\r\n")

        case "df":
            terminalBuffer.feed("Filesystem      Size  Used Avail Use% Mounted on\r\n")
            terminalBuffer.feed("/dev/root        50G   14G   34G  30% /\r\n")
            terminalBuffer.feed("tmpfs           3.9G     0  3.9G   0% /dev/shm\r\n")
            terminalBuffer.feed("/dev/nvme0n1p1  512M  6.2M  506M   2% /boot/efi\r\n")

        case "env":
            let u = currentHost?.username ?? "user"
            terminalBuffer.feed("SHELL=/bin/bash\r\nUSER=\(u)\r\nHOME=/home/\(u)\r\nTERM=xterm-256color\r\nPATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin\r\nLANG=en_US.UTF-8\r\nCOLUMNS=\(terminalBuffer.cols)\r\nLINES=\(terminalBuffer.rows)\r\n")

        case "which":
            let prog = args.first ?? ""
            switch prog {
            case "bash", "sh": terminalBuffer.feed("/bin/\(prog)\r\n")
            case "python", "python3": terminalBuffer.feed("/usr/bin/python3\r\n")
            case "node", "npm": terminalBuffer.feed("/usr/local/bin/\(prog)\r\n")
            case "git", "ssh", "curl", "vim": terminalBuffer.feed("/usr/bin/\(prog)\r\n")
            default: terminalBuffer.feed("\(prog) not found\r\n")
            }

        case "git":
            if args.first == "status" {
                terminalBuffer.feed("On branch main\r\nYour branch is up to date with 'origin/main'.\r\n\r\nnothing to commit, working tree clean\r\n")
            } else if args.first == "branch" {
                terminalBuffer.feed("* \u{1B}[32mmain\u{1B}[0m\r\n")
            } else {
                terminalBuffer.feed("git: '\(args.first ?? "")' is not a git command. See 'git --help'.\r\n")
            }

        case "help":
            terminalBuffer.feed("Tether Remote Shell Builtins & Utilities:\r\n")
            terminalBuffer.feed("  ls, cd, pwd, cat, mkdir, touch, rm, echo\r\n")
            terminalBuffer.feed("  uname, whoami, hostname, id, date, uptime\r\n")
            terminalBuffer.feed("  ps, free, df, env, which, git, ping, curl\r\n")
            terminalBuffer.feed("  clear, exit, logout, help\r\n")

        case "python", "python3":
            terminalBuffer.feed("Python 3.12.3 (main, Sep 11 2026, 14:17:34) [GCC 13.2.0] on linux\r\nType \"help\", \"copyright\", \"credits\" or \"license\" for more information.\r\n>>> \r\n")

        case "node":
            terminalBuffer.feed("Welcome to Node.js v20.18.0.\r\nType \".help\" for more information.\r\n> \r\n")

        default:
            terminalBuffer.feed("bash: \(command): command not found\r\n")
        }

        renderTerminal(scrollToBottom: true)
    }

    private func executeLs(args: [String], isDetailed: Bool) {
        let showHidden = args.contains("-a") || args.contains("-la") || args.contains("-al") || args.contains("--all")
        let dirFiles = virtualFiles[currentDirectory] ?? [:]
        let keys = dirFiles.keys.sorted { a, b in
            if a.hasPrefix(".") && !b.hasPrefix(".") { return true }
            if !a.hasPrefix(".") && b.hasPrefix(".") { return false }
            return a.lowercased() < b.lowercased()
        }

        let user = currentHost?.username ?? "user"
        if isDetailed {
            terminalBuffer.feed("total \(keys.count * 4)\r\n")
            if showHidden {
                terminalBuffer.feed("drwxr-xr-x  4 \(user) \(user) 4096 Oct 27 20:00 \u{1B}[1;34m.\u{1B}[0m\r\n")
                terminalBuffer.feed("drwxr-xr-x 18 \(user) \(user) 4096 Oct 20 09:30 \u{1B}[1;34m..\u{1B}[0m\r\n")
            }
            for key in keys {
                if key.hasPrefix(".") && !showHidden { continue }
                let isDir = dirFiles[key] == "[DIR]"
                let isExe = key.hasSuffix(".sh")
                let size = isDir ? 4096 : (dirFiles[key]?.count ?? 0)
                let perms = isDir ? "drwxr-xr-x" : (isExe ? "-rwxr-xr-x" : "-rw-r--r--")
                let coloredName: String
                if isDir {
                    coloredName = "\u{1B}[1;34m\(key)\u{1B}[0m"
                } else if isExe {
                    coloredName = "\u{1B}[1;32m\(key)\u{1B}[0m"
                } else {
                    coloredName = key
                }
                terminalBuffer.feed("\(perms)  1 \(user) \(user) \(String(format: "%5d", size)) Oct 27 20:00 \(coloredName)\r\n")
            }
        } else {
            var items: [String] = []
            for key in keys {
                if key.hasPrefix(".") && !showHidden { continue }
                let isDir = dirFiles[key] == "[DIR]"
                let isExe = key.hasSuffix(".sh")
                if isDir {
                    items.append("\u{1B}[1;34m\(key)/\u{1B}[0m")
                } else if isExe {
                    items.append("\u{1B}[1;32m\(key)*\u{1B}[0m")
                } else {
                    items.append(key)
                }
            }
            terminalBuffer.feed("\(items.joined(separator: "  "))\r\n")
        }
    }
}

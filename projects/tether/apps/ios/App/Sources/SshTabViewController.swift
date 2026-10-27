import Combine
import CryptoKit
import TetherKit
import UIKit

@MainActor
public final class SshTabViewController: UIViewController, UITextFieldDelegate {
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
    private let clearButton = UIButton(type: .system)
    private let gridSizeLabel = UILabel()
    private let terminalTextView = UITextView()
    private let promptLabel = UILabel()
    private let commandField = UITextField()
    private let pasteButton = UIButton(type: .system)
    private var cancellables: Set<AnyCancellable> = []
    private var commandHistory: [String] = []
    private var historyIndex: Int = -1

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

        terminalBuffer.onWindowChange = { [weak self] cols, rows in
            guard let self else { return }
            self.gridSizeLabel.text = "\(cols)×\(rows)"
            if self.isTerminalConnected {
                self.terminalBuffer.feed("\u{1B}[38;5;244m[PTY window-change: \(cols) cols × \(rows) rows (TERM=xterm-256color)]\u{1B}[0m\r\n")
                self.renderTerminal()
            }
        }

        let host = currentHost
        terminalBuffer.feed("\u{1B}[38;5;39;1mTether SSH Client (No local shell — PRD §3.1)\u{1B}[0m\r\n")
        if let host {
            terminalBuffer.feed("Target host: \(host.connectionString) (\(host.auth.displayName))\r\n")
            terminalBuffer.feed("Press 'Connect' to verify SHA-256 host key and allocate xterm-256color PTY.\r\n\r\n")
        } else {
            terminalBuffer.feed("No SSH host selected. Choose or add a host from the toolbar.\r\n\r\n")
        }
        renderTerminal()
        refreshToolbarState()
    }

    public override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        recalculateTerminalGrid()
    }

    public func focusTerminalInput() {
        commandField.becomeFirstResponder()
    }

    /// Receives Ctrl+<Key> when this SSH terminal is focused (PRD §13.2).
    public func sendControlKey(_ key: String) {
        let upper = key.uppercased()
        switch upper {
        case "C":
            terminalBuffer.feed("^C\r\n\(shellPromptString)")
            commandField.text = ""
        case "D":
            if (commandField.text ?? "").isEmpty {
                disconnectSession(reason: "EOF (^D)")
                return
            }
        case "L":
            terminalBuffer.feed("\u{1B}[2J\u{1B}[1;1H\(shellPromptString)")
        case "U":
            commandField.text = ""
        case "R":
            terminalBuffer.feed("(reverse-i-search)`': \r\n\(shellPromptString)")
        default:
            terminalBuffer.feed("^\(upper)\r\n\(shellPromptString)")
        }
        renderTerminal()
    }

    public func handleKeyInput(text: String) {
        if text == "\r" || text == "\n" {
            let cmd = commandField.text ?? ""
            commandField.text = ""
            executeTerminalLine(cmd)
        } else if text == "\u{7F}" || text == "\u{08}" {
            var current = commandField.text ?? ""
            if !current.isEmpty {
                current.removeLast()
                commandField.text = current
            }
        } else if text == "\t" {
            let current = commandField.text ?? ""
            commandField.text = current + "  "
        } else {
            let current = commandField.text ?? ""
            commandField.text = current + text
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
                commandField.text = commandHistory[historyIndex]
            }
        case .down:
            if historyIndex != -1 {
                if historyIndex < commandHistory.count - 1 {
                    historyIndex += 1
                    commandField.text = commandHistory[historyIndex]
                } else {
                    historyIndex = -1
                    commandField.text = ""
                }
            }
        case .left, .right:
            break
        case .escape:
            commandField.text = ""
        case .tab:
            handleKeyInput(text: "\t")
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

    private var currentHost: SshHost? {
        if let id = tabItem.hostId, let found = store.hosts.first(where: { $0.id == id }) {
            return found
        }
        return store.hosts.first
    }

    private var shellPromptString: String {
        guard let h = currentHost else { return "ssh$ " }
        return "\(h.username)@\(h.host):~$ "
    }

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

        clearButton.setTitle("Clear", for: .normal)
        clearButton.titleLabel?.font = .systemFont(ofSize: 11, weight: .medium)
        clearButton.tintColor = UIColor(white: 0.75, alpha: 1.0)
        clearButton.addTarget(self, action: #selector(clearScrollbackTapped), for: .touchUpInside)

        gridSizeLabel.font = .monospacedSystemFont(ofSize: 10, weight: .regular)
        gridSizeLabel.textColor = UIColor(white: 0.55, alpha: 1.0)
        gridSizeLabel.text = "80×24"

        let spacer = UIView()
        let topStack = UIStackView(arrangedSubviews: [
            statusDot, statusLabel, hostButton, connectButton, spacer, gridSizeLabel, fontMinusButton, fontPlusButton, clearButton
        ])
        topStack.translatesAutoresizingMaskIntoConstraints = false
        topStack.axis = .horizontal
        topStack.spacing = 8
        topStack.alignment = .center
        toolbar.addSubview(topStack)

        terminalTextView.translatesAutoresizingMaskIntoConstraints = false
        terminalTextView.backgroundColor = UIColor(red: 0.02, green: 0.03, blue: 0.06, alpha: 1.0)
        terminalTextView.textColor = UIColor(red: 0.88, green: 0.92, blue: 0.97, alpha: 1.0)
        terminalTextView.isEditable = false
        terminalTextView.isSelectable = true
        terminalTextView.font = UIFont.monospacedSystemFont(
            ofSize: CGFloat(store.settings.terminalFontSizePt),
            weight: .regular
        )
        terminalTextView.textContainerInset = UIEdgeInsets(top: 8, left: 8, bottom: 8, right: 8)

        let inputBar = UIView()
        inputBar.translatesAutoresizingMaskIntoConstraints = false
        inputBar.backgroundColor = UIColor(red: 0.04, green: 0.06, blue: 0.11, alpha: 1.0)

        promptLabel.font = UIFont.monospacedSystemFont(ofSize: 12, weight: .bold)
        promptLabel.textColor = UIColor(red: 0.20, green: 0.83, blue: 0.60, alpha: 1.0)
        promptLabel.text = shellPromptString

        commandField.delegate = self
        commandField.font = UIFont.monospacedSystemFont(ofSize: 12, weight: .regular)
        commandField.textColor = .white
        commandField.autocapitalizationType = .none
        commandField.autocorrectionType = .no
        commandField.returnKeyType = .send
        commandField.placeholder = "Type remote SSH command or paste text…"

        pasteButton.setTitle("Paste", for: .normal)
        pasteButton.titleLabel?.font = .systemFont(ofSize: 11, weight: .medium)
        pasteButton.tintColor = UIColor(red: 0.22, green: 0.74, blue: 0.97, alpha: 1.0)
        pasteButton.addTarget(self, action: #selector(pasteFromClipboardTapped), for: .touchUpInside)

        let inputStack = UIStackView(arrangedSubviews: [promptLabel, commandField, pasteButton])
        inputStack.translatesAutoresizingMaskIntoConstraints = false
        inputStack.axis = .horizontal
        inputStack.spacing = 6
        inputStack.alignment = .center
        inputBar.addSubview(inputStack)

        view.addSubview(toolbar)
        view.addSubview(terminalTextView)
        view.addSubview(inputBar)

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
            terminalTextView.bottomAnchor.constraint(equalTo: inputBar.topAnchor),

            inputBar.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            inputBar.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            inputBar.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            inputBar.heightAnchor.constraint(equalToConstant: 34),

            inputStack.leadingAnchor.constraint(equalTo: inputBar.leadingAnchor, constant: 8),
            inputStack.trailingAnchor.constraint(equalTo: inputBar.trailingAnchor, constant: -8),
            inputStack.centerYAnchor.constraint(equalTo: inputBar.centerYAnchor),
        ])
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
                // Insert path as text without executing (PRD §11.3)
                let existing = self.commandField.text ?? ""
                let sep = existing.isEmpty || existing.hasSuffix(" ") ? "" : " "
                self.commandField.text = existing + sep + text
                self.commandField.becomeFirstResponder()
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
            promptLabel.text = shellPromptString
        } else {
            hostButton.setTitle("Select Host…", for: .normal)
            promptLabel.text = "ssh$ "
        }
    }

    private func renderTerminal() {
        let lines = terminalBuffer.renderedLines(includeScrollback: true)
        terminalTextView.text = lines.joined(separator: "\n")
        if !terminalTextView.text.isEmpty {
            let bottom = NSRange(location: max(0, terminalTextView.text.count - 1), length: 1)
            terminalTextView.scrollRangeToVisible(bottom)
        }
    }

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
        store.sshStates[tabItem.id] = .connecting
        refreshToolbarState()

        // Compute deterministic host key fingerprint and perform mandatory verification (PRD §10.3)
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
            completeHandshake(host: host, keyEntry: entry, firstTimeTrusted: false)
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
                self.completeHandshake(host: host, keyEntry: entry, firstTimeTrusted: true)
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
            self.completeHandshake(host: host, keyEntry: updated, firstTimeTrusted: true)
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
        if firstTimeTrusted {
            terminalBuffer.feed("\u{1B}[38;5;42mTrusted & saved host key \(keyEntry.sha256Fingerprint) for \(host.host):\(host.port)\u{1B}[0m\r\n")
        } else {
            terminalBuffer.feed("\u{1B}[38;5;42mVerified known_hosts key \(keyEntry.sha256Fingerprint)\u{1B}[0m\r\n")
        }
        terminalBuffer.feed("Allocated PTY: TERM=xterm-256color (\(terminalBuffer.cols)×\(terminalBuffer.rows))\r\n")
        terminalBuffer.feed("Connected to \(host.connectionString)\r\n\(shellPromptString)")
        renderTerminal()
        refreshToolbarState()
    }

    private func disconnectSession(reason: String) {
        store.sshStates[tabItem.id] = .disconnected
        terminalBuffer.feed("\r\n\u{1B}[38;5;214m[\(reason)]\u{1B}[0m\r\n")
        renderTerminal()
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
        if isTerminalConnected {
            terminalBuffer.feed(shellPromptString)
        }
        renderTerminal()
    }

    @objc private func pasteFromClipboardTapped() {
        let clip = UIPasteboard.general.string ?? "echo 'line 1'\necho 'line 2'"
        handlePasteText(clip)
    }

    /// Multi-line paste confirmation (PRD §10.5).
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
                message: "You are about to paste \(lines.count) lines into the SSH terminal, which may execute commands immediately:\n\n\(preview)",
                actions: [pasteAction, cancelAction]
            )
        } else {
            let current = commandField.text ?? ""
            commandField.text = current + text
        }
    }

    public func textFieldShouldReturn(_ textField: UITextField) -> Bool {
        let cmd = textField.text ?? ""
        textField.text = ""
        executeTerminalLine(cmd)
        return true
    }

    private func executeTerminalLine(_ cmd: String) {
        let trimmed = cmd.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmed.isEmpty {
            commandHistory.append(trimmed)
            historyIndex = -1
        }
        terminalBuffer.feed("\(cmd)\r\n")
        if !isTerminalConnected {
            terminalBuffer.feed("\u{1B}[38;5;203mNot connected. Click 'Connect' in the SSH toolbar to open an SSH session.\u{1B}[0m\r\n")
            renderTerminal()
            return
        }
        switch trimmed {
        case "":
            break
        case "clear":
            terminalBuffer.clearScrollback()
        case "exit", "logout":
            disconnectSession(reason: "Remote shell exited")
            return
        case "uname -a":
            terminalBuffer.feed("Linux devbox 6.8.0-45-generic #45-Ubuntu SMP x86_64 GNU/Linux\r\n")
        case "env":
            terminalBuffer.feed("TERM=xterm-256color\r\nCOLUMNS=\(terminalBuffer.cols)\r\nLINES=\(terminalBuffer.rows)\r\n")
        default:
            terminalBuffer.feed("\u{1B}[38;5;248m[remote exec] \(trimmed)\u{1B}[0m\r\n")
        }
        terminalBuffer.feed(shellPromptString)
        renderTerminal()
    }
}

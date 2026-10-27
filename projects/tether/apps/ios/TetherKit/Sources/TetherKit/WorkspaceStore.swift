import Foundation

// MARK: - File Entry & SFTP / Local File Operations (PRD §11)

public struct FileItem: Codable, Hashable, Sendable, Identifiable {
    public var id: String { path }
    public var name: String
    public var path: String
    public var isDirectory: Bool
    public var sizeBytes: Int64
    public var modifiedAt: Date

    public init(
        name: String,
        path: String,
        isDirectory: Bool,
        sizeBytes: Int64 = 0,
        modifiedAt: Date = Date()
    ) {
        self.name = name
        self.path = path
        self.isDirectory = isDirectory
        self.sizeBytes = sizeBytes
        self.modifiedAt = modifiedAt
    }

    public var isTextOrHtmlPreviewable: Bool {
        guard !isDirectory else { return false }
        let ext = (name as NSString).pathExtension.lowercased()
        let allowed: Set<String> = [
            "txt", "md", "markdown", "json", "yaml", "yml", "toml", "xml",
            "html", "htm", "css", "js", "ts", "tsx", "jsx", "py", "sh", "zsh",
            "bash", "swift", "kt", "kts", "rs", "go", "c", "h", "cpp", "sql",
            "log", "conf", "ini", "env"
        ]
        return allowed.contains(ext)
    }
}

public enum FileBrowserSort {
    /// Directories first, then files, alphabetical case-insensitive (PRD §11.2).
    public static func sort(_ items: [FileItem]) -> [FileItem] {
        items.sorted { a, b in
            if a.isDirectory != b.isDirectory {
                return a.isDirectory && !b.isDirectory
            }
            return a.name.localizedCaseInsensitiveCompare(b.name) == .orderedAscending
        }
    }

    /// Paginates directory listings with >500 entries into chunks so UI stays responsive (PRD §11.2).
    public static func chunk(_ items: [FileItem], page: Int, pageSize: Int = 500) -> (slice: [FileItem], totalCount: Int, hasMore: Bool) {
        let sorted = sort(items)
        let limit = max(1, (page + 1) * pageSize)
        let slice = Array(sorted.prefix(limit))
        return (slice: slice, totalCount: sorted.count, hasMore: sorted.count > slice.count)
    }

    /// Quotes a file path safely for shell insertion without trailing newline (PRD §11.3).
    public static func shellQuotedPath(_ path: String) -> String {
        if path.range(of: #"^[A-Za-z0-9_./-]+$"#, options: .regularExpression) != nil {
            return path
        }
        let escaped = path.replacingOccurrences(of: "'", with: "'\\''")
        return "'\(escaped)'"
    }
}

// MARK: - SSH Connection State & Transport Protocol (PRD §10)

public enum SshConnectionState: Equatable, Sendable {
    case disconnected
    case connecting
    case connected
    case error(String)

    public var badgeText: String {
        switch self {
        case .disconnected: return "Disconnected"
        case .connecting: return "Connecting…"
        case .connected: return "Connected"
        case .error(let msg): return "Error: \(msg)"
        }
    }
}

public struct TransferProgress: Equatable, Sendable {
    public var id: UUID
    public var fileName: String
    public var transferredBytes: Int64
    public var totalBytes: Int64
    public var isUpload: Bool

    public var fractionCompleted: Double {
        guard totalBytes > 0 else { return 0 }
        return min(1.0, max(0.0, Double(transferredBytes) / Double(totalBytes)))
    }

    public init(id: UUID = UUID(), fileName: String, transferredBytes: Int64, totalBytes: Int64, isUpload: Bool) {
        self.id = id
        self.fileName = fileName
        self.transferredBytes = transferredBytes
        self.totalBytes = totalBytes
        self.isUpload = isUpload
    }
}

// MARK: - Workspace Store (Persistence + Normative State)

@MainActor
public final class WorkspaceStore: ObservableObject {
    @Published public var tree: PaneTree {
        didSet { scheduleSave() }
    }
    @Published public var settings: TetherSettings {
        didSet { scheduleSave() }
    }
    @Published public var hosts: [SshHost] {
        didSet { scheduleSave() }
    }
    @Published public var bookmarks: [Bookmark] {
        didSet { scheduleSave() }
    }

    /// Active SSH session state per tab ID.
    @Published public var sshStates: [String: SshConnectionState] = [:]

    /// Tabs that were connected prior to display disconnect or app backgrounding.
    @Published public var pausedSshTabs: Set<String> = []

    /// Pending text to insert into a terminal tab (without executing).
    @Published public var pendingTerminalInsert: [String: String] = [:]

    /// External monitor state managed by `DisplayHost` (PRD §4, §12).
    @Published public var isExternalDisplayConnected: Bool = false
    @Published public var externalDisplayDescription: String = "Built-in Screen (Mirror Ready)"

    public let secureStore: SecureStore
    public let backend: Backend
    private let storageURL: URL
    private var saveTask: Task<Void, Never>?

    public init(
        storageURL: URL? = nil,
        secureStore: SecureStore = SecureStore(),
        backend: Backend? = nil
    ) {
        self.secureStore = secureStore
        let defaultConfig: BackendConfig = {
            #if DEBUG
            if ProcessInfo.processInfo.arguments.contains("-production") {
                return .production
            }
            return .local
            #else
            return .production
            #endif
        }()
        let resolvedBackend = backend ?? Backend(config: defaultConfig, session: secureStore.loadSession())
        resolvedBackend.onSessionChange = { [weak secureStore] session in
            secureStore?.saveSession(session)
        }
        self.backend = resolvedBackend

        if let storageURL {
            self.storageURL = storageURL
        } else {
            let appSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
            let dir = appSupport.appendingPathComponent("Tether", isDirectory: true)
            try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
            self.storageURL = dir.appendingPathComponent("workspace.json")
        }

        if let data = try? Data(contentsOf: self.storageURL),
           let decoded = try? JSONDecoder().decode(WorkspaceSnapshot.self, from: data) {
            self.tree = decoded.tree
            self.settings = decoded.settings
            self.hosts = decoded.hosts
            self.bookmarks = decoded.bookmarks
        } else {
            self.tree = PaneTreeOps.createDefaultPaneTree()
            self.settings = TetherSettings()
            self.hosts = [
                SshHost(
                    id: "host-sample-1",
                    label: "Dev Box",
                    host: "example.invalid",
                    port: 22,
                    username: "dev",
                    auth: .key,
                    rememberPassword: false,
                    autoReconnectOnDisplayReconnect: false
                )
            ]
            self.bookmarks = [
                Bookmark(id: "bm-1", title: "Example Domain", url: "https://example.com")
            ]
            saveImmediately()
        }
    }

    public func saveImmediately() {
        let snapshot = WorkspaceSnapshot(
            tree: tree,
            settings: settings,
            hosts: hosts,
            bookmarks: bookmarks
        )
        guard let data = try? JSONEncoder().encode(snapshot) else { return }
        if let jsonObj = try? JSONSerialization.jsonObject(with: data),
           PaneTreeOps.findForbiddenSecretPath(in: jsonObj) != nil {
            // Never write secrets to disk (PRD §14)
            return
        }
        try? data.write(to: storageURL, options: .atomic)
    }

    private func scheduleSave() {
        saveTask?.cancel()
        saveTask = Task { @MainActor [weak self] in
            try? await Task.sleep(nanoseconds: 150_000_000)
            guard !Task.isCancelled else { return }
            self?.saveImmediately()
        }
    }

    // MARK: - Normative Actions

    public var panes: [PaneNode] {
        PaneTreeOps.collectPanes(tree.root)
    }

    public var focusedPane: PaneNode? {
        PaneTreeOps.findPane(tree.root, paneId: tree.focusedPaneId) ?? panes.first
    }

    public func splitFocusedPane(_ direction: SplitDirection, tabType: TabType = .web) {
        let tab = PaneTreeOps.createDefaultTab(type: tabType, hosts: hosts)
        tree = PaneTreeOps.splitPane(tree, direction: direction, initialTab: tab)
    }

    public func closePane(_ paneId: String? = nil) {
        tree = PaneTreeOps.closePane(tree, paneId: paneId)
    }

    public func focusPane(_ paneId: String) {
        tree = PaneTreeOps.focusPane(tree, paneId: paneId)
    }

    public func focusDirectional(_ direction: FocusDirection) {
        tree = PaneTreeOps.focusDirectional(tree, direction: direction)
    }

    public func swapFocusedWithNext() {
        tree = PaneTreeOps.swapFocusedWithNext(tree)
    }

    public func toggleMaximiseFocusedPane() {
        tree = PaneTreeOps.toggleMaximiseFocusedPane(tree)
    }

    public func applyPreset(_ preset: LayoutPresetId) {
        tree = PaneTreeOps.applyLayoutPreset(tree, preset: preset, hosts: hosts)
        settings.defaultLayoutPreset = preset
    }

    public func openTab(type: TabType, inPaneId: String? = nil, url: String? = nil, hostId: String? = nil, path: String? = nil) {
        var tab = PaneTreeOps.createDefaultTab(type: type, hosts: hosts)
        if let url { tab.url = url }
        if let hostId { tab.hostId = hostId }
        if let path { tab.path = path }
        tab.title = PaneTreeOps.computeTabTitle(tab: tab, hosts: hosts)
        tree = PaneTreeOps.openTab(tree, tab: tab, inPaneId: inPaneId)
    }

    public func closeTab(paneId: String? = nil, tabId: String? = nil) {
        tree = PaneTreeOps.closeTab(tree, paneId: paneId, tabId: tabId)
    }

    /// Inserts a shell-escaped file path into the focused (or first active) SSH terminal tab without executing (PRD §11.3).
    @discardableResult
    public func insertPathIntoTerminal(_ path: String) -> String? {
        let quoted = FileBrowserSort.shellQuotedPath(path)
        let allPanes = panes
        if let focused = focusedPane,
           let active = focused.activeTab,
           active.type == .ssh {
            pendingTerminalInsert[active.id] = quoted
            return active.id
        }
        for pane in allPanes {
            if let active = pane.activeTab, active.type == .ssh {
                tree = PaneTreeOps.focusPane(tree, paneId: pane.id)
                pendingTerminalInsert[active.id] = quoted
                return active.id
            }
            if let sshTab = pane.tabs.first(where: { $0.type == .ssh }) {
                tree = PaneTreeOps.selectTab(tree, paneId: pane.id, tabId: sshTab.id)
                pendingTerminalInsert[sshTab.id] = quoted
                return sshTab.id
            }
        }
        return nil
    }

    /// Display disconnect/reconnect lifecycle (PRD §12.1).
    public func handleExternalDisplayChanged(connected: Bool, description: String) {
        let wasConnected = isExternalDisplayConnected
        isExternalDisplayConnected = connected
        externalDisplayDescription = description

        if wasConnected && !connected {
            for (tabId, state) in sshStates where state == .connected {
                pausedSshTabs.insert(tabId)
            }
        } else if !wasConnected && connected {
            // Reconnect any tab whose host has autoReconnectOnDisplayReconnect == true
            for tabId in pausedSshTabs {
                if let tab = panes.flatMap(\.tabs).first(where: { $0.id == tabId }),
                   let hostId = tab.hostId,
                   let host = hosts.first(where: { $0.id == hostId }),
                   (host.autoReconnectOnDisplayReconnect == true || host.autoConnect == true) {
                    sshStates[tabId] = .connected
                    pausedSshTabs.remove(tabId)
                }
            }
        }
    }

    // MARK: - Cloud Sync (Non-Secret Workspace Metadata Only)

    public func syncWithCloud() async throws {
        guard backend.session != nil else { throw BackendError.notSignedIn }
        _ = try await backend.saveWorkspace(tree: tree, settings: settings)
        for host in hosts {
            _ = try await backend.saveHost(host)
        }
        for bm in bookmarks {
            _ = try await backend.saveBookmark(bm)
        }
    }

    public func pullFromCloud() async throws {
        guard backend.session != nil else { throw BackendError.notSignedIn }
        let remote = try await backend.fetchWorkspace()
        self.tree = remote.tree
        self.settings = remote.settings
        self.hosts = remote.hosts
        self.bookmarks = remote.bookmarks
        saveImmediately()
    }
}

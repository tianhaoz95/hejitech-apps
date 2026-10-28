import Foundation

// MARK: - Normative Constants (PRD §6, §7, §10, §13, §14)

public enum TetherConstants {
    public static let maxPanes = 4
    public static let minSplitRatio = 0.2
    public static let maxSplitRatio = 0.8
    public static let splitRatioStep = 0.05
    public static let minTerminalFontSize = 12
    public static let maxTerminalFontSize = 20
    public static let defaultTerminalFontSize = 14
    public static let minScrollbackLines = 10_000
    public static let defaultWebHomeURL = "about:home"
    public static let defaultSearchEngineURL = "https://duckduckgo.com/?q=%s"

    /// Control keys that MUST pass through to the focused SSH terminal PTY instead of app shortcuts (PRD §13.2).
    public static let terminalPassthroughCtrlKeys: Set<String> = [
        "C", "D", "Z", "R", "A", "E", "K", "U", "W", "L"
    ]

    /// Keys forbidden inside any persisted/synced JSON payload (PRD §14).
    public static let forbiddenSecretKeys: Set<String> = [
        "password",
        "passphrase",
        "privatekey",
        "private_key",
        "privatekeypem",
        "private_key_pem",
        "secretkey",
        "secret_key",
        "rawpassword",
        "sshpassword",
    ]
}

// MARK: - Tab & Pane Tree Models (PRD §6.1, §6.2)

public enum SplitDirection: String, Codable, Hashable, Sendable, CaseIterable {
    case horizontal
    case vertical
}

public enum SpecialKey: String, Codable, Hashable, Sendable, CaseIterable {
    case up
    case down
    case left
    case right
    case escape
    case tab
    case enter
    case backspace
    case ctrlC
    case ctrlD
    case ctrlL
    case ctrlZ
}

public enum TabType: String, Codable, Hashable, Sendable, CaseIterable {
    case web
    case ssh
    case files

    public var displayName: String {
        switch self {
        case .web: return "Browser"
        case .ssh: return "SSH Terminal"
        case .files: return "Files"
        }
    }

    public var systemImage: String {
        switch self {
        case .web: return "globe"
        case .ssh: return "terminal"
        case .files: return "folder"
        }
    }
}

public enum FilesMode: String, Codable, Hashable, Sendable, CaseIterable {
    case local
    case sftp
}

public struct Tab: Codable, Hashable, Sendable, Identifiable {
    public var id: String
    public var type: TabType
    public var title: String
    public var url: String?
    public var hostId: String?
    public var filesMode: FilesMode?
    public var path: String?

    public init(
        id: String = "tab-\(UUID().uuidString.lowercased().prefix(8))",
        type: TabType,
        title: String,
        url: String? = nil,
        hostId: String? = nil,
        filesMode: FilesMode? = nil,
        path: String? = nil
    ) {
        self.id = id
        self.type = type
        self.title = title
        self.url = url
        self.hostId = hostId
        self.filesMode = filesMode
        self.path = path
    }
}

public struct PaneNode: Codable, Hashable, Sendable, Identifiable {
    public var type: String = "pane"
    public var id: String
    public var tabs: [Tab]
    public var activeTabId: String

    public init(id: String, tabs: [Tab], activeTabId: String) {
        self.type = "pane"
        self.id = id
        self.tabs = tabs
        self.activeTabId = activeTabId
    }

    public var activeTab: Tab? {
        tabs.first(where: { $0.id == activeTabId }) ?? tabs.first
    }
}

public struct SplitNode: Codable, Hashable, Sendable, Identifiable {
    public var type: String = "split"
    public var id: String
    public var direction: SplitDirection
    public var ratio: Double
    public var first: TreeNode
    public var second: TreeNode

    public init(
        id: String,
        direction: SplitDirection,
        ratio: Double = 0.5,
        first: TreeNode,
        second: TreeNode
    ) {
        self.type = "split"
        self.id = id
        self.direction = direction
        self.ratio = PaneTreeOps.clampSplitRatio(ratio)
        self.first = first
        self.second = second
    }
}

public indirect enum TreeNode: Codable, Hashable, Sendable {
    case pane(PaneNode)
    case split(SplitNode)

    private enum CodingKeys: String, CodingKey {
        case type
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let type = try container.decode(String.self, forKey: .type)
        switch type {
        case "pane":
            self = .pane(try PaneNode(from: decoder))
        case "split":
            self = .split(try SplitNode(from: decoder))
        default:
            throw DecodingError.dataCorruptedError(
                forKey: .type,
                in: container,
                debugDescription: "Unknown TreeNode type: \(type)"
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        switch self {
        case .pane(let pane):
            try pane.encode(to: encoder)
        case .split(let split):
            try split.encode(to: encoder)
        }
    }
}

public struct PaneTree: Codable, Hashable, Sendable {
    public var version: Int = 1
    public var root: TreeNode
    public var focusedPaneId: String
    public var maximisedPaneId: String?

    public init(
        version: Int = 1,
        root: TreeNode,
        focusedPaneId: String,
        maximisedPaneId: String? = nil
    ) {
        self.version = version
        self.root = root
        self.focusedPaneId = focusedPaneId
        self.maximisedPaneId = maximisedPaneId
    }
}

// MARK: - SSH Host, Host Key & Settings Models (PRD §6.3, §6.4, §6.5)

public enum SshAuthType: String, Codable, Hashable, Sendable, CaseIterable {
    case key
    case password
    case keyAndPassword

    public var displayName: String {
        switch self {
        case .key: return "SSH Key"
        case .password: return "Password"
        case .keyAndPassword: return "Key + Password"
        }
    }
}

public struct SshHost: Codable, Hashable, Sendable, Identifiable {
    public var id: String
    public var label: String?
    public var host: String
    public var port: Int
    public var username: String
    public var auth: SshAuthType
    public var keyId: String?
    public var rememberPassword: Bool?
    public var autoReconnectOnDisplayReconnect: Bool?
    public var autoConnect: Bool?

    public init(
        id: String = "host-\(UUID().uuidString.lowercased().prefix(8))",
        label: String? = nil,
        host: String,
        port: Int = 22,
        username: String,
        auth: SshAuthType = .key,
        keyId: String? = nil,
        rememberPassword: Bool? = false,
        autoReconnectOnDisplayReconnect: Bool? = false,
        autoConnect: Bool? = false
    ) {
        self.id = id
        self.label = label
        self.host = host
        self.port = port
        self.username = username
        self.auth = auth
        self.keyId = keyId
        self.rememberPassword = rememberPassword
        self.autoReconnectOnDisplayReconnect = autoReconnectOnDisplayReconnect
        self.autoConnect = autoConnect
    }

    public var displayTitle: String {
        if let label = label?.trimmingCharacters(in: .whitespacesAndNewlines), !label.isEmpty {
            return label
        }
        return "\(username)@\(host)"
    }

    public var connectionString: String {
        "\(username)@\(host):\(port)"
    }
}

public struct KnownHostKey: Codable, Hashable, Sendable, Identifiable {
    public var id: String { "\(host):\(port)" }
    public var host: String
    public var port: Int
    public var keyType: String
    public var sha256Fingerprint: String
    public var firstSeenAt: String

    public init(
        host: String,
        port: Int,
        keyType: String,
        sha256Fingerprint: String,
        firstSeenAt: String = ISO8601DateFormatter().string(from: Date())
    ) {
        self.host = host
        self.port = port
        self.keyType = keyType
        self.sha256Fingerprint = sha256Fingerprint
        self.firstSeenAt = firstSeenAt
    }
}

public enum HostKeyVerificationStatus: Equatable, Sendable {
    case matched(KnownHostKey)
    case firstConnect(host: String, port: Int, keyType: String, sha256Fingerprint: String)
    case changedWarning(existing: KnownHostKey, presentedKeyType: String, presentedFingerprint: String)
}

public struct Bookmark: Codable, Hashable, Sendable, Identifiable {
    public var id: String
    public var title: String
    public var url: String
    public var createdAt: String

    public init(
        id: String = "bm-\(UUID().uuidString.lowercased().prefix(8))",
        title: String,
        url: String,
        createdAt: String = ISO8601DateFormatter().string(from: Date())
    ) {
        self.id = id
        self.title = title
        self.url = url
        self.createdAt = createdAt
    }
}

public enum ThemeMode: String, Codable, Hashable, Sendable, CaseIterable {
    case system
    case light
    case dark
}

public enum LayoutPresetId: String, Codable, Hashable, Sendable, CaseIterable {
    case single
    case twoColumn = "two-column"
    case leftPlusTwoRight = "left-plus-two-right"
    case twoByTwo = "two-by-two"

    public var displayName: String {
        switch self {
        case .single: return "Single Pane"
        case .twoColumn: return "Two Columns (50 / 50)"
        case .leftPlusTwoRight: return "Left + Two Stacked Right"
        case .twoByTwo: return "2×2 Grid (4 Panes)"
        }
    }
}

public enum ControllerSidebarPosition: String, Codable, Hashable, Sendable, CaseIterable {
    case left
    case right
}

public enum ControllerOrientation: String, Codable, Hashable, Sendable, CaseIterable {
    case landscape
    case landscapeFlipped = "landscape_flipped"
    case portrait
    case auto

    public var displayName: String {
        switch self {
        case .landscape: return "Landscape"
        case .landscapeFlipped: return "Landscape (Flipped)"
        case .portrait: return "Portrait (Up/Down)"
        case .auto: return "Auto-Rotate"
        }
    }
}

public enum TouchpadInputMode: String, Codable, Hashable, Sendable, CaseIterable {
    case phoneTrackpad = "phone_trackpad"
    case assistiveTouch = "assistive_touch"

    public var displayName: String {
        switch self {
        case .phoneTrackpad: return "Phone as Trackpad"
        case .assistiveTouch: return "Physical Mouse / AssistiveTouch"
        }
    }
}

public enum TouchpadDragGesture: String, Codable, Hashable, Sendable, CaseIterable {
    case doubleTapDrag = "double_tap_drag"
    case threeFingerDrag = "three_finger_drag"

    public var displayName: String {
        switch self {
        case .doubleTapDrag: return "Double-Tap Drag"
        case .threeFingerDrag: return "3-Finger Drag"
        }
    }
}

public enum TouchpadMappingMode: String, Codable, Hashable, Sendable, CaseIterable {
    case fullDisplay = "full_display"
    case relative = "relative"

    public var displayName: String {
        switch self {
        case .fullDisplay: return "Full Monitor (1:1 Absolute)"
        case .relative: return "Relative Trackpad"
        }
    }
}

public struct TetherSettings: Codable, Hashable, Sendable {
    public var version: Int = 1
    public var defaultSearchEngineUrl: String
    public var terminalFontSizePt: Int
    public var theme: ThemeMode
    public var defaultLayoutPreset: LayoutPresetId
    public var controllerSidebarPosition: ControllerSidebarPosition = .left
    public var controllerOrientation: ControllerOrientation = .landscape
    public var showTouchpadButtons: Bool = false
    public var touchpadInputMode: TouchpadInputMode = .phoneTrackpad
    public var touchpadDragGesture: TouchpadDragGesture = .doubleTapDrag
    public var touchpadMappingMode: TouchpadMappingMode = .fullDisplay
    public var pointerSensitivity: Double = 2.5
    public var edgeContinuousPush: Bool = true

    public init(
        version: Int = 1,
        defaultSearchEngineUrl: String = TetherConstants.defaultSearchEngineURL,
        terminalFontSizePt: Int = TetherConstants.defaultTerminalFontSize,
        theme: ThemeMode = .dark,
        defaultLayoutPreset: LayoutPresetId = .twoColumn,
        controllerSidebarPosition: ControllerSidebarPosition = .left,
        controllerOrientation: ControllerOrientation = .landscape,
        showTouchpadButtons: Bool = false,
        touchpadInputMode: TouchpadInputMode = .phoneTrackpad,
        touchpadDragGesture: TouchpadDragGesture = .doubleTapDrag,
        touchpadMappingMode: TouchpadMappingMode = .fullDisplay,
        pointerSensitivity: Double = 2.5,
        edgeContinuousPush: Bool = true
    ) {
        self.version = version
        self.defaultSearchEngineUrl = defaultSearchEngineUrl
        self.terminalFontSizePt = min(
            TetherConstants.maxTerminalFontSize,
            max(TetherConstants.minTerminalFontSize, terminalFontSizePt)
        )
        self.theme = theme
        self.defaultLayoutPreset = defaultLayoutPreset
        self.controllerSidebarPosition = controllerSidebarPosition
        self.controllerOrientation = controllerOrientation
        self.showTouchpadButtons = showTouchpadButtons
        self.touchpadInputMode = touchpadInputMode
        self.touchpadDragGesture = touchpadDragGesture
        self.touchpadMappingMode = touchpadMappingMode
        self.pointerSensitivity = pointerSensitivity
        self.edgeContinuousPush = edgeContinuousPush
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        version = try container.decodeIfPresent(Int.self, forKey: .version) ?? 1
        defaultSearchEngineUrl = try container.decodeIfPresent(String.self, forKey: .defaultSearchEngineUrl) ?? TetherConstants.defaultSearchEngineURL
        let fontPt = try container.decodeIfPresent(Int.self, forKey: .terminalFontSizePt) ?? TetherConstants.defaultTerminalFontSize
        terminalFontSizePt = min(TetherConstants.maxTerminalFontSize, max(TetherConstants.minTerminalFontSize, fontPt))
        theme = try container.decodeIfPresent(ThemeMode.self, forKey: .theme) ?? .dark
        defaultLayoutPreset = try container.decodeIfPresent(LayoutPresetId.self, forKey: .defaultLayoutPreset) ?? .twoColumn
        controllerSidebarPosition = try container.decodeIfPresent(ControllerSidebarPosition.self, forKey: .controllerSidebarPosition) ?? .left
        controllerOrientation = try container.decodeIfPresent(ControllerOrientation.self, forKey: .controllerOrientation) ?? .landscape
        showTouchpadButtons = try container.decodeIfPresent(Bool.self, forKey: .showTouchpadButtons) ?? false
        touchpadInputMode = try container.decodeIfPresent(TouchpadInputMode.self, forKey: .touchpadInputMode) ?? .phoneTrackpad
        touchpadDragGesture = try container.decodeIfPresent(TouchpadDragGesture.self, forKey: .touchpadDragGesture) ?? .doubleTapDrag
        touchpadMappingMode = try container.decodeIfPresent(TouchpadMappingMode.self, forKey: .touchpadMappingMode) ?? .fullDisplay
        pointerSensitivity = try container.decodeIfPresent(Double.self, forKey: .pointerSensitivity) ?? 2.5
        edgeContinuousPush = try container.decodeIfPresent(Bool.self, forKey: .edgeContinuousPush) ?? true
    }
}

public struct Workspace: Codable, Hashable, Sendable, Identifiable {
    public var id: String
    public var name: String
    public var tree: PaneTree

    public init(
        id: String = "ws-\(UUID().uuidString.lowercased().prefix(8))",
        name: String,
        tree: PaneTree
    ) {
        self.id = id
        self.name = name
        self.tree = tree
    }
}

public struct WorkspaceSnapshot: Codable, Hashable, Sendable {
    public var tree: PaneTree
    public var settings: TetherSettings
    public var hosts: [SshHost]
    public var bookmarks: [Bookmark]
    public var updatedAt: String
    public var workspaces: [Workspace]?
    public var activeWorkspaceIndex: Int?

    public init(
        tree: PaneTree,
        settings: TetherSettings,
        hosts: [SshHost],
        bookmarks: [Bookmark],
        workspaces: [Workspace]? = nil,
        activeWorkspaceIndex: Int? = nil,
        updatedAt: String = ISO8601DateFormatter().string(from: Date())
    ) {
        self.tree = tree
        self.settings = settings
        self.hosts = hosts
        self.bookmarks = bookmarks
        self.workspaces = workspaces
        self.activeWorkspaceIndex = activeWorkspaceIndex
        self.updatedAt = updatedAt
    }
}

// MARK: - Normative Pane Tree Operations (PRD §7, §8, §9, §10, §11, §14)

public enum FocusDirection: String, Sendable, CaseIterable {
    case left
    case right
    case up
    case down
}

public enum PaneTreeOps {
    public static func clampSplitRatio(_ ratio: Double) -> Double {
        guard ratio.isFinite else { return 0.5 }
        let clamped = min(TetherConstants.maxSplitRatio, max(TetherConstants.minSplitRatio, ratio))
        return (clamped * 1000).rounded() / 1000
    }

    public static func stepSplitRatio(_ ratio: Double, delta: Double) -> Double {
        clampSplitRatio(ratio + delta)
    }

    public static func createDefaultTab(
        type: TabType,
        id: String = "tab-\(UUID().uuidString.lowercased().prefix(8))",
        hosts: [SshHost] = []
    ) -> Tab {
        switch type {
        case .web:
            return Tab(id: id, type: .web, title: "New Tab", url: TetherConstants.defaultWebHomeURL)
        case .ssh:
            let defaultHost = hosts.first(where: { $0.autoConnect == true }) ?? hosts.first
            let title: String
            if let h = defaultHost {
                title = "SSH: \(h.displayTitle)"
            } else {
                title = "SSH: Not connected"
            }
            return Tab(id: id, type: .ssh, title: title, hostId: defaultHost?.id)
        case .files:
            return Tab(id: id, type: .files, title: "Files: /", filesMode: .local, path: "/")
        }
    }

    public static func computeTabTitle(tab: Tab, hosts: [SshHost] = []) -> String {
        switch tab.type {
        case .web:
            let trimmed = (tab.title).trimmingCharacters(in: .whitespacesAndNewlines)
            if !trimmed.isEmpty && trimmed != "Web" && !trimmed.hasPrefix("Web: ") {
                return "Web: \(trimmed)"
            }
            if trimmed.hasPrefix("Web: ") {
                return trimmed
            }
            if let urlStr = tab.url, let u = URL(string: urlStr), let host = u.host, !host.isEmpty {
                return "Web: \(host)"
            }
            return "Web: New Tab"
        case .ssh:
            if let hostId = tab.hostId, let host = hosts.first(where: { $0.id == hostId }) {
                return "SSH: \(host.displayTitle)"
            }
            return "SSH: Not connected"
        case .files:
            let rawPath = (tab.path ?? "/").trimmingCharacters(in: .whitespacesAndNewlines)
            if rawPath.isEmpty || rawPath == "/" {
                return "Files: /"
            }
            let parts = rawPath.split(separator: "/").map(String.init)
            return "Files: \(parts.last ?? "/")"
        }
    }

    public static func createDefaultPaneTree() -> PaneTree {
        let webTab = createDefaultTab(type: .web, id: "tab-web-1")
        let sshTab = createDefaultTab(type: .ssh, id: "tab-ssh-1")
        let leftPane = PaneNode(id: "pane-1", tabs: [webTab], activeTabId: webTab.id)
        let rightPane = PaneNode(id: "pane-2", tabs: [sshTab], activeTabId: sshTab.id)
        return PaneTree(
            version: 1,
            root: .split(
                SplitNode(
                    id: "split-root",
                    direction: .horizontal,
                    ratio: 0.5,
                    first: .pane(leftPane),
                    second: .pane(rightPane)
                )
            ),
            focusedPaneId: leftPane.id,
            maximisedPaneId: nil
        )
    }

    public static func collectPanes(_ node: TreeNode) -> [PaneNode] {
        switch node {
        case .pane(let pane):
            return [pane]
        case .split(let split):
            return collectPanes(split.first) + collectPanes(split.second)
        }
    }

    public static func countPanes(_ node: TreeNode) -> Int {
        collectPanes(node).count
    }

    public static func findPane(_ node: TreeNode, paneId: String) -> PaneNode? {
        collectPanes(node).first(where: { $0.id == paneId })
    }

    // MARK: Split & Close Pane

    public static func splitPane(
        _ tree: PaneTree,
        paneId: String? = nil,
        direction: SplitDirection,
        initialTab: Tab? = nil,
        newPaneId: String = "pane-\(UUID().uuidString.lowercased().prefix(8))",
        newSplitId: String = "split-\(UUID().uuidString.lowercased().prefix(8))"
    ) -> PaneTree {
        let targetId = paneId ?? tree.focusedPaneId
        guard countPanes(tree.root) < TetherConstants.maxPanes else {
            return tree
        }
        guard findPane(tree.root, paneId: targetId) != nil else {
            return tree
        }
        let tab = initialTab ?? createDefaultTab(type: .web)
        let createdPane = PaneNode(id: newPaneId, tabs: [tab], activeTabId: tab.id)

        func replace(_ node: TreeNode) -> TreeNode {
            switch node {
            case .pane(let p):
                if p.id == targetId {
                    return .split(
                        SplitNode(
                            id: newSplitId,
                            direction: direction,
                            ratio: 0.5,
                            first: .pane(p),
                            second: .pane(createdPane)
                        )
                    )
                }
                return node
            case .split(var s):
                s.first = replace(s.first)
                s.second = replace(s.second)
                return .split(s)
            }
        }

        return PaneTree(
            version: 1,
            root: replace(tree.root),
            focusedPaneId: createdPane.id,
            maximisedPaneId: nil
        )
    }

    public static func closePane(_ tree: PaneTree, paneId: String? = nil) -> PaneTree {
        let targetId = paneId ?? tree.focusedPaneId
        let panes = collectPanes(tree.root)
        guard panes.count > 1, let idx = panes.firstIndex(where: { $0.id == targetId }) else {
            return tree
        }

        func remove(_ node: TreeNode) -> TreeNode? {
            switch node {
            case .pane(let p):
                return p.id == targetId ? nil : node
            case .split(var s):
                let firstRes = remove(s.first)
                let secondRes = remove(s.second)
                if firstRes == nil { return secondRes }
                if secondRes == nil { return firstRes }
                s.first = firstRes!
                s.second = secondRes!
                return .split(s)
            }
        }

        guard let nextRoot = remove(tree.root) else { return tree }
        let remaining = collectPanes(nextRoot)
        let nextFocused: String
        if tree.focusedPaneId == targetId {
            let fallbackIdx = max(0, idx - 1)
            nextFocused = remaining.indices.contains(fallbackIdx) ? remaining[fallbackIdx].id : remaining[0].id
        } else if remaining.contains(where: { $0.id == tree.focusedPaneId }) {
            nextFocused = tree.focusedPaneId
        } else {
            nextFocused = remaining[0].id
        }
        let nextMax = (tree.maximisedPaneId == targetId) ? nil : tree.maximisedPaneId
        return PaneTree(version: 1, root: nextRoot, focusedPaneId: nextFocused, maximisedPaneId: nextMax)
    }

    // MARK: Focus, Swap, Maximise & Resize

    public static func focusPane(_ tree: PaneTree, paneId: String) -> PaneTree {
        guard findPane(tree.root, paneId: paneId) != nil else { return tree }
        var copy = tree
        copy.focusedPaneId = paneId
        if let maxId = copy.maximisedPaneId, maxId != paneId {
            copy.maximisedPaneId = nil
        }
        return copy
    }

    public static func focusNextPane(_ tree: PaneTree, reverse: Bool = false) -> PaneTree {
        let panes = collectPanes(tree.root)
        guard panes.count > 1 else { return tree }
        let idx = panes.firstIndex(where: { $0.id == tree.focusedPaneId }) ?? 0
        let delta = reverse ? -1 : 1
        let nextIdx = (idx + delta + panes.count) % panes.count
        return focusPane(tree, paneId: panes[nextIdx].id)
    }

    private struct NormalizedRect {
        var x: Double
        var y: Double
        var w: Double
        var h: Double
        var cx: Double { x + w / 2 }
        var cy: Double { y + h / 2 }
    }

    private static func computeRects(_ node: TreeNode, rect: NormalizedRect, into out: inout [String: NormalizedRect]) {
        switch node {
        case .pane(let p):
            out[p.id] = rect
        case .split(let s):
            if s.direction == .horizontal {
                let firstW = rect.w * s.ratio
                computeRects(s.first, rect: NormalizedRect(x: rect.x, y: rect.y, w: firstW, h: rect.h), into: &out)
                computeRects(s.second, rect: NormalizedRect(x: rect.x + firstW, y: rect.y, w: rect.w - firstW, h: rect.h), into: &out)
            } else {
                let firstH = rect.h * s.ratio
                computeRects(s.first, rect: NormalizedRect(x: rect.x, y: rect.y, w: rect.w, h: firstH), into: &out)
                computeRects(s.second, rect: NormalizedRect(x: rect.x, y: rect.y + firstH, w: rect.w, h: rect.h - firstH), into: &out)
            }
        }
    }

    public static func focusDirectional(_ tree: PaneTree, direction: FocusDirection) -> PaneTree {
        var rects: [String: NormalizedRect] = [:]
        computeRects(tree.root, rect: NormalizedRect(x: 0, y: 0, w: 1, h: 1), into: &rects)
        guard let current = rects[tree.focusedPaneId] else { return tree }

        var bestId: String?
        var bestScore = Double.infinity

        for (id, rect) in rects where id != tree.focusedPaneId {
            let dx = rect.cx - current.cx
            let dy = rect.cy - current.cy
            let isCandidate: Bool
            switch direction {
            case .left: isCandidate = dx < -0.001
            case .right: isCandidate = dx > 0.001
            case .up: isCandidate = dy < -0.001
            case .down: isCandidate = dy > 0.001
            }
            guard isCandidate else { continue }
            let primary = (direction == .left || direction == .right) ? abs(dx) : abs(dy)
            let secondary = (direction == .left || direction == .right) ? abs(dy) : abs(dx)
            let score = primary + secondary * 2.0
            if score < bestScore {
                bestScore = score
                bestId = id
            }
        }

        if let bestId {
            return focusPane(tree, paneId: bestId)
        }
        return focusNextPane(tree, reverse: direction == .left || direction == .up)
    }

    public static func swapFocusedWithNext(_ tree: PaneTree) -> PaneTree {
        let panes = collectPanes(tree.root)
        guard panes.count > 1 else { return tree }
        let idx = panes.firstIndex(where: { $0.id == tree.focusedPaneId }) ?? 0
        let nextIdx = (idx + 1) % panes.count
        let paneA = panes[idx]
        let paneB = panes[nextIdx]

        func swapNodes(_ node: TreeNode) -> TreeNode {
            switch node {
            case .pane(let p):
                if p.id == paneA.id { return .pane(paneB) }
                if p.id == paneB.id { return .pane(paneA) }
                return node
            case .split(var s):
                s.first = swapNodes(s.first)
                s.second = swapNodes(s.second)
                return .split(s)
            }
        }

        var copy = tree
        copy.root = swapNodes(tree.root)
        return copy
    }

    public static func toggleMaximiseFocusedPane(_ tree: PaneTree) -> PaneTree {
        var copy = tree
        if copy.maximisedPaneId == copy.focusedPaneId {
            copy.maximisedPaneId = nil
        } else {
            copy.maximisedPaneId = copy.focusedPaneId
        }
        return copy
    }

    public static func updateSplitRatio(_ tree: PaneTree, splitId: String, ratio: Double) -> PaneTree {
        let clamped = clampSplitRatio(ratio)
        func update(_ node: TreeNode) -> TreeNode {
            switch node {
            case .pane:
                return node
            case .split(var s):
                if s.id == splitId {
                    s.ratio = clamped
                }
                s.first = update(s.first)
                s.second = update(s.second)
                return .split(s)
            }
        }
        var copy = tree
        copy.root = update(tree.root)
        return copy
    }

    public static func adjustParentSplitRatio(_ tree: PaneTree, delta: Double) -> PaneTree {
        let targetPaneId = tree.focusedPaneId
        func containsPane(_ node: TreeNode, id: String) -> Bool {
            switch node {
            case .pane(let p): return p.id == id
            case .split(let s): return containsPane(s.first, id: id) || containsPane(s.second, id: id)
            }
        }
        func updateParent(_ node: TreeNode) -> (TreeNode, Bool) {
            switch node {
            case .pane:
                return (node, false)
            case .split(var s):
                if case .pane(let p1) = s.first, p1.id == targetPaneId {
                    s.ratio = stepSplitRatio(s.ratio, delta: delta)
                    return (.split(s), true)
                }
                if case .pane(let p2) = s.second, p2.id == targetPaneId {
                    s.ratio = stepSplitRatio(s.ratio, delta: delta)
                    return (.split(s), true)
                }
                if containsPane(s.first, id: targetPaneId) {
                    let (updatedFirst, changed) = updateParent(s.first)
                    s.first = updatedFirst
                    return (.split(s), changed)
                }
                if containsPane(s.second, id: targetPaneId) {
                    let (updatedSecond, changed) = updateParent(s.second)
                    s.second = updatedSecond
                    return (.split(s), changed)
                }
                return (.split(s), false)
            }
        }
        var copy = tree
        copy.root = updateParent(tree.root).0
        return copy
    }

    // MARK: Layout Presets (PRD §7.4 — Redistribute Tabs Without Loss)

    public static func applyLayoutPreset(
        _ tree: PaneTree,
        preset: LayoutPresetId,
        hosts: [SshHost] = []
    ) -> PaneTree {
        let existingPanes = collectPanes(tree.root)
        var allTabs: [Tab] = existingPanes.flatMap(\.tabs)
        if allTabs.isEmpty {
            allTabs = [createDefaultTab(type: .web, id: "tab-1", hosts: hosts)]
        }

        let targetCount: Int
        switch preset {
        case .single: targetCount = 1
        case .twoColumn: targetCount = 2
        case .leftPlusTwoRight: targetCount = 3
        case .twoByTwo: targetCount = 4
        }

        var buckets: [[Tab]] = Array(repeating: [], count: targetCount)
        if existingPanes.count >= targetCount {
            for i in 0..<existingPanes.count {
                let targetIdx = min(i, targetCount - 1)
                buckets[targetIdx].append(contentsOf: existingPanes[i].tabs)
            }
        } else {
            for (i, pane) in existingPanes.enumerated() {
                buckets[i] = pane.tabs
            }
            for b in existingPanes.count..<targetCount {
                if let donorIdx = buckets.indices.first(where: { buckets[$0].count > 1 }),
                   let movedTab = buckets[donorIdx].popLast() {
                    buckets[b] = [movedTab]
                } else {
                    let fallbackType: TabType = (b == 1) ? .ssh : (b == 2 ? .files : .web)
                    buckets[b] = [createDefaultTab(type: fallbackType, id: "tab-preset-\(b + 1)", hosts: hosts)]
                }
            }
        }

        let panes: [PaneNode] = buckets.enumerated().map { idx, tabs in
            let safeTabs = tabs.isEmpty ? [createDefaultTab(type: .web, id: "tab-safe-\(idx + 1)", hosts: hosts)] : tabs
            let preservedId = idx < existingPanes.count ? existingPanes[idx].id : "pane-\(idx + 1)"
            let prevActive = idx < existingPanes.count ? existingPanes[idx].activeTabId : safeTabs[0].id
            let activeId = safeTabs.contains(where: { $0.id == prevActive }) ? prevActive : safeTabs[0].id
            return PaneNode(id: preservedId, tabs: safeTabs, activeTabId: activeId)
        }

        let root: TreeNode
        switch preset {
        case .single:
            root = .pane(panes[0])
        case .twoColumn:
            root = .split(
                SplitNode(
                    id: "split-root",
                    direction: .horizontal,
                    ratio: 0.5,
                    first: .pane(panes[0]),
                    second: .pane(panes[1])
                )
            )
        case .leftPlusTwoRight:
            root = .split(
                SplitNode(
                    id: "split-root",
                    direction: .horizontal,
                    ratio: 0.5,
                    first: .pane(panes[0]),
                    second: .split(
                        SplitNode(
                            id: "split-right",
                            direction: .vertical,
                            ratio: 0.5,
                            first: .pane(panes[1]),
                            second: .pane(panes[2])
                        )
                    )
                )
            )
        case .twoByTwo:
            root = .split(
                SplitNode(
                    id: "split-root",
                    direction: .horizontal,
                    ratio: 0.5,
                    first: .split(
                        SplitNode(
                            id: "split-left",
                            direction: .vertical,
                            ratio: 0.5,
                            first: .pane(panes[0]),
                            second: .pane(panes[2])
                        )
                    ),
                    second: .split(
                        SplitNode(
                            id: "split-right",
                            direction: .vertical,
                            ratio: 0.5,
                            first: .pane(panes[1]),
                            second: .pane(panes[3])
                        )
                    )
                )
            )
        }

        let focusedId = panes.contains(where: { $0.id == tree.focusedPaneId }) ? tree.focusedPaneId : panes[0].id
        return PaneTree(version: 1, root: root, focusedPaneId: focusedId, maximisedPaneId: nil)
    }

    // MARK: Tab Operations (PRD §8)

    private static func mapPane(_ node: TreeNode, paneId: String, transform: (PaneNode) -> PaneNode) -> TreeNode {
        switch node {
        case .pane(let p):
            return p.id == paneId ? .pane(transform(p)) : node
        case .split(var s):
            s.first = mapPane(s.first, paneId: paneId, transform: transform)
            s.second = mapPane(s.second, paneId: paneId, transform: transform)
            return .split(s)
        }
    }

    public static func openTab(_ tree: PaneTree, tab: Tab, inPaneId: String? = nil) -> PaneTree {
        let targetId = inPaneId ?? tree.focusedPaneId
        guard findPane(tree.root, paneId: targetId) != nil else { return tree }
        let nextRoot = mapPane(tree.root, paneId: targetId) { p in
            var copy = p
            copy.tabs.append(tab)
            copy.activeTabId = tab.id
            return copy
        }
        return PaneTree(version: 1, root: nextRoot, focusedPaneId: targetId, maximisedPaneId: tree.maximisedPaneId)
    }

    public static func closeTab(_ tree: PaneTree, paneId: String? = nil, tabId: String? = nil) -> PaneTree {
        let targetPaneId = paneId ?? tree.focusedPaneId
        guard let pane = findPane(tree.root, paneId: targetPaneId) else { return tree }
        let targetTabId = tabId ?? pane.activeTabId
        guard let idx = pane.tabs.firstIndex(where: { $0.id == targetTabId }) else { return tree }

        if pane.tabs.count == 1 {
            if countPanes(tree.root) > 1 {
                return closePane(tree, paneId: targetPaneId)
            }
            let replacement = createDefaultTab(type: .web)
            let nextRoot = mapPane(tree.root, paneId: targetPaneId) { p in
                PaneNode(id: p.id, tabs: [replacement], activeTabId: replacement.id)
            }
            return PaneTree(version: 1, root: nextRoot, focusedPaneId: targetPaneId, maximisedPaneId: tree.maximisedPaneId)
        }

        var nextTabs = pane.tabs
        nextTabs.remove(at: idx)
        let nextActive = (pane.activeTabId == targetTabId)
            ? nextTabs[max(0, idx - 1)].id
            : pane.activeTabId
        let nextRoot = mapPane(tree.root, paneId: targetPaneId) { p in
            PaneNode(id: p.id, tabs: nextTabs, activeTabId: nextActive)
        }
        return PaneTree(version: 1, root: nextRoot, focusedPaneId: tree.focusedPaneId, maximisedPaneId: tree.maximisedPaneId)
    }

    public static func selectTab(_ tree: PaneTree, paneId: String, tabId: String) -> PaneTree {
        guard let pane = findPane(tree.root, paneId: paneId),
              pane.tabs.contains(where: { $0.id == tabId }) else { return tree }
        let nextRoot = mapPane(tree.root, paneId: paneId) { p in
            var copy = p
            copy.activeTabId = tabId
            return copy
        }
        return PaneTree(version: 1, root: nextRoot, focusedPaneId: paneId, maximisedPaneId: tree.maximisedPaneId)
    }

    public static func selectNextTab(_ tree: PaneTree, reverse: Bool = false) -> PaneTree {
        guard let pane = findPane(tree.root, paneId: tree.focusedPaneId), pane.tabs.count > 1 else {
            return tree
        }
        let idx = pane.tabs.firstIndex(where: { $0.id == pane.activeTabId }) ?? 0
        let delta = reverse ? -1 : 1
        let nextIdx = (idx + delta + pane.tabs.count) % pane.tabs.count
        return selectTab(tree, paneId: pane.id, tabId: pane.tabs[nextIdx].id)
    }

    public static func updateTab(_ tree: PaneTree, paneId: String, tabId: String, mutate: (inout Tab) -> Void) -> PaneTree {
        let nextRoot = mapPane(tree.root, paneId: paneId) { p in
            var copy = p
            if let idx = copy.tabs.firstIndex(where: { $0.id == tabId }) {
                mutate(&copy.tabs[idx])
            }
            return copy
        }
        var copy = tree
        copy.root = nextRoot
        return copy
    }

    public static func duplicateTab(
        _ tree: PaneTree,
        paneId: String,
        tabId: String,
        newTabId: String = "tab-\(UUID().uuidString.lowercased().prefix(8))"
    ) -> PaneTree {
        guard let pane = findPane(tree.root, paneId: paneId),
              let source = pane.tabs.first(where: { $0.id == tabId }) else { return tree }
        var dup = source
        dup.id = newTabId
        return openTab(tree, tab: dup, inPaneId: paneId)
    }

    public static func moveTabToNextPane(_ tree: PaneTree, paneId: String, tabId: String) -> PaneTree {
        let panes = collectPanes(tree.root)
        guard panes.count > 1,
              let fromIdx = panes.firstIndex(where: { $0.id == paneId }),
              let tab = panes[fromIdx].tabs.first(where: { $0.id == tabId }) else { return tree }
        let targetPaneId = panes[(fromIdx + 1) % panes.count].id
        let afterClose = closeTab(tree, paneId: paneId, tabId: tabId)
        return openTab(afterClose, tab: tab, inPaneId: targetPaneId)
    }

    // MARK: Browser, Terminal & Security Helpers (PRD §9, §10, §14)

    public static func resolveAddressBarInput(
        _ rawInput: String,
        searchEngineUrl: String = TetherConstants.defaultSearchEngineURL
    ) -> String {
        let trimmed = rawInput.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty {
            return TetherConstants.defaultWebHomeURL
        }
        if trimmed.range(of: #"^[a-zA-Z][a-zA-Z0-9+.-]*://"#, options: .regularExpression) != nil {
            return trimmed
        }
        let looksLikeHostOrIp = !trimmed.contains(" ") && (
            trimmed.contains(".") ||
            trimmed.hasPrefix("localhost") ||
            trimmed.range(of: #"^\d{1,3}(\.\d{1,3}){3}(:\d+)?(\/.*)?$"#, options: .regularExpression) != nil
        )
        if looksLikeHostOrIp {
            let scheme = trimmed.hasPrefix("localhost") ? "http" : "https"
            return "\(scheme)://\(trimmed)"
        }
        let encoded = trimmed.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? trimmed
        if searchEngineUrl.contains("%s") {
            return searchEngineUrl.replacingOccurrences(of: "%s", with: encoded)
        }
        return "\(searchEngineUrl)\(encoded)"
    }

    public static func calculateTerminalGrid(
        widthPx: Double,
        heightPx: Double,
        cellWidthPx: Double,
        cellHeightPx: Double
    ) -> (cols: Int, rows: Int) {
        guard cellWidthPx > 0, cellHeightPx > 0, widthPx > 0, heightPx > 0 else {
            return (80, 24)
        }
        let cols = max(20, Int(floor(widthPx / cellWidthPx)))
        let rows = max(5, Int(floor(heightPx / cellHeightPx)))
        return (cols, rows)
    }

    public static func isMultiLinePaste(_ text: String) -> Bool {
        text.contains("\n") || text.contains("\r")
    }

    /// Recursively scans decoded JSON objects (`[String: Any]` or `[Any]`) for forbidden secret keys (PRD §14).
    public static func findForbiddenSecretPath(in jsonObject: Any, path: String = "root") -> String? {
        if let arr = jsonObject as? [Any] {
            for (idx, item) in arr.enumerated() {
                if let found = findForbiddenSecretPath(in: item, path: "\(path)[\(idx)]") {
                    return found
                }
            }
            return nil
        }
        if let dict = jsonObject as? [String: Any] {
            for (key, val) in dict {
                let normalized = key.lowercased().replacingOccurrences(of: "-", with: "_")
                if TetherConstants.forbiddenSecretKeys.contains(normalized) {
                    return "\(path).\(key)"
                }
                if let found = findForbiddenSecretPath(in: val, path: "\(path).\(key)") {
                    return found
                }
            }
        }
        return nil
    }
}

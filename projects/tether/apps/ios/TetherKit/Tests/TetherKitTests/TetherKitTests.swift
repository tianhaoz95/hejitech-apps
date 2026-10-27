import Foundation
import XCTest
@testable import TetherKit

final class TetherKitTests: XCTestCase {
    func testDefaultPaneTreeAndCodableRoundTrip() throws {
        let tree = PaneTreeOps.createDefaultPaneTree()
        XCTAssertEqual(PaneTreeOps.countPanes(tree.root), 2)
        let panes = PaneTreeOps.collectPanes(tree.root)
        XCTAssertEqual(panes[0].tabs[0].type, .web)
        XCTAssertEqual(panes[1].tabs[0].type, .ssh)

        let data = try JSONEncoder().encode(tree)
        let decoded = try JSONDecoder().decode(PaneTree.self, from: data)
        XCTAssertEqual(decoded, tree)
    }

    func testSplitUpToMax4PanesAndCloseRebalance() {
        var tree = PaneTreeOps.createDefaultPaneTree()
        XCTAssertEqual(PaneTreeOps.countPanes(tree.root), 2)

        tree = PaneTreeOps.splitPane(tree, direction: .vertical, newPaneId: "pane-3")
        XCTAssertEqual(PaneTreeOps.countPanes(tree.root), 3)
        XCTAssertEqual(tree.focusedPaneId, "pane-3")

        tree = PaneTreeOps.splitPane(tree, direction: .horizontal, newPaneId: "pane-4")
        XCTAssertEqual(PaneTreeOps.countPanes(tree.root), 4)
        XCTAssertEqual(tree.focusedPaneId, "pane-4")

        // Attempting a 5th split must be a no-op (PRD §7.1 max 4 panes)
        let fifthAttempt = PaneTreeOps.splitPane(tree, direction: .vertical, newPaneId: "pane-5")
        XCTAssertEqual(PaneTreeOps.countPanes(fifthAttempt.root), 4)

        // Closing panes rebalances tree down to 1 pane
        tree = PaneTreeOps.closePane(tree, paneId: "pane-4")
        XCTAssertEqual(PaneTreeOps.countPanes(tree.root), 3)
        tree = PaneTreeOps.closePane(tree, paneId: "pane-3")
        XCTAssertEqual(PaneTreeOps.countPanes(tree.root), 2)
        tree = PaneTreeOps.closePane(tree, paneId: "pane-2")
        XCTAssertEqual(PaneTreeOps.countPanes(tree.root), 1)

        // Cannot close the last remaining pane
        let closeLast = PaneTreeOps.closePane(tree, paneId: "pane-1")
        XCTAssertEqual(PaneTreeOps.countPanes(closeLast.root), 1)
    }

    func testSplitRatioClampingAndStepping() {
        XCTAssertEqual(PaneTreeOps.clampSplitRatio(0.05), 0.2)
        XCTAssertEqual(PaneTreeOps.clampSplitRatio(0.95), 0.8)
        XCTAssertEqual(PaneTreeOps.clampSplitRatio(0.5), 0.5)
        XCTAssertEqual(PaneTreeOps.stepSplitRatio(0.5, delta: 0.05), 0.55, accuracy: 0.0001)
        XCTAssertEqual(PaneTreeOps.stepSplitRatio(0.2, delta: -0.05), 0.2, accuracy: 0.0001)
    }

    func testLayoutPresetsPreserveAllOpenTabsWithoutLoss() {
        var tree = PaneTreeOps.createDefaultPaneTree()
        let panes = PaneTreeOps.collectPanes(tree.root)
        let extraTab1 = Tab(id: "tab-files-1", type: .files, title: "Files: /", filesMode: .local, path: "/")
        let extraTab2 = Tab(id: "tab-web-2", type: .web, title: "Web: docs", url: "https://example.com/docs")
        tree = PaneTreeOps.openTab(tree, tab: extraTab1, inPaneId: panes[0].id)
        tree = PaneTreeOps.openTab(tree, tab: extraTab2, inPaneId: panes[1].id)

        let originalIds = Set(PaneTreeOps.collectPanes(tree.root).flatMap(\.tabs).map(\.id))
        XCTAssertEqual(originalIds.count, 4)

        for preset in LayoutPresetId.allCases {
            tree = PaneTreeOps.applyLayoutPreset(tree, preset: preset)
            let currentIds = Set(PaneTreeOps.collectPanes(tree.root).flatMap(\.tabs).map(\.id))
            for id in originalIds {
                XCTAssertTrue(currentIds.contains(id), "Preset \(preset) lost tab \(id)")
            }
        }
    }

    func testTabOperationsAndTitleFormatting() {
        var tree = PaneTreeOps.createDefaultPaneTree()
        let pane1Id = PaneTreeOps.collectPanes(tree.root)[0].id
        let newTab = Tab(id: "tab-extra", type: .files, title: "Files: projects", filesMode: .local, path: "/var/log/projects")
        tree = PaneTreeOps.openTab(tree, tab: newTab, inPaneId: pane1Id)
        XCTAssertEqual(PaneTreeOps.findPane(tree.root, paneId: pane1Id)?.tabs.count, 2)

        tree = PaneTreeOps.duplicateTab(tree, paneId: pane1Id, tabId: "tab-extra", newTabId: "tab-dup")
        XCTAssertEqual(PaneTreeOps.findPane(tree.root, paneId: pane1Id)?.tabs.count, 3)

        tree = PaneTreeOps.moveTabToNextPane(tree, paneId: pane1Id, tabId: "tab-dup")
        XCTAssertEqual(PaneTreeOps.findPane(tree.root, paneId: pane1Id)?.tabs.count, 2)

        let host = SshHost(id: "h1", label: "Prod Server", host: "example.invalid", port: 22, username: "ops", auth: .key)
        let sshTab = Tab(id: "t-ssh", type: .ssh, title: "", hostId: "h1")
        XCTAssertEqual(PaneTreeOps.computeTabTitle(tab: sshTab, hosts: [host]), "SSH: Prod Server")
        XCTAssertEqual(PaneTreeOps.computeTabTitle(tab: newTab), "Files: projects")
    }

    func testAddressBarTerminalGridAndPasteHelpers() {
        XCTAssertEqual(PaneTreeOps.resolveAddressBarInput("example.com"), "https://example.com")
        XCTAssertEqual(PaneTreeOps.resolveAddressBarInput("localhost:8080/health"), "http://localhost:8080/health")
        XCTAssertEqual(
            PaneTreeOps.resolveAddressBarInput("swift nio ssh guide"),
            "https://duckduckgo.com/?q=swift%20nio%20ssh%20guide"
        )

        let grid = PaneTreeOps.calculateTerminalGrid(widthPx: 960, heightPx: 540, cellWidthPx: 8.4, cellHeightPx: 18)
        XCTAssertEqual(grid.cols, 114)
        XCTAssertEqual(grid.rows, 30)

        XCTAssertFalse(PaneTreeOps.isMultiLinePaste("ls -la /tmp"))
        XCTAssertTrue(PaneTreeOps.isMultiLinePaste("echo hello\nrm -rf /tmp/test"))
        XCTAssertTrue(TetherConstants.terminalPassthroughCtrlKeys.contains("C"))
        XCTAssertTrue(TetherConstants.terminalPassthroughCtrlKeys.contains("R"))
    }

    func testSshKeyGenerationAndMandatoryHostKeyVerification() {
        let store = SecureStore(service: "com.hejitech.tether.tests", useInMemoryFallback: true)
        let key = SshKeyGenerator.generateEd25519Key(id: "key-test-1", label: "Test Ed25519")
        XCTAssertTrue(key.publicKeyOpenSSH.hasPrefix("ssh-ed25519 "))
        XCTAssertTrue(key.privateKeyPEM.contains("BEGIN OPENSSH PRIVATE KEY"))
        XCTAssertTrue(key.fingerprintSHA256.hasPrefix("SHA256:"))

        store.saveSshKey(key, passphrase: "secret-passphrase")
        XCTAssertEqual(store.listSshKeys().count, 1)
        XCTAssertEqual(store.loadKeyPassphrase(forKeyId: "key-test-1"), "secret-passphrase")

        // 1. First connect -> .firstConnect
        let status1 = store.verifyHostKeyFingerprint(
            host: "example.invalid",
            port: 22,
            keyType: "ssh-ed25519",
            sha256Fingerprint: "SHA256:abc123fingerprint"
        )
        XCTAssertEqual(
            status1,
            .firstConnect(
                host: "example.invalid",
                port: 22,
                keyType: "ssh-ed25519",
                sha256Fingerprint: "SHA256:abc123fingerprint"
            )
        )

        // Trust & Save
        let trusted = KnownHostKey(
            host: "example.invalid",
            port: 22,
            keyType: "ssh-ed25519",
            sha256Fingerprint: "SHA256:abc123fingerprint"
        )
        store.trustHostKey(trusted)

        // 2. Subsequent matching connect -> .matched
        let status2 = store.verifyHostKeyFingerprint(
            host: "example.invalid",
            port: 22,
            keyType: "ssh-ed25519",
            sha256Fingerprint: "SHA256:abc123fingerprint"
        )
        if case .matched(let matchedEntry) = status2 {
            XCTAssertEqual(matchedEntry.sha256Fingerprint, "SHA256:abc123fingerprint")
        } else {
            XCTFail("Expected .matched status")
        }

        // 3. Subsequent mismatched key -> .changedWarning (MITM / host key changed!)
        let status3 = store.verifyHostKeyFingerprint(
            host: "example.invalid",
            port: 22,
            keyType: "ssh-ed25519",
            sha256Fingerprint: "SHA256:DIFFERENT_KEY_999"
        )
        if case .changedWarning(let existing, _, let presented) = status3 {
            XCTAssertEqual(existing.sha256Fingerprint, "SHA256:abc123fingerprint")
            XCTAssertEqual(presented, "SHA256:DIFFERENT_KEY_999")
        } else {
            XCTFail("Expected .changedWarning status")
        }
    }

    func testSecretRejectionAndFileSortingPagination() {
        let cleanObj: [String: Any] = [
            "id": "host-1",
            "host": "example.invalid",
            "rememberPassword": true
        ]
        XCTAssertNil(PaneTreeOps.findForbiddenSecretPath(in: cleanObj))

        let dirtyObj: [String: Any] = [
            "hosts": [
                ["id": "host-1", "password": "leaked-password"]
            ]
        ]
        XCTAssertEqual(PaneTreeOps.findForbiddenSecretPath(in: dirtyObj), "root.hosts[0].password")

        var items: [FileItem] = [
            FileItem(name: "zebra.txt", path: "/zebra.txt", isDirectory: false),
            FileItem(name: "alpha.md", path: "/alpha.md", isDirectory: false),
            FileItem(name: "src", path: "/src", isDirectory: true),
            FileItem(name: "bin", path: "/bin", isDirectory: true),
        ]
        let sorted = FileBrowserSort.sort(items)
        XCTAssertEqual(sorted.map(\.name), ["bin", "src", "alpha.md", "zebra.txt"])

        for i in 0..<600 {
            items.append(FileItem(name: "file-\(i).log", path: "/file-\(i).log", isDirectory: false))
        }
        let page0 = FileBrowserSort.chunk(items, page: 0, pageSize: 500)
        XCTAssertEqual(page0.slice.count, 500)
        XCTAssertTrue(page0.hasMore)
        let page1 = FileBrowserSort.chunk(items, page: 1, pageSize: 500)
        XCTAssertEqual(page1.slice.count, 604)
        XCTAssertFalse(page1.hasMore)
    }

    func testTerminalEmulatorBuffer256ColorAlternateScreenAndScrollback() {
        let term = TerminalEmulatorBuffer(cols: 80, rows: 24, maxScrollbackLines: 10_000)
        var resizedDims: (Int, Int)?
        term.onWindowChange = { c, r in resizedDims = (c, r) }

        term.feed("\u{1B}[38;5;196;1mERROR:\u{1B}[0m Build failed\r\n")
        XCTAssertEqual(term.activeGrid[0][0].char, "E")
        XCTAssertEqual(term.activeGrid[0][0].fgColorIndex, 196)
        XCTAssertTrue(term.activeGrid[0][0].bold)

        // Alternate screen mode (e.g., vim / htop)
        term.feed("\u{1B}[?1049h\u{1B}[1;1H--- HTOP ALT SCREEN ---")
        XCTAssertTrue(term.isAlternateScreen)
        XCTAssertTrue(term.renderedLines(includeScrollback: false)[0].hasPrefix("--- HTOP ALT SCREEN ---"))

        // Exit alternate screen -> restores primary screen
        term.feed("\u{1B}[?1049l")
        XCTAssertFalse(term.isAlternateScreen)
        XCTAssertTrue(term.renderedLines(includeScrollback: false)[0].hasPrefix("ERROR: Build failed"))

        // Resize triggers PTY window-change
        term.resize(cols: 120, rows: 40)
        XCTAssertEqual(resizedDims?.0, 120)
        XCTAssertEqual(resizedDims?.1, 40)
    }
}


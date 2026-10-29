import Foundation
import XCTest
@testable import TetherKit

/// Automated test suite for external monitor display quality, layout geometry,
/// resolution matrices, connection lifecycle, and interactive performance.
final class ExternalMonitorQualityAndPerformanceTests: XCTestCase {

    // MARK: - Resolution Matrix & Quality Verification

    struct DisplayProfile {
        let name: String
        let width: Double
        let height: Double
        let aspectRatio: String
    }

    private let standardMonitors: [DisplayProfile] = [
        DisplayProfile(name: "1080p FHD (16:9)", width: 1920, height: 1080, aspectRatio: "16:9"),
        DisplayProfile(name: "1440p QHD (16:9)", width: 2560, height: 1440, aspectRatio: "16:9"),
        DisplayProfile(name: "4K UHD (16:9)", width: 3840, height: 2160, aspectRatio: "16:9"),
        DisplayProfile(name: "Ultrawide WQHD (21:9)", width: 3440, height: 1440, aspectRatio: "21:9"),
        DisplayProfile(name: "720p HD (16:9 Minimal)", width: 1280, height: 720, aspectRatio: "16:9"),
    ]

    private let layoutPresets: [LayoutPresetId] = [
        .single,
        .twoColumn,
        .leftPlusTwoRight,
        .twoByTwo,
    ]

    func testExternalDisplayResolutionMatrixQuality() {
        for monitor in standardMonitors {
            for preset in layoutPresets {
                let tree = PaneTreeOps.applyLayoutPreset(
                    PaneTreeOps.createDefaultPaneTree(),
                    preset: preset
                )
                let expectedPaneCount = preset.targetPaneCount
                XCTAssertEqual(
                    PaneTreeOps.countPanes(tree.root),
                    expectedPaneCount,
                    "Preset \(preset) on \(monitor.name) must create \(expectedPaneCount) panes"
                )

                let rects = PaneTreeOps.computePaneLayoutRects(
                    tree,
                    canvasWidth: monitor.width,
                    canvasHeight: monitor.height,
                    dividerThickness: 6.0
                )
                XCTAssertEqual(
                    rects.count,
                    expectedPaneCount,
                    "Layout rects count mismatch on \(monitor.name) with \(preset)"
                )

                // 1. Quality check: Each pane must have valid, positive, usable dimensions
                for (paneId, rect) in rects {
                    XCTAssertGreaterThan(
                        rect.width,
                        200.0,
                        "Pane \(paneId) width on \(monitor.name) must be at least 200px"
                    )
                    XCTAssertGreaterThan(
                        rect.height,
                        120.0,
                        "Pane \(paneId) height on \(monitor.name) must be at least 120px"
                    )
                    XCTAssertGreaterThanOrEqual(rect.x, 0.0)
                    XCTAssertGreaterThanOrEqual(rect.y, 0.0)
                    XCTAssertLessThanOrEqual(rect.x + rect.width, monitor.width + 1.0)
                    XCTAssertLessThanOrEqual(rect.y + rect.height, monitor.height + 1.0)
                }

                // 2. Overlap check: No two panes may overlap in 2D space
                let paneArray = Array(rects.values)
                for i in 0..<paneArray.count {
                    for j in (i + 1)..<paneArray.count {
                        let a = paneArray[i]
                        let b = paneArray[j]
                        let horizontalOverlap = (a.x < b.x + b.width) && (a.x + a.width > b.x)
                        let verticalOverlap = (a.y < b.y + b.height) && (a.y + a.height > b.y)
                        let overlaps = horizontalOverlap && verticalOverlap
                        XCTAssertFalse(
                            overlaps,
                            "Panes \(a.paneId) and \(b.paneId) overlap on \(monitor.name) under \(preset)"
                        )
                    }
                }
            }
        }
    }

    func testTerminalGridQualityAcrossResolutionsAndFontSizes() {
        // Standard ANSI terminal requirement is 80 columns x 24 rows minimum.
        // Cell size at standard 14pt monospace font is approx 8.4px width x 18.0px height.
        let cellW = 8.4
        let cellH = 18.0

        for monitor in standardMonitors {
            // Full screen single pane terminal
            let fullGrid = PaneTreeOps.calculateTerminalGrid(
                widthPx: monitor.width,
                heightPx: monitor.height,
                cellWidthPx: cellW,
                cellHeightPx: cellH
            )
            XCTAssertGreaterThanOrEqual(
                fullGrid.cols,
                80,
                "\(monitor.name) full terminal must have at least 80 cols (got \(fullGrid.cols))"
            )
            XCTAssertGreaterThanOrEqual(
                fullGrid.rows,
                24,
                "\(monitor.name) full terminal must have at least 24 rows (got \(fullGrid.rows))"
            )

            // 2-column split (width approx halved minus divider)
            let halfW = (monitor.width - 6.0) / 2.0
            let splitGrid = PaneTreeOps.calculateTerminalGrid(
                widthPx: halfW,
                heightPx: monitor.height,
                cellWidthPx: cellW,
                cellHeightPx: cellH
            )
            XCTAssertGreaterThanOrEqual(
                splitGrid.cols,
                70,
                "\(monitor.name) 2-column pane terminal cols must be >= 70 (got \(splitGrid.cols))"
            )

            // 4-pane 2x2 grid
            let quarterW = (monitor.width - 6.0) / 2.0
            let quarterH = (monitor.height - 6.0) / 2.0
            let quadGrid = PaneTreeOps.calculateTerminalGrid(
                widthPx: quarterW,
                heightPx: quarterH,
                cellWidthPx: cellW,
                cellHeightPx: cellH
            )
            XCTAssertGreaterThanOrEqual(
                quadGrid.rows,
                15,
                "\(monitor.name) 2x2 pane rows must be >= 15 (got \(quadGrid.rows))"
            )
        }

        // Test robustness against extreme zero/negative inputs: clamps to minimum (20 cols, 5 rows)
        let edgeGrid = PaneTreeOps.calculateTerminalGrid(
            widthPx: 10,
            heightPx: 10,
            cellWidthPx: cellW,
            cellHeightPx: cellH
        )
        XCTAssertEqual(edgeGrid.cols, 20)
        XCTAssertEqual(edgeGrid.rows, 5)

        let invalidGrid = PaneTreeOps.calculateTerminalGrid(
            widthPx: -50,
            heightPx: -50,
            cellWidthPx: 0,
            cellHeightPx: 0
        )
        XCTAssertEqual(invalidGrid.cols, 80)
        XCTAssertEqual(invalidGrid.rows, 24)
    }

    // MARK: - External Display Lifecycle

    @MainActor
    func testExternalDisplayConnectionAndDisconnectionLifecycle() {
        let secureStore = SecureStore(
            service: "com.hejitech.tether.tests.ext-lifecycle",
            useInMemoryFallback: true
        )
        let store = WorkspaceStore(secureStore: secureStore)

        // Configure two SSH hosts
        let host1 = SshHost(
            id: "h1-manual",
            label: "Server Manual",
            host: "10.0.0.1",
            port: 22,
            username: "root",
            auth: .password,
            autoReconnectOnDisplayReconnect: false,
            autoConnect: false
        )
        let host2 = SshHost(
            id: "h2-auto",
            label: "Server Auto-Reconnect",
            host: "10.0.0.2",
            port: 22,
            username: "ubuntu",
            auth: .password,
            autoReconnectOnDisplayReconnect: true,
            autoConnect: true
        )
        store.hosts = [host1, host2]

        // Open tabs for both hosts and mark as connected
        store.openTab(type: .ssh, hostId: host1.id)
        guard let tab1 = store.focusedPane?.activeTabId else {
            XCTFail("Missing active tab 1")
            return
        }
        store.sshStates[tab1] = .connected

        store.splitFocusedPane(.horizontal)
        store.openTab(type: .ssh, hostId: host2.id)
        guard let tab2 = store.focusedPane?.activeTabId else {
            XCTFail("Missing active tab 2")
            return
        }
        store.sshStates[tab2] = .connected

        // 1. External Display connected
        store.handleExternalDisplayChanged(
            connected: true,
            description: "External Display (1920×1080)"
        )
        XCTAssertTrue(store.isExternalDisplayConnected)
        XCTAssertEqual(store.externalDisplayDescription, "External Display (1920×1080)")

        // 2. External Display disconnected (USB-C unplugged)
        store.handleExternalDisplayChanged(
            connected: false,
            description: "No Monitor Connected"
        )
        XCTAssertFalse(store.isExternalDisplayConnected)
        XCTAssertTrue(store.pausedSshTabs.contains(tab1))
        XCTAssertTrue(store.pausedSshTabs.contains(tab2))

        // 3. External Display reconnected (USB-C plugged back in)
        store.handleExternalDisplayChanged(
            connected: true,
            description: "External Display (1920×1080)"
        )
        XCTAssertTrue(store.isExternalDisplayConnected)
        // Host 2 (auto-reconnect enabled) must be restored to .connected
        XCTAssertEqual(store.sshStates[tab2], .connected)
        XCTAssertFalse(store.pausedSshTabs.contains(tab2))
        // Host 1 (manual reconnect) should stay paused until user explicitly connects
        XCTAssertTrue(store.pausedSshTabs.contains(tab1))
    }

    // MARK: - Performance & Frame Budget Benchmarks

    func testSplitDraggingLatencyAndFrameBudgetPerformance() {
        var tree = PaneTreeOps.applyLayoutPreset(
            PaneTreeOps.createDefaultPaneTree(),
            preset: .twoByTwo
        )
        guard case .split(let rootSplit) = tree.root else {
            XCTFail("Root must be a split node in twoByTwo preset")
            return
        }
        let splitId = rootSplit.id
        let canvasW: Double = 1920.0
        let canvasH: Double = 1080.0

        let iterations = 1_000
        let start = CFAbsoluteTimeGetCurrent()

        for i in 0..<iterations {
            let ratio = 0.2 + (Double(i % 60) / 100.0) // 0.20 to 0.79
            tree = PaneTreeOps.updateSplitRatio(tree, splitId: splitId, ratio: ratio)
            let rects = PaneTreeOps.computePaneLayoutRects(
                tree,
                canvasWidth: canvasW,
                canvasHeight: canvasH,
                dividerThickness: 6.0
            )
            XCTAssertEqual(rects.count, 4)
        }

        let elapsed = CFAbsoluteTimeGetCurrent() - start
        let averageTimePerFrameMs = (elapsed / Double(iterations)) * 1000.0

        // 60fps frame budget is 16.6ms. 120fps frame budget is 8.3ms.
        // The layout calculation must be sub-millisecond (< 0.5ms per frame).
        XCTAssertLessThan(
            averageTimePerFrameMs,
            0.5,
            "Split drag layout calculation must be < 0.5ms per frame (measured \(String(format: "%.4f", averageTimePerFrameMs))ms)"
        )
        XCTAssertLessThan(
            elapsed,
            0.5,
            "1,000 layout recalculations took \(String(format: "%.3f", elapsed))s, should be < 0.5s"
        )
    }

    func testTerminalBufferBurstStreamingPerformance() {
        let terminal = TerminalEmulatorBuffer(cols: 120, rows: 40, maxScrollbackLines: 10_000)
        let lineCount = 5_000

        let start = CFAbsoluteTimeGetCurrent()

        // Stream 5,000 lines of colored ANSI text
        for i in 0..<lineCount {
            let ansiLine = "\u{1B}[38;5;\(i % 256)m[\(i)] tether-bench: External display line rendering test \u{1B}[1mBOLD\u{1B}[0m\r\n"
            terminal.feed(ansiLine)
        }

        let elapsed = CFAbsoluteTimeGetCurrent() - start
        let linesPerSec = Double(lineCount) / max(elapsed, 0.0001)

        // Throughput must exceed 5,000 lines/second
        XCTAssertGreaterThan(
            linesPerSec,
            5_000.0,
            "Terminal feed throughput was \(String(format: "%.0f", linesPerSec)) lines/sec (must be > 5,000)"
        )

        // Scrollback must stay clamped to 10,000 without memory bloat
        let rendered = terminal.renderedLines(includeScrollback: true)
        XCTAssertLessThanOrEqual(rendered.count, 10_040) // 10,000 scrollback + 40 viewport
    }

    @MainActor
    func testMultiWorkspaceSwitchingLatencyPerformance() {
        let store = WorkspaceStore(
            secureStore: SecureStore(service: "com.hejitech.tether.tests.ws-bench", useInMemoryFallback: true)
        )

        // Setup 4 workspaces with 4 panes each
        for i in 1...4 {
            if i > 1 {
                store.addWorkspace(preset: .twoByTwo)
            } else {
                store.applyPreset(.twoByTwo)
            }
        }
        XCTAssertEqual(store.workspaces.count, 4)

        let switchCycles = 100
        let start = CFAbsoluteTimeGetCurrent()

        for _ in 0..<switchCycles {
            store.nextWorkspace()
        }

        let elapsed = CFAbsoluteTimeGetCurrent() - start
        let averageSwitchMs = (elapsed / Double(switchCycles)) * 1000.0

        // Workspace switching must take < 0.5ms on average
        XCTAssertLessThan(
            averageSwitchMs,
            0.5,
            "Workspace switch must be < 0.5ms (measured \(String(format: "%.4f", averageSwitchMs))ms)"
        )
    }
}

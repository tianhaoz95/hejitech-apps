import Combine
import SwiftUI
import TetherKit
import UIKit

@MainActor
public final class TilingWorkspaceViewController: UIViewController {
    private let store: WorkspaceStore
    private var cancellables: Set<AnyCancellable> = []

    private let topBar = UIView()
    private let displayBadgeLabel = UILabel()
    private let phoneSwitcherBar = UIScrollView()
    private let phoneSwitcherStack = UIStackView()
    private var phoneSwitcherHeightConstraint: NSLayoutConstraint!
    private let workspaceCanvas = UIView()
    public private(set) var virtualCursorOverlay: VirtualCursorOverlayView!
    public private(set) var activeDialog: DesktopDialogView?

    public struct SplitDividerInfo {
        public let splitId: String
        public let direction: SplitDirection
        public let frame: CGRect
        public let containerBounds: CGRect
    }
    private var renderedDividers: [SplitDividerInfo] = []
    private var activeDragSplit: SplitDividerInfo?

    /// Live child view controllers keyed by `tab.id` so WebViews, SSH sessions, and Files state persist across layout changes.
    private var tabControllers: [String: UIViewController] = [:]

    /// Active split drag metadata.
    private var activeSplitDrags: [UIPanGestureRecognizer: (splitId: String, direction: SplitDirection, containerBounds: CGRect)] = [:]

    public init(store: WorkspaceStore) {
        self.store = store
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    public override var supportedInterfaceOrientations: UIInterfaceOrientationMask {
        DisplayHost.shared.supportedOrientations
    }

    public override var canBecomeFirstResponder: Bool {
        true
    }

    public override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 0.03, green: 0.05, blue: 0.09, alpha: 1.0)
        setupChrome()
        bindStore()
        rebuildWorkspaceLayout()
    }

    public override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        let isCompactPhone = view.bounds.width < 600 && !store.isExternalDisplayConnected
        phoneSwitcherHeightConstraint.constant = isCompactPhone ? 32 : 0
        phoneSwitcherBar.isHidden = !isCompactPhone
        rebuildWorkspaceLayout()
    }

    // MARK: - Top Desktop Chrome & Phone Switcher

    private func setupChrome() {
        topBar.translatesAutoresizingMaskIntoConstraints = false
        topBar.backgroundColor = UIColor(red: 0.05, green: 0.08, blue: 0.14, alpha: 1.0)

        let brandLabel = UILabel()
        brandLabel.text = "TETHER"
        brandLabel.font = .monospacedSystemFont(ofSize: 13, weight: .bold)
        brandLabel.textColor = UIColor(red: 0.22, green: 0.74, blue: 0.97, alpha: 1.0)

        displayBadgeLabel.font = .monospacedSystemFont(ofSize: 10, weight: .medium)
        displayBadgeLabel.textColor = UIColor(red: 0.20, green: 0.83, blue: 0.60, alpha: 1.0)
        displayBadgeLabel.text = store.externalDisplayDescription

        let preset1 = makeChromeButton("1", action: #selector(presetSingleTapped))
        let preset2 = makeChromeButton("2", action: #selector(presetTwoColTapped))
        let preset3 = makeChromeButton("1+2", action: #selector(presetLeftTwoRightTapped))
        let preset4 = makeChromeButton("2×2", action: #selector(presetGridTapped))

        let splitH = makeChromeButton("Split ⫿", action: #selector(splitHorizontalTapped))
        let splitV = makeChromeButton("Split ⊟", action: #selector(splitVerticalTapped))
        let swapBtn = makeChromeButton("Swap", action: #selector(swapPanesTapped))
        let maxBtn = makeChromeButton("Max", action: #selector(maximisePaneTapped))
        let hostsBtn = makeChromeButton("Hosts & Keys", action: #selector(openHostsTapped))
        let settingsBtn = makeChromeButton("⚙︎", action: #selector(openSettingsTapped))

        let spacer = UIView()
        let barStack = UIStackView(arrangedSubviews: [
            brandLabel, displayBadgeLabel, spacer,
            preset1, preset2, preset3, preset4,
            splitH, splitV, swapBtn, maxBtn, hostsBtn, settingsBtn
        ])
        barStack.translatesAutoresizingMaskIntoConstraints = false
        barStack.axis = .horizontal
        barStack.spacing = 6
        barStack.alignment = .center
        topBar.addSubview(barStack)

        phoneSwitcherBar.translatesAutoresizingMaskIntoConstraints = false
        phoneSwitcherBar.backgroundColor = UIColor(red: 0.04, green: 0.07, blue: 0.12, alpha: 1.0)
        phoneSwitcherBar.showsHorizontalScrollIndicator = false
        phoneSwitcherStack.translatesAutoresizingMaskIntoConstraints = false
        phoneSwitcherStack.axis = .horizontal
        phoneSwitcherStack.spacing = 6
        phoneSwitcherStack.alignment = .center
        phoneSwitcherBar.addSubview(phoneSwitcherStack)

        workspaceCanvas.translatesAutoresizingMaskIntoConstraints = false
        workspaceCanvas.backgroundColor = UIColor(red: 0.02, green: 0.03, blue: 0.06, alpha: 1.0)

        view.addSubview(topBar)
        view.addSubview(phoneSwitcherBar)
        view.addSubview(workspaceCanvas)

        virtualCursorOverlay = VirtualCursorOverlayView(targetCanvas: workspaceCanvas)
        virtualCursorOverlay.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(virtualCursorOverlay)

        phoneSwitcherHeightConstraint = phoneSwitcherBar.heightAnchor.constraint(equalToConstant: 0)

        NSLayoutConstraint.activate([
            topBar.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            topBar.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            topBar.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            topBar.heightAnchor.constraint(equalToConstant: 36),

            barStack.leadingAnchor.constraint(equalTo: topBar.leadingAnchor, constant: 10),
            barStack.trailingAnchor.constraint(equalTo: topBar.trailingAnchor, constant: -10),
            barStack.centerYAnchor.constraint(equalTo: topBar.centerYAnchor),

            phoneSwitcherBar.topAnchor.constraint(equalTo: topBar.bottomAnchor),
            phoneSwitcherBar.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            phoneSwitcherBar.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            phoneSwitcherHeightConstraint,

            phoneSwitcherStack.leadingAnchor.constraint(equalTo: phoneSwitcherBar.leadingAnchor, constant: 8),
            phoneSwitcherStack.trailingAnchor.constraint(equalTo: phoneSwitcherBar.trailingAnchor, constant: -8),
            phoneSwitcherStack.centerYAnchor.constraint(equalTo: phoneSwitcherBar.centerYAnchor),

            workspaceCanvas.topAnchor.constraint(equalTo: phoneSwitcherBar.bottomAnchor),
            workspaceCanvas.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            workspaceCanvas.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            workspaceCanvas.bottomAnchor.constraint(equalTo: view.bottomAnchor),

            virtualCursorOverlay.topAnchor.constraint(equalTo: workspaceCanvas.topAnchor),
            virtualCursorOverlay.leadingAnchor.constraint(equalTo: workspaceCanvas.leadingAnchor),
            virtualCursorOverlay.trailingAnchor.constraint(equalTo: workspaceCanvas.trailingAnchor),
            virtualCursorOverlay.bottomAnchor.constraint(equalTo: workspaceCanvas.bottomAnchor),
        ])
    }

    private func makeChromeButton(_ title: String, action: Selector) -> UIButton {
        let btn = UIButton(type: .system)
        btn.setTitle(title, for: .normal)
        btn.titleLabel?.font = .monospacedSystemFont(ofSize: 11, weight: .semibold)
        btn.setTitleColor(.white, for: .normal)
        btn.backgroundColor = UIColor(white: 1.0, alpha: 0.08)
        btn.layer.cornerRadius = 4
        btn.addTarget(self, action: action, for: .touchUpInside)
        return btn
    }

    private func bindStore() {
        store.$tree
            .receive(on: RunLoop.main)
            .sink { [weak self] _ in
                self?.rebuildWorkspaceLayout()
            }
            .store(in: &cancellables)

        store.$externalDisplayDescription
            .receive(on: RunLoop.main)
            .sink { [weak self] desc in
                self?.displayBadgeLabel.text = desc
            }
            .store(in: &cancellables)
    }

    // MARK: - Recursive Binary Split-Pane Renderer (PRD §7)

    private func rebuildWorkspaceLayout() {
        guard workspaceCanvas.bounds.width > 10, workspaceCanvas.bounds.height > 10 else { return }

        // Prune controllers for closed tabs
        let allOpenTabIds = Set(store.panes.flatMap(\.tabs).map(\.id))
        for (tabId, vc) in tabControllers where !allOpenTabIds.contains(tabId) {
            vc.willMove(toParent: nil)
            vc.view.removeFromSuperview()
            vc.removeFromParent()
            tabControllers.removeValue(forKey: tabId)
        }

        for sub in workspaceCanvas.subviews {
            sub.removeFromSuperview()
        }
        activeSplitDrags.removeAll()

        // Rebuild phone-screen pane switcher strip (PRD §7.6)
        for v in phoneSwitcherStack.arrangedSubviews {
            phoneSwitcherStack.removeArrangedSubview(v)
            v.removeFromSuperview()
        }
        for (idx, pane) in store.panes.enumerated() {
            let btn = UIButton(type: .system)
            let activeTitle = pane.activeTab?.title ?? "Pane \(idx + 1)"
            btn.setTitle("Pane \(idx + 1): \(activeTitle)", for: .normal)
            btn.titleLabel?.font = .monospacedSystemFont(
                ofSize: 11,
                weight: pane.id == store.tree.focusedPaneId ? .bold : .regular
            )
            btn.setTitleColor(.white, for: .normal)
            btn.backgroundColor = (pane.id == store.tree.focusedPaneId)
                ? UIColor(red: 0.22, green: 0.74, blue: 0.97, alpha: 0.35)
                : UIColor(white: 1.0, alpha: 0.07)
            btn.layer.cornerRadius = 4
            btn.addAction(UIAction { [weak self] _ in
                self?.store.focusPane(pane.id)
            }, for: .touchUpInside)
            phoneSwitcherStack.addArrangedSubview(btn)
        }

        let isCompactPhone = view.bounds.width < 600 && !store.isExternalDisplayConnected
        if isCompactPhone, let focused = store.focusedPane {
            let paneView = buildPaneContainer(pane: focused, frame: workspaceCanvas.bounds)
            workspaceCanvas.addSubview(paneView)
            return
        }

        if let maxId = store.tree.maximisedPaneId,
           let maxPane = PaneTreeOps.findPane(store.tree.root, paneId: maxId) {
            let paneView = buildPaneContainer(pane: maxPane, frame: workspaceCanvas.bounds)
            workspaceCanvas.addSubview(paneView)
            return
        }

        renderTreeNode(store.tree.root, in: workspaceCanvas.bounds)
    }

    private func renderTreeNode(_ node: TreeNode, in rect: CGRect) {
        switch node {
        case .pane(let pane):
            let paneView = buildPaneContainer(pane: pane, frame: rect)
            workspaceCanvas.addSubview(paneView)
        case .split(let split):
            let dividerThickness: CGFloat = 6
            if split.direction == .horizontal {
                let firstW = floor((rect.width - dividerThickness) * CGFloat(split.ratio))
                let secondW = rect.width - dividerThickness - firstW
                let firstRect = CGRect(x: rect.minX, y: rect.minY, width: firstW, height: rect.height)
                let divRect = CGRect(x: rect.minX + firstW, y: rect.minY, width: dividerThickness, height: rect.height)
                let secondRect = CGRect(x: divRect.maxX, y: rect.minY, width: secondW, height: rect.height)
                renderTreeNode(split.first, in: firstRect)
                renderTreeNode(split.second, in: secondRect)
                workspaceCanvas.addSubview(buildSplitDivider(split: split, frame: divRect, parentRect: rect))
            } else {
                let firstH = floor((rect.height - dividerThickness) * CGFloat(split.ratio))
                let secondH = rect.height - dividerThickness - firstH
                let firstRect = CGRect(x: rect.minX, y: rect.minY, width: rect.width, height: firstH)
                let divRect = CGRect(x: rect.minX, y: rect.minY + firstH, width: rect.width, height: dividerThickness)
                let secondRect = CGRect(x: rect.minX, y: divRect.maxY, width: rect.width, height: secondH)
                renderTreeNode(split.first, in: firstRect)
                renderTreeNode(split.second, in: secondRect)
                workspaceCanvas.addSubview(buildSplitDivider(split: split, frame: divRect, parentRect: rect))
            }
        }
    }

    private func buildSplitDivider(split: SplitNode, frame: CGRect, parentRect: CGRect) -> UIView {
        let divider = UIView(frame: frame)
        divider.backgroundColor = UIColor(red: 0.12, green: 0.18, blue: 0.28, alpha: 1.0)
        let pan = UIPanGestureRecognizer(target: self, action: #selector(handleDividerPan(_:)))
        divider.addGestureRecognizer(pan)
        activeSplitDrags[pan] = (splitId: split.id, direction: split.direction, containerBounds: parentRect)
        return divider
    }

    @objc private func handleDividerPan(_ gesture: UIPanGestureRecognizer) {
        guard let meta = activeSplitDrags[gesture] else { return }
        let loc = gesture.location(in: workspaceCanvas)
        let rawRatio: Double
        if meta.direction == .horizontal {
            rawRatio = Double((loc.x - meta.containerBounds.minX) / max(1, meta.containerBounds.width))
        } else {
            rawRatio = Double((loc.y - meta.containerBounds.minY) / max(1, meta.containerBounds.height))
        }
        store.tree = PaneTreeOps.updateSplitRatio(store.tree, splitId: meta.splitId, ratio: rawRatio)
    }

    private func buildPaneContainer(pane: PaneNode, frame: CGRect) -> UIView {
        let isFocused = (pane.id == store.tree.focusedPaneId)
        let container = UIView(frame: frame.insetBy(dx: 1, dy: 1))
        container.backgroundColor = UIColor(red: 0.04, green: 0.06, blue: 0.11, alpha: 1.0)
        container.layer.borderWidth = isFocused ? 2.0 : 1.0
        container.layer.borderColor = isFocused
            ? UIColor(red: 0.22, green: 0.74, blue: 0.97, alpha: 1.0).cgColor
            : UIColor(white: 1.0, alpha: 0.12).cgColor
        container.clipsToBounds = true

        // Tap anywhere on the pane header to focus this pane
        let tapFocus = UITapGestureRecognizer(target: self, action: #selector(handlePaneHeaderTap(_:)))
        container.accessibilityIdentifier = pane.id

        // Pane Tab Bar Header (32pt)
        let tabBarHeight: CGFloat = 32
        let tabHeader = UIView(frame: CGRect(x: 0, y: 0, width: container.bounds.width, height: tabBarHeight))
        tabHeader.backgroundColor = isFocused
            ? UIColor(red: 0.07, green: 0.12, blue: 0.22, alpha: 1.0)
            : UIColor(red: 0.04, green: 0.07, blue: 0.12, alpha: 1.0)
        tabHeader.accessibilityIdentifier = pane.id
        tabHeader.addGestureRecognizer(tapFocus)

        let scroll = UIScrollView(frame: CGRect(x: 4, y: 0, width: max(40, container.bounds.width - 130), height: tabBarHeight))
        scroll.showsHorizontalScrollIndicator = false

        var xOffset: CGFloat = 2
        for tab in pane.tabs {
            let isActive = (tab.id == pane.activeTabId)
            let pill = UIView()
            pill.backgroundColor = isActive
                ? UIColor(red: 0.22, green: 0.74, blue: 0.97, alpha: 0.24)
                : UIColor(white: 1.0, alpha: 0.05)
            pill.layer.cornerRadius = 4

            let titleBtn = UIButton(type: .system)
            titleBtn.setTitle(tab.title, for: .normal)
            titleBtn.titleLabel?.font = .monospacedSystemFont(
                ofSize: 11,
                weight: (isActive && isFocused) ? .bold : .medium
            )
            titleBtn.setTitleColor(isActive ? .white : UIColor(white: 0.72, alpha: 1.0), for: .normal)
            titleBtn.addAction(UIAction { [weak self] _ in
                guard let self else { return }
                self.store.tree = PaneTreeOps.selectTab(self.store.tree, paneId: pane.id, tabId: tab.id)
            }, for: .touchUpInside)

            let closeBtn = UIButton(type: .system)
            closeBtn.setTitle("×", for: .normal)
            closeBtn.titleLabel?.font = .systemFont(ofSize: 12, weight: .bold)
            closeBtn.setTitleColor(UIColor(white: 0.7, alpha: 1.0), for: .normal)
            closeBtn.addAction(UIAction { [weak self] _ in
                self?.store.closeTab(paneId: pane.id, tabId: tab.id)
            }, for: .touchUpInside)

            let titleW = min(160, max(64, (tab.title as NSString).size(withAttributes: [.font: UIFont.monospacedSystemFont(ofSize: 11, weight: .bold)]).width + 14))
            pill.frame = CGRect(x: xOffset, y: 4, width: titleW + 22, height: 24)
            titleBtn.frame = CGRect(x: 4, y: 0, width: titleW - 4, height: 24)
            closeBtn.frame = CGRect(x: titleW, y: 0, width: 20, height: 24)

            pill.addSubview(titleBtn)
            pill.addSubview(closeBtn)
            scroll.addSubview(pill)
            xOffset += pill.frame.width + 4
        }
        scroll.contentSize = CGSize(width: xOffset + 4, height: tabBarHeight)
        tabHeader.addSubview(scroll)

        // Quick +Web / +SSH / +Files / Close Pane buttons on right side of pane header
        let rightControls = UIStackView()
        rightControls.axis = .horizontal
        rightControls.spacing = 3
        rightControls.alignment = .center
        rightControls.frame = CGRect(x: max(0, container.bounds.width - 124), y: 2, width: 120, height: 28)

        for (label, type) in [("+W", TabType.web), ("+S", TabType.ssh), ("+F", TabType.files)] {
            let b = UIButton(type: .system)
            b.setTitle(label, for: .normal)
            b.titleLabel?.font = .monospacedSystemFont(ofSize: 10, weight: .bold)
            b.setTitleColor(UIColor(red: 0.22, green: 0.74, blue: 0.97, alpha: 1.0), for: .normal)
            b.backgroundColor = UIColor(white: 1.0, alpha: 0.08)
            b.layer.cornerRadius = 3
            b.addAction(UIAction { [weak self] _ in
                self?.store.openTab(type: type, inPaneId: pane.id)
            }, for: .touchUpInside)
            rightControls.addArrangedSubview(b)
        }

        if store.panes.count > 1 {
            let closePaneBtn = UIButton(type: .system)
            closePaneBtn.setTitle("✕", for: .normal)
            closePaneBtn.titleLabel?.font = .systemFont(ofSize: 10, weight: .bold)
            closePaneBtn.setTitleColor(.systemRed, for: .normal)
            closePaneBtn.addAction(UIAction { [weak self] _ in
                self?.store.closePane(pane.id)
            }, for: .touchUpInside)
            rightControls.addArrangedSubview(closePaneBtn)
        }

        tabHeader.addSubview(rightControls)
        container.addSubview(tabHeader)

        // Active Tab Content View
        if let activeTab = pane.activeTab {
            let contentFrame = CGRect(
                x: 0,
                y: tabBarHeight,
                width: container.bounds.width,
                height: max(10, container.bounds.height - tabBarHeight)
            )
            let childVC = controller(for: activeTab, inPaneId: pane.id)
            childVC.view.frame = contentFrame
            childVC.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
            container.addSubview(childVC.view)
        }

        return container
    }

    private func controller(for tab: TetherKit.Tab, inPaneId paneId: String) -> UIViewController {
        if let existing = tabControllers[tab.id] {
            if let webVC = existing as? WebTabViewController {
                webVC.paneId = paneId
                webVC.tabItem = tab
            } else if let sshVC = existing as? SshTabViewController {
                sshVC.paneId = paneId
                sshVC.tabItem = tab
            } else if let filesVC = existing as? FilesTabViewController {
                filesVC.paneId = paneId
                filesVC.tabItem = tab
            }
            return existing
        }

        let created: UIViewController
        switch tab.type {
        case .web:
            created = WebTabViewController(store: store, paneId: paneId, tab: tab)
        case .ssh:
            created = SshTabViewController(store: store, paneId: paneId, tab: tab)
        case .files:
            created = FilesTabViewController(store: store, paneId: paneId, tab: tab)
        }
        addChild(created)
        created.didMove(toParent: self)
        tabControllers[tab.id] = created
        return created
    }

    @objc private func handlePaneHeaderTap(_ gesture: UITapGestureRecognizer) {
        if let paneId = gesture.view?.accessibilityIdentifier {
            store.focusPane(paneId)
        }
    }

    // MARK: - External Input & Cursor Routing

    public var activeTabController: UIViewController? {
        guard let focused = store.focusedPane, let activeTab = focused.activeTab else { return nil }
        return tabControllers[activeTab.id]
    }

    public func routeKeyInput(_ text: String) {
        guard let active = activeTabController else { return }
        if let ssh = active as? SshTabViewController {
            ssh.handleKeyInput(text: text)
        } else if let web = active as? WebTabViewController {
            web.handleKeyInput(text: text)
        } else if let files = active as? FilesTabViewController {
            files.handleKeyInput(text: text)
        }
    }

    public func routeSpecialKey(_ key: SpecialKey) {
        guard let active = activeTabController else { return }
        if let ssh = active as? SshTabViewController {
            ssh.handleSpecialKey(key)
        } else if let web = active as? WebTabViewController {
            web.handleSpecialKey(key)
        } else if let files = active as? FilesTabViewController {
            files.handleSpecialKey(key)
        }
    }

    public func moveVirtualCursor(delta: CGVector) {
        virtualCursorOverlay?.move(by: delta)
    }

    public func performVirtualClick() {
        virtualCursorOverlay?.performClick()
    }

    public func performVirtualScroll(deltaX: CGFloat, deltaY: CGFloat) {
        virtualCursorOverlay?.performScroll(deltaX: deltaX, deltaY: deltaY)
    }

    // MARK: - Top Bar Actions

    @objc private func presetSingleTapped() { store.applyPreset(.single) }
    @objc private func presetTwoColTapped() { store.applyPreset(.twoColumn) }
    @objc private func presetLeftTwoRightTapped() { store.applyPreset(.leftPlusTwoRight) }
    @objc private func presetGridTapped() { store.applyPreset(.twoByTwo) }
    @objc private func splitHorizontalTapped() { store.splitFocusedPane(.horizontal) }
    @objc private func splitVerticalTapped() { store.splitFocusedPane(.vertical) }
    @objc private func swapPanesTapped() { store.swapFocusedWithNext() }
    @objc private func maximisePaneTapped() { store.toggleMaximiseFocusedPane() }

    @objc private func openHostsTapped() {
        let hostView = HostManagerView(store: store) { [weak self] host in
            self?.store.openTab(type: .ssh, hostId: host.id)
        }
        let hc = UIHostingController(rootView: hostView)
        present(hc, animated: true)
    }

    @objc private func openSettingsTapped() {
        let settingsView = SettingsSheetView(store: store)
        let hc = UIHostingController(rootView: settingsView)
        present(hc, animated: true)
    }

    // MARK: - Hardware Keyboard Shortcuts & Terminal Precedence (PRD §13.1, §13.2)

    public override var keyCommands: [UIKeyCommand]? {
        var cmds: [UIKeyCommand] = [
            // Pane Management (Ctrl+Alt / Cmd+Alt)
            UIKeyCommand(title: "Split Horizontally", action: #selector(splitHorizontalTapped), input: "\\", modifierFlags: [.control, .alternate]),
            UIKeyCommand(title: "Split Vertically", action: #selector(splitVerticalTapped), input: "-", modifierFlags: [.control, .alternate]),
            UIKeyCommand(title: "Close Focused Pane", action: #selector(closeFocusedPaneKey), input: "w", modifierFlags: [.control, .alternate]),
            UIKeyCommand(title: "Focus Left Pane", action: #selector(focusLeftKey), input: UIKeyCommand.inputLeftArrow, modifierFlags: [.control, .alternate]),
            UIKeyCommand(title: "Focus Right Pane", action: #selector(focusRightKey), input: UIKeyCommand.inputRightArrow, modifierFlags: [.control, .alternate]),
            UIKeyCommand(title: "Focus Up Pane", action: #selector(focusUpKey), input: UIKeyCommand.inputUpArrow, modifierFlags: [.control, .alternate]),
            UIKeyCommand(title: "Focus Down Pane", action: #selector(focusDownKey), input: UIKeyCommand.inputDownArrow, modifierFlags: [.control, .alternate]),
            UIKeyCommand(title: "Toggle Maximise Pane", action: #selector(maximisePaneTapped), input: "\r", modifierFlags: [.control, .alternate]),
            UIKeyCommand(title: "Swap Panes", action: #selector(swapPanesTapped), input: "s", modifierFlags: [.control, .alternate]),
            UIKeyCommand(title: "Shrink Split", action: #selector(shrinkSplitKey), input: "[", modifierFlags: [.control, .alternate]),
            UIKeyCommand(title: "Grow Split", action: #selector(growSplitKey), input: "]", modifierFlags: [.control, .alternate]),
            UIKeyCommand(title: "Preset 1", action: #selector(presetSingleTapped), input: "1", modifierFlags: [.control, .alternate]),
            UIKeyCommand(title: "Preset 2", action: #selector(presetTwoColTapped), input: "2", modifierFlags: [.control, .alternate]),
            UIKeyCommand(title: "Preset 3", action: #selector(presetLeftTwoRightTapped), input: "3", modifierFlags: [.control, .alternate]),
            UIKeyCommand(title: "Preset 4", action: #selector(presetGridTapped), input: "4", modifierFlags: [.control, .alternate]),

            // Tab Management
            UIKeyCommand(title: "New Tab", action: #selector(newTabKey), input: "t", modifierFlags: [.control]),
            UIKeyCommand(title: "Next Tab", action: #selector(nextTabKey), input: "\t", modifierFlags: [.control]),
            UIKeyCommand(title: "Previous Tab", action: #selector(prevTabKey), input: "\t", modifierFlags: [.control, .shift]),
            UIKeyCommand(title: "Open Settings", action: #selector(openSettingsTapped), input: ",", modifierFlags: [.control]),
            UIKeyCommand(title: "Open Hosts", action: #selector(openHostsTapped), input: "h", modifierFlags: [.control, .shift]),
        ]

        // PRD §13.2: When an SSH terminal tab is focused, Ctrl+C/D/Z/R/A/E/K/U/W/L MUST be sent to the PTY
        if let activeTab = store.focusedPane?.activeTab, activeTab.type == .ssh {
            for ch in TetherConstants.terminalPassthroughCtrlKeys {
                let cmd = UIKeyCommand(
                    title: "Terminal Ctrl+\(ch)",
                    action: #selector(handleTerminalCtrlKey(_:)),
                    input: ch.lowercased(),
                    modifierFlags: [.control],
                    propertyList: ch
                )
                cmd.wantsPriorityOverSystemBehavior = true
                cmds.append(cmd)
            }
        } else {
            cmds.append(UIKeyCommand(title: "Close Tab", action: #selector(closeActiveTabKey), input: "w", modifierFlags: [.control]))
            cmds.append(UIKeyCommand(title: "Focus Address Bar", action: #selector(focusAddressBarKey), input: "l", modifierFlags: [.control]))
            cmds.append(UIKeyCommand(title: "Reload Page", action: #selector(reloadWebKey), input: "r", modifierFlags: [.control]))
        }

        return cmds
    }

    @objc private func closeFocusedPaneKey() { store.closePane() }
    @objc private func focusLeftKey() { store.focusDirectional(.left) }
    @objc private func focusRightKey() { store.focusDirectional(.right) }
    @objc private func focusUpKey() { store.focusDirectional(.up) }
    @objc private func focusDownKey() { store.focusDirectional(.down) }
    @objc private func shrinkSplitKey() { store.tree = PaneTreeOps.adjustParentSplitRatio(store.tree, delta: -0.05) }
    @objc private func growSplitKey() { store.tree = PaneTreeOps.adjustParentSplitRatio(store.tree, delta: 0.05) }
    @objc private func newTabKey() { store.openTab(type: .web) }
    @objc private func closeActiveTabKey() { store.closeTab() }
    @objc private func nextTabKey() { store.tree = PaneTreeOps.selectNextTab(store.tree, reverse: false) }
    @objc private func prevTabKey() { store.tree = PaneTreeOps.selectNextTab(store.tree, reverse: true) }

    @objc private func focusAddressBarKey() {
        if let active = store.focusedPane?.activeTab,
           let webVC = tabControllers[active.id] as? WebTabViewController {
            webVC.focusAddressBar()
        }
    }

    @objc private func reloadWebKey() {
        if let active = store.focusedPane?.activeTab,
           let webVC = tabControllers[active.id] as? WebTabViewController {
            webVC.reloadCurrentPage()
        }
    }

    @objc private func handleTerminalCtrlKey(_ sender: UIKeyCommand) {
        guard let key = sender.propertyList as? String,
              let active = store.focusedPane?.activeTab,
              let sshVC = tabControllers[active.id] as? SshTabViewController else { return }
        sshVC.sendControlKey(key)
    }
}

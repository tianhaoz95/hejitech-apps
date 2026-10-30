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
    private let workspaceSwitcherScrollView = UIScrollView()
    private let workspaceSwitcherStack = UIStackView()
    private let phoneSwitcherBar = UIScrollView()
    private let phoneSwitcherStack = UIStackView()
    private var phoneSwitcherHeightConstraint: NSLayoutConstraint!
    private let workspaceCanvas = UIView()
    private let bottomStatusHud = BottomStatusHudView()
    public private(set) var currentInteractionMode: DesktopInteractionMode = .normal
    public private(set) var activeTabSwitcher: TabSwitcherOverlayView?
    public private(set) var activeResizeHud: ResizeHudOverlayView?
    public private(set) var virtualCursorOverlay: VirtualCursorOverlayView!
    public private(set) var activeDialog: DesktopDialogView?
    public private(set) var activeCommandPalette: CommandPaletteView?
    public private(set) var activeHostsModal: DesktopHostsModalView?
    public private(set) var activeSettingsModal: DesktopSettingsModalView?
    public private(set) var activeShortcutsModal: DesktopShortcutsModalView?

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
    private var lastRenderedTree: PaneTree?
    /// Tab strip scroll offsets by pane id, kept across rebuilds so tabs past the strip's edge stay reachable.
    private var tabStripOffsets: [String: CGFloat] = [:]

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
        setupExternalMouseListeners()
        bindStore()
        rebuildWorkspaceLayout()
    }

    public override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        let isCompactPhone = view.bounds.width < 600 && !store.isExternalDisplayConnected
        phoneSwitcherHeightConstraint.constant = isCompactPhone ? 32 : 0
        phoneSwitcherBar.isHidden = !isCompactPhone
        rebuildWorkspaceLayout()
        view.bringSubviewToFront(virtualCursorOverlay)
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

        let paletteBtn = makeChromeButton("⌘K", action: #selector(openCommandPalette))
        let splitH = makeChromeIconButton(systemName: "rectangle.split.2x1", title: "Split Vertically", action: #selector(splitHorizontalTapped))
        let splitV = makeChromeIconButton(systemName: "rectangle.split.1x2", title: "Split Horizontally", action: #selector(splitVerticalTapped))
        let swapBtn = makeChromeButton("Swap", action: #selector(swapPanesTapped))
        let maxBtn = makeChromeButton("Max", action: #selector(maximisePaneTapped))
        let hostsBtn = makeChromeButton("Hosts & Keys", action: #selector(openHostsTapped))
        let settingsBtn = makeChromeButton("⚙︎", action: #selector(openSettingsTapped))
        let shortcutsBtn = makeChromeIconButton(systemName: "keyboard", title: "Shortcuts (⌘/)", action: #selector(openKeyboardShortcutsTapped))

        workspaceSwitcherScrollView.translatesAutoresizingMaskIntoConstraints = false
        workspaceSwitcherScrollView.showsHorizontalScrollIndicator = false
        workspaceSwitcherScrollView.showsVerticalScrollIndicator = false
        workspaceSwitcherScrollView.heightAnchor.constraint(equalToConstant: 26).isActive = true

        workspaceSwitcherStack.translatesAutoresizingMaskIntoConstraints = false
        workspaceSwitcherStack.axis = .horizontal
        workspaceSwitcherStack.spacing = 4
        workspaceSwitcherStack.alignment = .center
        workspaceSwitcherScrollView.addSubview(workspaceSwitcherStack)

        NSLayoutConstraint.activate([
            workspaceSwitcherStack.topAnchor.constraint(equalTo: workspaceSwitcherScrollView.topAnchor),
            workspaceSwitcherStack.bottomAnchor.constraint(equalTo: workspaceSwitcherScrollView.bottomAnchor),
            workspaceSwitcherStack.leadingAnchor.constraint(equalTo: workspaceSwitcherScrollView.leadingAnchor),
            workspaceSwitcherStack.trailingAnchor.constraint(equalTo: workspaceSwitcherScrollView.trailingAnchor),
            workspaceSwitcherStack.heightAnchor.constraint(equalTo: workspaceSwitcherScrollView.heightAnchor),
        ])

        let spacer = UIView()
        let barStack = UIStackView(arrangedSubviews: [
            brandLabel, displayBadgeLabel,
            workspaceSwitcherScrollView,
            spacer,
            paletteBtn,
            preset1, preset2, preset3, preset4,
            splitH, splitV, swapBtn, maxBtn, hostsBtn, settingsBtn, shortcutsBtn
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

        bottomStatusHud.translatesAutoresizingMaskIntoConstraints = false

        view.addSubview(topBar)
        view.addSubview(phoneSwitcherBar)
        view.addSubview(workspaceCanvas)
        view.addSubview(bottomStatusHud)

        virtualCursorOverlay = VirtualCursorOverlayView(targetCanvas: view)
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
            workspaceCanvas.bottomAnchor.constraint(equalTo: bottomStatusHud.topAnchor),

            bottomStatusHud.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            bottomStatusHud.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            bottomStatusHud.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor),
            bottomStatusHud.heightAnchor.constraint(equalToConstant: 26),

            virtualCursorOverlay.topAnchor.constraint(equalTo: view.topAnchor),
            virtualCursorOverlay.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            virtualCursorOverlay.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            virtualCursorOverlay.bottomAnchor.constraint(equalTo: view.bottomAnchor),
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

    private func makeChromeIconButton(systemName: String, title: String? = nil, action: Selector) -> UIButton {
        let btn = UIButton(type: .system)
        let config = UIImage.SymbolConfiguration(pointSize: 12, weight: .semibold)
        btn.setImage(UIImage(systemName: systemName, withConfiguration: config), for: .normal)
        btn.tintColor = .white
        btn.backgroundColor = UIColor(white: 1.0, alpha: 0.08)
        btn.layer.cornerRadius = 4
        btn.translatesAutoresizingMaskIntoConstraints = false
        btn.widthAnchor.constraint(equalToConstant: 28).isActive = true
        btn.heightAnchor.constraint(equalToConstant: 22).isActive = true
        btn.addTarget(self, action: action, for: .touchUpInside)
        btn.accessibilityLabel = title
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

        store.$workspaces
            .receive(on: RunLoop.main)
            .sink { [weak self] _ in
                self?.updateWorkspaceSwitcher()
                self?.updateBottomStatusHud()
            }
            .store(in: &cancellables)

        store.$activeWorkspaceIndex
            .receive(on: RunLoop.main)
            .sink { [weak self] idx in
                guard let self else { return }
                self.updateWorkspaceSwitcher()
                if self.store.workspaces.indices.contains(idx) {
                    let name = self.store.workspaces[idx].name
                    WorkspaceToastBannerView.show(in: self.view, workspaceIndex: idx, workspaceName: name)
                }
                self.updateBottomStatusHud()
            }
            .store(in: &cancellables)
    }

    public func updateBottomStatusHud() {
        let wsIdx = store.activeWorkspaceIndex
        let wsName = store.activeWorkspace?.name ?? "Space \(wsIdx + 1)"
        let allPanes = store.panes
        let focusedPane = store.focusedPane
        let paneIdx = allPanes.firstIndex(where: { $0.id == focusedPane?.id }) ?? 0
        let activeTab = focusedPane?.tabs.first(where: { $0.id == focusedPane?.activeTabId })
        bottomStatusHud.update(
            workspaceIndex: wsIdx,
            workspaceName: wsName,
            paneIndex: paneIdx,
            totalPanes: allPanes.count,
            activeTab: activeTab,
            mode: currentInteractionMode
        )
    }

    private func updateWorkspaceSwitcher() {
        workspaceSwitcherStack.arrangedSubviews.forEach {
            workspaceSwitcherStack.removeArrangedSubview($0)
            $0.removeFromSuperview()
        }

        for (idx, ws) in store.workspaces.enumerated() {
            let isCurrent = (idx == store.activeWorkspaceIndex)
            let pillStack = UIStackView()
            pillStack.translatesAutoresizingMaskIntoConstraints = false
            pillStack.axis = .horizontal
            pillStack.spacing = 2
            pillStack.alignment = .center
            pillStack.backgroundColor = isCurrent ? UIColor(red: 0.22, green: 0.74, blue: 0.97, alpha: 0.22) : UIColor(white: 1.0, alpha: 0.08)
            pillStack.layer.cornerRadius = 6
            pillStack.layer.borderWidth = 1
            pillStack.layer.borderColor = isCurrent ? UIColor(red: 0.22, green: 0.74, blue: 0.97, alpha: 0.6).cgColor : UIColor(white: 1.0, alpha: 0.12).cgColor

            let btn = DesktopActionButton { [weak self] in
                self?.store.switchToWorkspace(at: idx)
            }
            btn.translatesAutoresizingMaskIntoConstraints = false

            var config = UIButton.Configuration.plain()
            config.title = ws.name
            config.contentInsets = NSDirectionalEdgeInsets(top: 2, leading: 8, bottom: 2, trailing: (store.workspaces.count > 1 ? 4 : 8))
            config.baseForegroundColor = isCurrent ? UIColor(red: 0.22, green: 0.74, blue: 0.97, alpha: 1.0) : UIColor(white: 0.85, alpha: 1.0)
            btn.configuration = config
            btn.titleLabel?.font = .systemFont(ofSize: 11, weight: isCurrent ? .bold : .medium)

            var menuElements: [UIMenuElement] = [
                UIAction(title: "Rename Space…", image: UIImage(systemName: "pencil")) { [weak self] _ in
                    self?.promptRenameWorkspace(at: idx)
                }
            ]
            if store.workspaces.count > 1 {
                menuElements.append(
                    UIAction(title: "Close Space", image: UIImage(systemName: "trash"), attributes: .destructive) { [weak self] _ in
                        self?.store.removeWorkspace(at: idx)
                    }
                )
            }
            btn.menu = UIMenu(title: ws.name, children: menuElements)
            btn.showsMenuAsPrimaryAction = false
            pillStack.addArrangedSubview(btn)

            if store.workspaces.count > 1 {
                let closeBtn = DesktopActionButton { [weak self] in
                    self?.store.removeWorkspace(at: idx)
                }
                closeBtn.translatesAutoresizingMaskIntoConstraints = false
                var closeCfg = UIButton.Configuration.plain()
                let imgCfg = UIImage.SymbolConfiguration(pointSize: 9, weight: .bold)
                closeCfg.image = UIImage(systemName: "xmark", withConfiguration: imgCfg)
                closeCfg.contentInsets = NSDirectionalEdgeInsets(top: 2, leading: 2, bottom: 2, trailing: 6)
                closeCfg.baseForegroundColor = isCurrent ? UIColor(red: 0.22, green: 0.74, blue: 0.97, alpha: 0.8) : UIColor(white: 0.6, alpha: 1.0)
                closeBtn.configuration = closeCfg
                pillStack.addArrangedSubview(closeBtn)
            }

            workspaceSwitcherStack.addArrangedSubview(pillStack)
        }

        // Add Space (+) button
        let addBtn = DesktopActionButton { [weak self] in
            self?.store.addWorkspace()
        }
        addBtn.translatesAutoresizingMaskIntoConstraints = false
        var addConfig = UIButton.Configuration.plain()
        addConfig.image = UIImage(systemName: "plus")
        addConfig.contentInsets = NSDirectionalEdgeInsets(top: 2, leading: 6, bottom: 2, trailing: 6)
        addConfig.baseForegroundColor = UIColor(red: 0.22, green: 0.74, blue: 0.97, alpha: 1.0)
        addBtn.configuration = addConfig
        addBtn.backgroundColor = UIColor(white: 1.0, alpha: 0.08)
        addBtn.layer.cornerRadius = 6
        addBtn.layer.borderWidth = 1
        addBtn.layer.borderColor = UIColor(white: 1.0, alpha: 0.12).cgColor
        workspaceSwitcherStack.addArrangedSubview(addBtn)
    }

    private func promptRenameWorkspace(at index: Int) {
        guard store.workspaces.indices.contains(index) else { return }
        let current = store.workspaces[index].name
        showDesktopDialog(
            title: "Rename Space",
            message: "Enter a new name for this workspace space:",
            actions: [
                DesktopAlertAction(title: "Cancel", style: .cancel),
                DesktopAlertAction(title: "Save", style: .default) { [weak self] newName in
                    guard let newName, !newName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
                    self?.store.renameWorkspace(at: index, newName: newName)
                }
            ],
            textFieldPlaceholder: "Space name",
            textFieldDefaultText: current
        )
    }

    // MARK: - Recursive Binary Split-Pane Renderer (PRD §7)

    private func rebuildWorkspaceLayout() {
        guard workspaceCanvas.bounds.width > 10, workspaceCanvas.bounds.height > 10 else { return }

        // If only the focused pane changed within an identical split/tab structure,
        // update the borders and headers in place WITHOUT recreating views or resetting scroll!
        if let last = lastRenderedTree,
           last.root == store.tree.root,
           last.maximisedPaneId == store.tree.maximisedPaneId,
           !workspaceCanvas.subviews.isEmpty {
            lastRenderedTree = store.tree
            updatePaneFocusVisuals()
            return
        }
        lastRenderedTree = store.tree

        // Prune controllers for closed tabs
        let allOpenTabIds = Set(store.panes.flatMap(\.tabs).map(\.id))
        for (tabId, vc) in tabControllers where !allOpenTabIds.contains(tabId) {
            vc.willMove(toParent: nil)
            vc.view.removeFromSuperview()
            vc.removeFromParent()
            tabControllers.removeValue(forKey: tabId)
        }

        recordTabStripOffsets(in: workspaceCanvas)
        for sub in workspaceCanvas.subviews {
            sub.removeFromSuperview()
        }
        activeSplitDrags.removeAll()
        renderedDividers.removeAll()

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

    private func recordTabStripOffsets(in root: UIView) {
        if let scroll = root as? UIScrollView, let id = scroll.accessibilityIdentifier, id.hasPrefix("tabstrip-") {
            tabStripOffsets[String(id.dropFirst("tabstrip-".count))] = scroll.contentOffset.x
            return
        }
        root.subviews.forEach(recordTabStripOffsets)
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
        divider.backgroundColor = UIColor(red: 0.15, green: 0.22, blue: 0.35, alpha: 1.0)
        divider.layer.cornerRadius = 2

        let grip = UIView()
        grip.translatesAutoresizingMaskIntoConstraints = false
        grip.backgroundColor = UIColor(red: 0.35, green: 0.60, blue: 0.90, alpha: 0.85)
        grip.layer.cornerRadius = 2
        divider.addSubview(grip)

        if split.direction == .horizontal {
            NSLayoutConstraint.activate([
                grip.centerXAnchor.constraint(equalTo: divider.centerXAnchor),
                grip.centerYAnchor.constraint(equalTo: divider.centerYAnchor),
                grip.widthAnchor.constraint(equalToConstant: 4),
                grip.heightAnchor.constraint(equalToConstant: 28),
            ])
        } else {
            NSLayoutConstraint.activate([
                grip.centerXAnchor.constraint(equalTo: divider.centerXAnchor),
                grip.centerYAnchor.constraint(equalTo: divider.centerYAnchor),
                grip.widthAnchor.constraint(equalToConstant: 28),
                grip.heightAnchor.constraint(equalToConstant: 4),
            ])
        }

        let pan = UIPanGestureRecognizer(target: self, action: #selector(handleDividerPan(_:)))
        divider.addGestureRecognizer(pan)
        activeSplitDrags[pan] = (splitId: split.id, direction: split.direction, containerBounds: parentRect)

        let divInfo = SplitDividerInfo(
            splitId: split.id,
            direction: split.direction,
            frame: workspaceCanvas.convert(frame, to: view),
            containerBounds: workspaceCanvas.convert(parentRect, to: view)
        )
        renderedDividers.append(divInfo)

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
        let tabHeader = PaneHeaderView(paneId: pane.id) { [weak self] in
            self?.store.focusPane(pane.id)
        }
        container.accessibilityIdentifier = pane.id

        // Pane Tab Bar Header (32pt)
        let tabBarHeight: CGFloat = 32
        tabHeader.frame = CGRect(x: 0, y: 0, width: container.bounds.width, height: tabBarHeight)
        tabHeader.backgroundColor = isFocused
            ? UIColor(red: 0.07, green: 0.12, blue: 0.22, alpha: 1.0)
            : UIColor(red: 0.04, green: 0.07, blue: 0.12, alpha: 1.0)
        tabHeader.accessibilityIdentifier = "header-\(pane.id)"

        let allPanes = store.panes
        let paneIdx = allPanes.firstIndex(where: { $0.id == pane.id }) ?? 0

        // Direct Pane Badge: ⌘1..4
        let badgeWidth: CGFloat = 36
        let paneBadgeBtn = DesktopActionButton { [weak self] in
            self?.store.focusPane(pane.id)
        }
        paneBadgeBtn.frame = CGRect(x: 4, y: 4, width: badgeWidth, height: 24)
        paneBadgeBtn.setTitle(" ⌘\(paneIdx + 1) ", for: .normal)
        paneBadgeBtn.titleLabel?.font = .monospacedSystemFont(ofSize: 10, weight: .bold)
        paneBadgeBtn.setTitleColor(isFocused ? UIColor(red: 0.22, green: 0.74, blue: 0.97, alpha: 1.0) : UIColor(white: 0.75, alpha: 1.0), for: .normal)
        paneBadgeBtn.backgroundColor = isFocused ? UIColor(red: 0.22, green: 0.74, blue: 0.97, alpha: 0.22) : UIColor(white: 1.0, alpha: 0.08)
        paneBadgeBtn.layer.cornerRadius = 3
        paneBadgeBtn.layer.borderWidth = 1
        paneBadgeBtn.layer.borderColor = isFocused ? UIColor(red: 0.22, green: 0.74, blue: 0.97, alpha: 0.6).cgColor : UIColor(white: 1.0, alpha: 0.12).cgColor
        tabHeader.addSubview(paneBadgeBtn)

        let rightControlsWidth: CGFloat = store.panes.count > 1 ? 58 : 30
        let scrollX = badgeWidth + 8
        let scrollWidth = max(20, container.bounds.width - rightControlsWidth - scrollX - 4)
        let scroll = UIScrollView(frame: CGRect(x: scrollX, y: 0, width: scrollWidth, height: tabBarHeight))
        scroll.showsHorizontalScrollIndicator = false
        scroll.contentInsetAdjustmentBehavior = .never
        scroll.accessibilityIdentifier = "tabstrip-\(pane.id)"

        var xOffset: CGFloat = 2
        var activePillFrame: CGRect?
        for (tabIdx, tab) in pane.tabs.enumerated() {
            let isActive = (tab.id == pane.activeTabId)
            let pill = TabPillView(paneId: pane.id, tabId: tab.id) { [weak self] in
                guard let self else { return }
                self.store.tree = PaneTreeOps.selectTab(self.store.tree, paneId: pane.id, tabId: tab.id)
            }
            pill.backgroundColor = isActive
                ? UIColor(red: 0.22, green: 0.74, blue: 0.97, alpha: 0.24)
                : UIColor(white: 1.0, alpha: 0.05)
            pill.layer.cornerRadius = 4

            let titleBtn = DesktopActionButton { [weak self] in
                guard let self else { return }
                self.store.tree = PaneTreeOps.selectTab(self.store.tree, paneId: pane.id, tabId: tab.id)
            }
            let tabNumBadge = (tabIdx < 9) ? "[\(tabIdx + 1)] " : ""
            titleBtn.setTitle("\(tabNumBadge)\(tab.title)", for: .normal)
            titleBtn.titleLabel?.font = .monospacedSystemFont(
                ofSize: 11,
                weight: (isActive && isFocused) ? .bold : .medium
            )
            titleBtn.setTitleColor(isActive ? .white : UIColor(white: 0.72, alpha: 1.0), for: .normal)

            let closeBtn = DesktopActionButton { [weak self] in
                self?.store.closeTab(paneId: pane.id, tabId: tab.id)
            }
            closeBtn.setTitle("×", for: .normal)
            closeBtn.titleLabel?.font = .systemFont(ofSize: 12, weight: .bold)
            closeBtn.setTitleColor(UIColor(white: 0.7, alpha: 1.0), for: .normal)

            let fullTitle = "\(tabNumBadge)\(tab.title)"
            let titleW = min(170, max(64, (fullTitle as NSString).size(withAttributes: [.font: UIFont.monospacedSystemFont(ofSize: 11, weight: .bold)]).width + 14))
            pill.frame = CGRect(x: xOffset, y: 4, width: titleW + 22, height: 24)
            titleBtn.frame = CGRect(x: 4, y: 0, width: titleW - 4, height: 24)
            closeBtn.frame = CGRect(x: titleW, y: 0, width: 20, height: 24)

            pill.addSubview(titleBtn)
            pill.addSubview(closeBtn)
            scroll.addSubview(pill)
            if isActive { activePillFrame = pill.frame }
            xOffset += pill.frame.width + 4
        }
        scroll.contentSize = CGSize(width: xOffset + 4, height: tabBarHeight)
        // Rebuilds used to reset the strip to the start, so tabs past its edge could never be clicked.
        let maxOffset = max(0, scroll.contentSize.width - scroll.bounds.width)
        var stripOffset = min(max(0, tabStripOffsets[pane.id] ?? 0), maxOffset)
        if let active = activePillFrame {
            if active.maxX > stripOffset + scroll.bounds.width { stripOffset = min(maxOffset, active.maxX + 4 - scroll.bounds.width) }
            if active.minX < stripOffset { stripOffset = max(0, active.minX - 2) }
        }
        scroll.contentOffset = CGPoint(x: stripOffset, y: 0)
        tabHeader.addSubview(scroll)

        // Single + button with drop-down menu & Close Pane button on right side of pane header
        let rightControls = UIStackView()
        rightControls.axis = .horizontal
        rightControls.spacing = 3
        rightControls.alignment = .center
        rightControls.frame = CGRect(x: max(0, container.bounds.width - rightControlsWidth - 4), y: 2, width: rightControlsWidth, height: 28)

        let addTabBtn = DesktopActionButton { [weak self] in
            self?.store.openTab(type: .web, inPaneId: pane.id)
        }
        let plusConfig = UIImage.SymbolConfiguration(pointSize: 11, weight: .bold)
        addTabBtn.setImage(UIImage(systemName: "plus", withConfiguration: plusConfig), for: .normal)
        addTabBtn.tintColor = UIColor(red: 0.22, green: 0.74, blue: 0.97, alpha: 1.0)
        addTabBtn.backgroundColor = UIColor(white: 1.0, alpha: 0.08)
        addTabBtn.layer.cornerRadius = 3
        addTabBtn.showsMenuAsPrimaryAction = true
        addTabBtn.accessibilityLabel = "New Tab (⌘T)"
        addTabBtn.menu = UIMenu(title: "New Tab (⌘T)", children: [
            UIAction(title: "Web Browser", image: UIImage(systemName: "globe")) { [weak self] _ in
                self?.store.openTab(type: .web, inPaneId: pane.id)
            },
            UIAction(title: "SSH Terminal", image: UIImage(systemName: "terminal.fill")) { [weak self] _ in
                self?.store.openTab(type: .ssh, inPaneId: pane.id)
            },
            UIAction(title: "File Explorer", image: UIImage(systemName: "folder.fill")) { [weak self] _ in
                self?.store.openTab(type: .files, inPaneId: pane.id)
            }
        ])
        addTabBtn.frame = CGRect(x: 0, y: 0, width: 24, height: 22)
        rightControls.addArrangedSubview(addTabBtn)

        if store.panes.count > 1 {
            let closePaneBtn = DesktopActionButton { [weak self] in
                self?.store.closePane(pane.id)
            }
            closePaneBtn.setTitle("✕", for: .normal)
            closePaneBtn.titleLabel?.font = .systemFont(ofSize: 10, weight: .bold)
            closePaneBtn.setTitleColor(.systemRed, for: .normal)
            closePaneBtn.accessibilityLabel = "Close Pane (⌘⇧W)"
            rightControls.addArrangedSubview(closePaneBtn)
        }

        tabHeader.addSubview(rightControls)
        container.addSubview(tabHeader)

        // Empty Pane Deck OR Active Tab Content View
        if pane.tabs.isEmpty {
            let emptyDeck = PaneEmptyDeckView(frame: CGRect(
                x: 0,
                y: tabBarHeight,
                width: container.bounds.width,
                height: max(10, container.bounds.height - tabBarHeight)
            ))
            emptyDeck.autoresizingMask = [.flexibleWidth, .flexibleHeight]
            emptyDeck.onSelectType = { [weak self] type in
                self?.store.openTab(type: type, inPaneId: pane.id)
            }
            container.addSubview(emptyDeck)
        } else if let activeTab = pane.activeTab {
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

        // Visual Swap Target Overlay
        if currentInteractionMode == .swap && !isFocused {
            let swapOverlay = PaneSwapTargetOverlayView(targetPaneId: pane.id, directionHint: "Pane \(paneIdx + 1)")
            swapOverlay.frame = container.bounds
            swapOverlay.autoresizingMask = [.flexibleWidth, .flexibleHeight]
            swapOverlay.onSelect = { [weak self] targetId in
                guard let self else { return }
                self.store.swapPanes(self.store.tree.focusedPaneId, targetId)
                self.returnToNormalMode()
            }
            container.addSubview(swapOverlay)
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
        if let hId = gesture.view?.accessibilityIdentifier {
            let pId = hId.replacingOccurrences(of: "header-", with: "")
            store.focusPane(pId)
        }
    }

    private func updatePaneFocusVisuals() {
        let focusedId = store.tree.focusedPaneId
        func updateContainerRecursively(_ v: UIView) {
            if let pId = v.accessibilityIdentifier, !pId.hasPrefix("header-") {
                let isFocused = (pId == focusedId)
                v.layer.borderWidth = isFocused ? 2.0 : 1.0
                v.layer.borderColor = isFocused
                    ? UIColor(red: 0.22, green: 0.74, blue: 0.97, alpha: 1.0).cgColor
                    : UIColor(white: 1.0, alpha: 0.12).cgColor
            }
            if let hId = v.accessibilityIdentifier, hId.hasPrefix("header-") {
                let pId = String(hId.dropFirst("header-".count))
                let isFocused = (pId == focusedId)
                v.backgroundColor = isFocused
                    ? UIColor(red: 0.07, green: 0.12, blue: 0.22, alpha: 1.0)
                    : UIColor(red: 0.04, green: 0.07, blue: 0.12, alpha: 1.0)
            }
            for sub in v.subviews {
                updateContainerRecursively(sub)
            }
        }
        updateContainerRecursively(workspaceCanvas)

        for (idx, v) in phoneSwitcherStack.arrangedSubviews.enumerated() {
            if let btn = v as? UIButton, idx < store.panes.count {
                let isFocused = (store.panes[idx].id == focusedId)
                btn.backgroundColor = isFocused
                    ? UIColor(red: 0.22, green: 0.74, blue: 0.97, alpha: 0.35)
                    : UIColor(white: 1.0, alpha: 0.07)
                btn.titleLabel?.font = .monospacedSystemFont(
                    ofSize: 11,
                    weight: isFocused ? .bold : .regular
                )
            }
        }
    }

    // MARK: - External Input & Cursor Routing

    public var activeTabController: UIViewController? {
        guard let focused = store.focusedPane, let activeTab = focused.activeTab else { return nil }
        return tabControllers[activeTab.id]
    }

    public func routeKeyInput(_ text: String) {
        if let palette = activeCommandPalette {
            palette.handleKeyInput(text)
            return
        }
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
        if let palette = activeCommandPalette {
            switch key {
            case .enter:
                palette.executeSelectedItem()
                return
            case .escape:
                palette.dismissPalette()
                return
            case .up:
                palette.selectPreviousItem()
                return
            case .down:
                palette.selectNextItem()
                return
            default:
                break
            }
        }
        if let dialog = activeDialog {
            switch key {
            case .enter:
                dialog.triggerPrimaryAction()
                return
            case .escape:
                dialog.triggerCancelAction()
                return
            default:
                break
            }
        }
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

    public func setCursorNormalizedPosition(x: CGFloat, y: CGFloat, isDragHeld: Bool = false) {
        let monWidth = max(1, view.bounds.width)
        let monHeight = max(1, view.bounds.height)
        let targetPt = CGPoint(x: x * monWidth, y: y * monHeight)
        virtualCursorOverlay?.setCursorPosition(targetPt)

        guard let overlay = virtualCursorOverlay else { return }
        if activeCommandPalette != nil || activeDialog != nil {
            overlay.resetDefaultCursor()
            return
        }

        if isDragHeld {
            if let drag = activeDragSplit {
                let rawRatio: Double
                if drag.direction == .horizontal {
                    rawRatio = Double((targetPt.x - drag.containerBounds.minX) / max(1, drag.containerBounds.width))
                } else {
                    rawRatio = Double((targetPt.y - drag.containerBounds.minY) / max(1, drag.containerBounds.height))
                }
                store.tree = PaneTreeOps.updateSplitRatio(store.tree, splitId: drag.splitId, ratio: rawRatio)
            } else {
                if let hit = renderedDividers.first(where: { $0.frame.insetBy(dx: -15, dy: -15).contains(targetPt) }) {
                    activeDragSplit = hit
                    overlay.setResizeCursor(direction: hit.direction)
                }
            }
        } else {
            activeDragSplit = nil
            updateDividerHoverState(at: targetPt)
        }
    }

    public func handleCursorPan(delta: CGVector, isDragHeld: Bool) {
        virtualCursorOverlay?.move(by: delta)
        guard let overlay = virtualCursorOverlay else { return }
        let cursorPt = overlay.cursorPosition

        if activeCommandPalette != nil || activeDialog != nil {
            overlay.resetDefaultCursor()
            return
        }

        if isDragHeld {
            if let drag = activeDragSplit {
                let rawRatio: Double
                if drag.direction == .horizontal {
                    rawRatio = Double((cursorPt.x - drag.containerBounds.minX) / max(1, drag.containerBounds.width))
                } else {
                    rawRatio = Double((cursorPt.y - drag.containerBounds.minY) / max(1, drag.containerBounds.height))
                }
                store.tree = PaneTreeOps.updateSplitRatio(store.tree, splitId: drag.splitId, ratio: rawRatio)
            } else {
                // Check if drag starts near any divider (generous 30pt hit area)
                if let hit = renderedDividers.first(where: { $0.frame.insetBy(dx: -15, dy: -15).contains(cursorPt) }) {
                    activeDragSplit = hit
                    overlay.setResizeCursor(direction: hit.direction)
                }
            }
        } else {
            activeDragSplit = nil
            updateDividerHoverState(at: cursorPt)
        }
    }

    private func updateDividerHoverState(at cursorPt: CGPoint) {
        guard let overlay = virtualCursorOverlay else { return }
        if activeCommandPalette != nil || activeDialog != nil {
            overlay.resetDefaultCursor()
            return
        }
        if let hover = renderedDividers.first(where: { $0.frame.insetBy(dx: -15, dy: -15).contains(cursorPt) }) {
            overlay.setResizeCursor(direction: hover.direction)
        } else {
            overlay.resetDefaultCursor()
        }
    }

    // MARK: - Native Desktop Modal Dialog (PRD §4, §12)

    public func showDesktopDialog(
        title: String,
        message: String?,
        actions: [DesktopAlertAction],
        textFieldPlaceholder: String? = nil,
        textFieldDefaultText: String? = nil,
        isSecureTextEntry: Bool = false
    ) {
        activeDialog?.removeFromSuperview()

        let dialog = DesktopDialogView(
            title: title,
            message: message,
            actions: actions,
            textFieldPlaceholder: textFieldPlaceholder,
            textFieldDefaultText: textFieldDefaultText,
            isSecureTextEntry: isSecureTextEntry
        )
        dialog.translatesAutoresizingMaskIntoConstraints = false
        dialog.onDismiss = { [weak self] in
            self?.activeDialog = nil
        }
        self.activeDialog = dialog
        view.addSubview(dialog)

        NSLayoutConstraint.activate([
            dialog.topAnchor.constraint(equalTo: view.topAnchor),
            dialog.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            dialog.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            dialog.bottomAnchor.constraint(equalTo: view.bottomAnchor),
        ])

        // Ensure cursor is always in front of the dialog
        view.bringSubviewToFront(virtualCursorOverlay)
    }

    // MARK: - Top Bar Actions

    @objc internal func presetSingleTapped() { store.applyPreset(.single) }
    @objc internal func presetTwoColTapped() { store.applyPreset(.twoColumn) }
    @objc internal func presetLeftTwoRightTapped() { store.applyPreset(.leftPlusTwoRight) }
    @objc internal func presetGridTapped() { store.applyPreset(.twoByTwo) }
    @objc internal func splitHorizontalTapped() { store.splitFocusedPane(.horizontal) }
    @objc internal func splitVerticalTapped() { store.splitFocusedPane(.vertical) }
    @objc internal func swapPanesTapped() { store.swapFocusedWithNext() }
    @objc internal func maximisePaneTapped() { store.toggleMaximiseFocusedPane() }

    public func dismissAllModals() {
        activeHostsModal?.dismissModal()
        activeSettingsModal?.dismissModal()
        activeShortcutsModal?.dismissModal()
        activeCommandPalette?.dismissPalette()
        activeDialog?.dismissDialog()
    }

    @objc public func openHostsTapped() {
        if let modal = activeHostsModal {
            modal.dismissModal()
            return
        }
        dismissAllModals()
        let modal = DesktopHostsModalView(store: store) { [weak self] host in
            self?.store.openTab(type: .ssh, hostId: host.id)
        }
        modal.translatesAutoresizingMaskIntoConstraints = false
        modal.onDismiss = { [weak self] in
            self?.activeHostsModal = nil
        }
        self.activeHostsModal = modal
        view.addSubview(modal)

        NSLayoutConstraint.activate([
            modal.topAnchor.constraint(equalTo: view.topAnchor),
            modal.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            modal.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            modal.bottomAnchor.constraint(equalTo: view.bottomAnchor),
        ])

        view.bringSubviewToFront(virtualCursorOverlay)
    }

    @objc public func openSettingsTapped() {
        if let modal = activeSettingsModal {
            modal.dismissModal()
            return
        }
        dismissAllModals()
        let modal = DesktopSettingsModalView(store: store, onDismiss: { [weak self] in
            self?.activeSettingsModal = nil
        }, onOpenShortcuts: { [weak self] in
            self?.openKeyboardShortcutsTapped()
        })
        modal.translatesAutoresizingMaskIntoConstraints = false
        self.activeSettingsModal = modal
        view.addSubview(modal)

        NSLayoutConstraint.activate([
            modal.topAnchor.constraint(equalTo: view.topAnchor),
            modal.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            modal.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            modal.bottomAnchor.constraint(equalTo: view.bottomAnchor),
        ])

        view.bringSubviewToFront(virtualCursorOverlay)
    }

    @objc public func openKeyboardShortcutsTapped() {
        if let modal = activeShortcutsModal {
            modal.dismissModal()
            return
        }
        dismissAllModals()
        let modal = DesktopShortcutsModalView(onDismiss: { [weak self] in
            self?.activeShortcutsModal = nil
        })
        modal.translatesAutoresizingMaskIntoConstraints = false
        self.activeShortcutsModal = modal
        view.addSubview(modal)

        NSLayoutConstraint.activate([
            modal.topAnchor.constraint(equalTo: view.topAnchor),
            modal.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            modal.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            modal.bottomAnchor.constraint(equalTo: view.bottomAnchor),
        ])

        view.bringSubviewToFront(virtualCursorOverlay)
    }

    @objc public func openCommandPalette() {
        if let palette = activeCommandPalette {
            palette.dismissPalette()
            return
        }
        dismissAllModals()
        let palette = CommandPaletteView(store: store, workspaceVC: self, tabSearchOnly: false)
        palette.translatesAutoresizingMaskIntoConstraints = false
        palette.onDismiss = { [weak self] in
            self?.activeCommandPalette = nil
        }
        self.activeCommandPalette = palette
        view.addSubview(palette)

        NSLayoutConstraint.activate([
            palette.topAnchor.constraint(equalTo: view.topAnchor),
            palette.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            palette.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            palette.bottomAnchor.constraint(equalTo: view.bottomAnchor),
        ])

        view.bringSubviewToFront(virtualCursorOverlay)
    }

    @objc public func openTabPalette() {
        if let palette = activeCommandPalette {
            palette.dismissPalette()
            return
        }
        dismissAllModals()
        let palette = CommandPaletteView(store: store, workspaceVC: self, tabSearchOnly: true)
        palette.translatesAutoresizingMaskIntoConstraints = false
        palette.onDismiss = { [weak self] in
            self?.activeCommandPalette = nil
        }
        self.activeCommandPalette = palette
        view.addSubview(palette)

        NSLayoutConstraint.activate([
            palette.topAnchor.constraint(equalTo: view.topAnchor),
            palette.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            palette.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            palette.bottomAnchor.constraint(equalTo: view.bottomAnchor),
        ])

        view.bringSubviewToFront(virtualCursorOverlay)
    }

    // MARK: - Interactive Mode Handlers (Leader, Resize, Swap, Tab Switcher)

    @objc public func enterResizeMode() {
        returnToNormalMode()
        currentInteractionMode = .resize
        let hud = ResizeHudOverlayView()
        hud.translatesAutoresizingMaskIntoConstraints = false
        if let focusedId = store.focusedPane?.id,
           let split = PaneTreeOps.findParentSplit(store.tree.root, childPaneId: focusedId) {
            hud.updateRatio(split.ratio)
        } else {
            hud.updateRatio(0.5)
        }
        view.addSubview(hud)
        NSLayoutConstraint.activate([
            hud.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 44),
            hud.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            hud.heightAnchor.constraint(equalToConstant: 34),
        ])
        self.activeResizeHud = hud
        updateBottomStatusHud()
        view.bringSubviewToFront(virtualCursorOverlay)
    }

    public func updateResizeHud() {
        guard let hud = activeResizeHud else { return }
        if let focusedId = store.focusedPane?.id,
           let split = PaneTreeOps.findParentSplit(store.tree.root, childPaneId: focusedId) {
            hud.updateRatio(split.ratio)
        }
        updateBottomStatusHud()
    }

    @objc public func enterSwapMode() {
        returnToNormalMode()
        currentInteractionMode = .swap
        rebuildWorkspaceLayout()
        updateBottomStatusHud()
    }

    public func enterLeaderMode() {
        returnToNormalMode()
        currentInteractionMode = .leader
        updateBottomStatusHud()
    }

    public func returnToNormalMode() {
        let prev = currentInteractionMode
        currentInteractionMode = .normal
        activeResizeHud?.removeFromSuperview()
        activeResizeHud = nil
        activeTabSwitcher?.removeFromSuperview()
        activeTabSwitcher = nil
        if prev == .swap {
            rebuildWorkspaceLayout()
        }
        updateBottomStatusHud()
    }

    public func showTabSwitcher(reverse: Bool = false) {
        if let existing = activeTabSwitcher {
            existing.step(reverse: reverse)
            return
        }
        guard let focused = store.focusedPane, !focused.tabs.isEmpty else { return }
        let currentIdx = focused.tabs.firstIndex(where: { $0.id == focused.activeTabId }) ?? 0
        let switcher = TabSwitcherOverlayView(tabs: focused.tabs, initialIndex: currentIdx)
        switcher.translatesAutoresizingMaskIntoConstraints = false
        switcher.onSelect = { [weak self] idx in
            guard let self else { return }
            self.store.selectTabAtIndex(idx)
            self.activeTabSwitcher = nil
        }
        switcher.onDismiss = { [weak self] in
            self?.activeTabSwitcher = nil
        }
        self.activeTabSwitcher = switcher
        view.addSubview(switcher)
        NSLayoutConstraint.activate([
            switcher.topAnchor.constraint(equalTo: view.topAnchor),
            switcher.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            switcher.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            switcher.bottomAnchor.constraint(equalTo: view.bottomAnchor),
        ])
        switcher.step(reverse: reverse)
        view.bringSubviewToFront(virtualCursorOverlay)
    }

    public override func pressesBegan(_ presses: Set<UIPress>, with event: UIPressesEvent?) {
        for press in presses {
            if GlobalShortcutDispatcher.handlePress(press: press, store: store, workspaceVC: self) {
                return
            }
        }

        if let palette = activeCommandPalette {
            for press in presses {
                guard let key = press.key else { continue }
                switch key.keyCode {
                case .keyboardEscape:
                    palette.dismissPalette()
                    return
                case .keyboardReturnOrEnter:
                    palette.executeSelectedItem()
                    return
                case .keyboardUpArrow:
                    palette.selectPreviousItem()
                    return
                case .keyboardDownArrow:
                    palette.selectNextItem()
                    return
                case .keyboardDeleteOrBackspace:
                    palette.handleKeyInput("\u{7F}")
                    return
                default:
                    if !key.characters.isEmpty && !key.modifierFlags.contains(.command) && !key.modifierFlags.contains(.control) {
                        palette.handleKeyInput(key.characters)
                        return
                    }
                }
            }
            return
        }

        var handled = false
        for press in presses {
            guard let key = press.key else { continue }
            switch key.keyCode {
            case .keyboardReturnOrEnter:
                routeSpecialKey(.enter)
                handled = true
            case .keyboardEscape:
                routeSpecialKey(.escape)
                handled = true
            case .keyboardTab:
                routeSpecialKey(.tab)
                handled = true
            case .keyboardDeleteOrBackspace:
                routeKeyInput("\u{7F}")
                handled = true
            case .keyboardF6:
                store.cyclePanes(reverse: key.modifierFlags.contains(.shift))
                handled = true
            case .keyboardUpArrow:
                routeSpecialKey(.up)
                handled = true
            case .keyboardDownArrow:
                routeSpecialKey(.down)
                handled = true
            case .keyboardLeftArrow:
                routeSpecialKey(.left)
                handled = true
            case .keyboardRightArrow:
                routeSpecialKey(.right)
                handled = true
            default:
                if !key.characters.isEmpty {
                    routeKeyInput(key.characters)
                    handled = true
                }
            }
        }
        if !handled {
            super.pressesBegan(presses, with: event)
        }
    }

    public func activeWebTabController() -> WebTabViewController? {
        guard let active = store.focusedPane?.activeTab else { return nil }
        return tabControllers[active.id] as? WebTabViewController
    }

    public func activeSshTabController() -> SshTabViewController? {
        guard let active = store.focusedPane?.activeTab else { return nil }
        return tabControllers[active.id] as? SshTabViewController
    }

    // MARK: - Direct External Display Mouse & Trackpad Listeners

    private func setupExternalMouseListeners() {
        let hover = UIHoverGestureRecognizer(target: self, action: #selector(handleExternalHover(_:)))
        view.addGestureRecognizer(hover)

        let pan = UIPanGestureRecognizer(target: self, action: #selector(handleExternalPan(_:)))
        pan.allowedScrollTypesMask = [.continuous]
        view.addGestureRecognizer(pan)

        let tap = UITapGestureRecognizer(target: self, action: #selector(handleExternalTap(_:)))
        tap.cancelsTouchesInView = false
        view.addGestureRecognizer(tap)
    }

    @objc private func handleExternalHover(_ gesture: UIHoverGestureRecognizer) {
        let pt = gesture.location(in: view)
        virtualCursorOverlay?.setCursorPosition(pt)
        updateDividerHoverState(at: pt)
    }

    @objc private func handleExternalPan(_ gesture: UIPanGestureRecognizer) {
        let translation = gesture.translation(in: view)
        performVirtualScroll(deltaX: -translation.x * 0.8, deltaY: -translation.y * 0.8)
        gesture.setTranslation(.zero, in: view)
    }

    @objc private func handleExternalTap(_ gesture: UITapGestureRecognizer) {
        let pt = gesture.location(in: view)
        virtualCursorOverlay?.setCursorPosition(pt)
        virtualCursorOverlay?.performClick()
    }

    // MARK: - Hardware Keyboard Shortcuts & Terminal Precedence (PRD §13.1, §13.2)

    public override var keyCommands: [UIKeyCommand]? {
        var cmds = GlobalShortcutDispatcher.buildKeyCommands(target: self)

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
        }

        return cmds
    }

    @objc internal func closeFocusedPaneKey() { store.closePane() }
    @objc private func focusLeftKey() { store.focusDirectional(.left) }
    @objc private func focusRightKey() { store.focusDirectional(.right) }
    @objc private func focusUpKey() { store.focusDirectional(.up) }
    @objc private func focusDownKey() { store.focusDirectional(.down) }
    @objc private func shrinkSplitKey() { store.tree = PaneTreeOps.adjustParentSplitRatio(store.tree, delta: -0.05) }
    @objc private func growSplitKey() { store.tree = PaneTreeOps.adjustParentSplitRatio(store.tree, delta: 0.05) }
    @objc internal func newTabKey() { store.openTab(type: .web) }
    @objc internal func nextWorkspaceKey() { store.nextWorkspace() }
    @objc internal func prevWorkspaceKey() { store.prevWorkspace() }
    @objc internal func closeActiveTabKey() { store.closeTab() }
    @objc private func nextTabKey() { store.tree = PaneTreeOps.selectNextTab(store.tree, reverse: false) }
    @objc private func prevTabKey() { store.tree = PaneTreeOps.selectNextTab(store.tree, reverse: true) }
    @objc internal func cycleNextPaneKey() { store.cyclePanes(reverse: false) }
    @objc internal func cyclePrevPaneKey() { store.cyclePanes(reverse: true) }
    @objc internal func newWorkspaceKey() { store.addWorkspace() }
    @objc internal func closeActiveWorkspaceKey() {
        guard store.workspaces.count > 1 else { return }
        store.removeWorkspace(at: store.activeWorkspaceIndex)
    }

    @objc internal func jumpToWorkspace1() { store.switchToWorkspace(at: 0) }
    @objc internal func jumpToWorkspace2() { store.switchToWorkspace(at: 1) }
    @objc internal func jumpToWorkspace3() { store.switchToWorkspace(at: 2) }
    @objc internal func jumpToWorkspace4() { store.switchToWorkspace(at: 3) }

    @objc internal func jumpToPane1() { store.focusPaneIndex(0) }
    @objc internal func jumpToPane2() { store.focusPaneIndex(1) }
    @objc internal func jumpToPane3() { store.focusPaneIndex(2) }
    @objc internal func jumpToPane4() { store.focusPaneIndex(3) }
    @objc internal func focusPreviousPaneKey() { store.focusPreviousPane() }

    @objc internal func jumpToTab1() { store.selectTabAtIndex(0) }
    @objc internal func jumpToTab2() { store.selectTabAtIndex(1) }
    @objc internal func jumpToTab3() { store.selectTabAtIndex(2) }
    @objc internal func jumpToTab4() { store.selectTabAtIndex(3) }
    @objc internal func jumpToTab5() { store.selectTabAtIndex(4) }
    @objc internal func jumpToTab6() { store.selectTabAtIndex(5) }
    @objc internal func jumpToTab7() { store.selectTabAtIndex(6) }
    @objc internal func jumpToTab8() { store.selectTabAtIndex(7) }
    @objc internal func jumpToTab9() { store.selectTabAtIndex(8) }

    @objc private func dismissModalKey() { dismissAllModals() }

    @objc internal func focusAddressBarKey() {
        if let active = store.focusedPane?.activeTab,
           let webVC = tabControllers[active.id] as? WebTabViewController {
            webVC.focusAddressBar()
        }
    }

    @objc internal func reloadWebKey() {
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

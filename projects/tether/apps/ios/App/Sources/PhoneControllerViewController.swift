import Combine
import GameController
import SwiftUI
import TetherKit
import UIKit

/// Dedicated Phone Controller for External Monitor Sessions (PRD §4, §12).
/// When an external monitor is attached:
/// - The external monitor renders the full tiling split-pane desktop workspace.
/// - The phone does NOT mirror the workspace; instead it acts as:
///   1. Smooth Trackpad (1-finger move/click, 2-finger scroll, tap-hold drag, optional click buttons).
///   2. Developer Keyboard (iOS software keyboard + Esc, Tab, Ctrl, Alt, ^C, ^D, arrows).
///   3. Workspace & Settings Manager (launch URLs, manage hosts & keys, switch layouts).
///   4. Dock Hardware Bridge (captures physical USB/Bluetooth keyboard and mouse from dock).
///
/// Forced landscape orientation with vertical icon-only sidebar (left or right side configurable).
@MainActor
public final class PhoneControllerViewController: UIViewController, UITextFieldDelegate, UIKeyInput {
    public enum ControllerMode: Int {
        case touchpad = 0
        case keyboard = 1
        case settings = 2
    }

    private let store: WorkspaceStore
    private weak var workspaceVC: TilingWorkspaceViewController?
    private var cancellables: Set<AnyCancellable> = []

    private var currentMode: ControllerMode = .touchpad
    private var hasDetectedPhysicalKeyboard: Bool = false

    // UI Structure
    private let verticalSidebar = UIView()
    private let sidebarScrollView = UIScrollView()
    private let sidebarStack = UIStackView()
    private let statusDot = UIView()
    private let touchpadTabBtn = UIButton(type: .system)
    private let keyboardTabBtn = UIButton(type: .system)
    private let settingsTabBtn = UIButton(type: .system)
    private let containerView = UIView()

    private var activeSidebarConstraints: [NSLayoutConstraint] = []
    private var activeTouchpadConstraints: [NSLayoutConstraint] = []

    // Touchpad Mode views
    private let touchpadView = UIView()
    private let touchpadSurface = UIView()
    private let touchpadHelpLabel = UILabel()
    private let mappingModeSegment = UISegmentedControl(items: ["Full Monitor 1:1", "Relative Trackpad"])
    private let assistiveTouchButton = UIButton(type: .system)
    private let clickButtonsStack = UIStackView()
    private let leftClickButton = UIButton(type: .system)
    private let dragResizeButton = UIButton(type: .system)
    private let rightClickButton = UIButton(type: .system)

    private var isDragModeActive: Bool = false
    private var isHoldingLeftClick: Bool = false
    private var edgePushTimer: CADisplayLink?
    private var edgePushDirection: CGVector = .zero
    private var registeredMice: Set<GCMouse> = []

    // Keyboard Mode views
    private let keyboardContainer = UIView()
    private let hiddenInputTextField = UITextField()
    private let activePaneLabel = UILabel()
    private let accessoryBar = UIStackView()

    // Settings Mode views
    private let settingsScrollView = UIScrollView()
    private let settingsStack = UIStackView()
    private let urlTextField = UITextField()
    private let openUrlButton = UIButton(type: .system)
    private let sidebarPosSegment = UISegmentedControl(items: ["Left Side", "Right Side"])
    private let orientationSegment = UISegmentedControl(items: ["Landscape", "Portrait", "Flipped"])
    private let showButtonsSwitch = UISwitch()
    private let settingsMappingModeSegment = UISegmentedControl(items: ["Full Monitor 1:1", "Relative"])
    private let edgePushSwitch = UISwitch()
    private let sensitivitySlider = UISlider()
    private let sensitivityValueLabel = UILabel()

    // Touchpad gesture tracking
    private var lastPanLocation: CGPoint = .zero

    public init(store: WorkspaceStore, workspaceVC: TilingWorkspaceViewController?) {
        self.store = store
        self.workspaceVC = workspaceVC
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    public override var canBecomeFirstResponder: Bool {
        true
    }

    public override var prefersPointerLocked: Bool {
        currentMode == .touchpad
    }

    // MARK: - Orientation Lock & Toggling (PRD §4, §12)

    public override var supportedInterfaceOrientations: UIInterfaceOrientationMask {
        DisplayHost.shared.supportedOrientations
    }

    public override var preferredInterfaceOrientationForPresentation: UIInterfaceOrientation {
        switch store.settings.controllerOrientation {
        case .landscape: return .landscapeRight
        case .landscapeFlipped: return .landscapeLeft
        case .portrait: return .portrait
        case .auto: return .landscapeRight
        }
    }

    public func applyOrientationChange(_ orientation: ControllerOrientation) {
        if #available(iOS 16.0, *) {
            setNeedsUpdateOfSupportedInterfaceOrientations()
            let mask: UIInterfaceOrientationMask
            switch orientation {
            case .landscape: mask = .landscapeRight
            case .landscapeFlipped: mask = .landscapeLeft
            case .portrait: mask = .portrait
            case .auto: mask = [.landscapeLeft, .landscapeRight, .portrait]
            }
            if let windowScene = view.window?.windowScene ?? UIApplication.shared.connectedScenes.compactMap({ $0 as? UIWindowScene }).first(where: { $0.session.role == .windowApplication }) {
                windowScene.requestGeometryUpdate(.iOS(interfaceOrientations: mask))
            }
        }
        applySidebarLayoutConstraints()
    }

    public func toggleOrientation() {
        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        let next: ControllerOrientation = (store.settings.controllerOrientation == .landscape) ? .portrait : .landscape
        store.settings.controllerOrientation = next
        applyOrientationChange(next)
    }

    // MARK: - UIKeyInput Protocol (Captures Physical Dock Keyboard & Software Input)

    public var hasText: Bool {
        true
    }

    public func insertText(_ text: String) {
        workspaceVC?.routeKeyInput(text)
    }

    public func deleteBackward() {
        workspaceVC?.routeKeyInput("\u{7F}")
    }

    public override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 0.04, green: 0.06, blue: 0.10, alpha: 1.0)

        setupVerticalSidebar()
        setupTouchpadView()
        setupKeyboardMode()
        setupSettingsMode()
        setupDockMouseListeners()
        setupHardwareKeyboardListeners()
        bindStore()
        showMode(.touchpad)
        updateTouchpadButtonsVisibility()
    }

    public override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        applyOrientationChange(store.settings.controllerOrientation)
    }

    public override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        becomeFirstResponder()
    }

    private func bindStore() {
        store.$externalDisplayDescription
            .receive(on: RunLoop.main)
            .sink { [weak self] _ in
                self?.updateStatusDot()
            }
            .store(in: &cancellables)

        store.$tree
            .receive(on: RunLoop.main)
            .sink { [weak self] _ in
                self?.updateActivePaneIndicator()
            }
            .store(in: &cancellables)

        store.$settings
            .receive(on: RunLoop.main)
            .sink { [weak self] _ in
                self?.applySidebarLayoutConstraints()
                self?.updateTouchpadButtonsVisibility()
                self?.syncSettingsControls()
            }
            .store(in: &cancellables)
    }

    private func updateStatusDot() {
        let isConnected = store.isExternalDisplayConnected
        statusDot.backgroundColor = isConnected
            ? UIColor(red: 0.20, green: 0.83, blue: 0.60, alpha: 1.0)
            : UIColor(red: 0.95, green: 0.60, blue: 0.20, alpha: 1.0)
    }

    private func updateActivePaneIndicator() {
        if let focused = store.focusedPane, let active = focused.activeTab {
            activePaneLabel.text = "Target: [\(active.type.displayName.uppercased())] \(active.title)"
        } else {
            activePaneLabel.text = "Target: Active Workspace Pane"
        }
    }

    // MARK: - Vertical Icon-Only Sidebar (PRD §4, §12)

    private func setupVerticalSidebar() {
        verticalSidebar.translatesAutoresizingMaskIntoConstraints = false
        verticalSidebar.backgroundColor = UIColor(red: 0.06, green: 0.08, blue: 0.14, alpha: 1.0)
        verticalSidebar.layer.borderWidth = 1
        verticalSidebar.layer.borderColor = UIColor(white: 1.0, alpha: 0.08).cgColor

        statusDot.translatesAutoresizingMaskIntoConstraints = false
        statusDot.backgroundColor = UIColor(red: 0.20, green: 0.83, blue: 0.60, alpha: 1.0)
        statusDot.layer.cornerRadius = 4
        statusDot.clipsToBounds = true

        sidebarStack.translatesAutoresizingMaskIntoConstraints = false
        sidebarStack.axis = .vertical
        sidebarStack.alignment = .center
        sidebarStack.spacing = 10

        configureTabButton(touchpadTabBtn, systemName: "hand.point.up.left.fill", mode: .touchpad)
        configureTabButton(keyboardTabBtn, systemName: "keyboard.fill", mode: .keyboard)
        configureTabButton(settingsTabBtn, systemName: "gearshape.fill", mode: .settings)

        let divider = UIView()
        divider.translatesAutoresizingMaskIntoConstraints = false
        divider.backgroundColor = UIColor(white: 1.0, alpha: 0.12)
        divider.widthAnchor.constraint(equalToConstant: 24).isActive = true
        divider.heightAnchor.constraint(equalToConstant: 1).isActive = true

        let paletteBtn = makeSidebarActionButton(systemName: "command") { [weak self] in
            self?.workspaceVC?.openCommandPalette()
        }
        let rotateBtn = makeSidebarActionButton(systemName: "rectangle.landscape.rotate") { [weak self] in
            self?.toggleOrientation()
        }

        let webBtn = makeSidebarActionButton(systemName: "globe") { [weak self] in
            self?.store.openTab(type: .web)
        }
        let sshBtn = makeSidebarActionButton(systemName: "terminal.fill") { [weak self] in
            self?.store.openTab(type: .ssh)
        }
        let filesBtn = makeSidebarActionButton(systemName: "folder.fill") { [weak self] in
            self?.store.openTab(type: .files)
        }

        let layoutBtn = UIButton(type: .system)
        layoutBtn.translatesAutoresizingMaskIntoConstraints = false
        let config = UIImage.SymbolConfiguration(pointSize: 17, weight: .semibold)
        layoutBtn.setImage(UIImage(systemName: "square.split.2x2", withConfiguration: config), for: .normal)
        layoutBtn.tintColor = UIColor(white: 1.0, alpha: 0.75)
        layoutBtn.backgroundColor = UIColor(white: 1.0, alpha: 0.06)
        layoutBtn.layer.cornerRadius = 8
        layoutBtn.widthAnchor.constraint(equalToConstant: 38).isActive = true
        layoutBtn.heightAnchor.constraint(equalToConstant: 38).isActive = true
        layoutBtn.showsMenuAsPrimaryAction = true
        layoutBtn.menu = UIMenu(title: "Monitor Split Layout", children: [
            UIAction(title: "Single Pane", image: UIImage(systemName: "rectangle")) { [weak self] _ in
                self?.store.applyPreset(.single)
            },
            UIAction(title: "2-Pane Split", image: UIImage(systemName: "rectangle.split.2x1")) { [weak self] _ in
                self?.store.applyPreset(.twoColumn)
            },
            UIAction(title: "1 + 2 Split", image: UIImage(systemName: "rectangle.split.3x1")) { [weak self] _ in
                self?.store.applyPreset(.leftPlusTwoRight)
            },
            UIAction(title: "2 × 2 Grid", image: UIImage(systemName: "rectangle.split.2x2")) { [weak self] _ in
                self?.store.applyPreset(.twoByTwo)
            },
        ])

        sidebarStack.addArrangedSubview(statusDot)
        sidebarStack.setCustomSpacing(10, after: statusDot)
        sidebarStack.addArrangedSubview(touchpadTabBtn)
        sidebarStack.addArrangedSubview(keyboardTabBtn)
        sidebarStack.addArrangedSubview(settingsTabBtn)
        sidebarStack.addArrangedSubview(divider)
        sidebarStack.addArrangedSubview(paletteBtn)
        sidebarStack.addArrangedSubview(rotateBtn)
        sidebarStack.addArrangedSubview(webBtn)
        sidebarStack.addArrangedSubview(sshBtn)
        sidebarStack.addArrangedSubview(filesBtn)
        sidebarStack.addArrangedSubview(layoutBtn)

        sidebarScrollView.translatesAutoresizingMaskIntoConstraints = false
        sidebarScrollView.showsVerticalScrollIndicator = false
        sidebarScrollView.showsHorizontalScrollIndicator = false
        sidebarScrollView.alwaysBounceVertical = true
        sidebarScrollView.contentInsetAdjustmentBehavior = .never

        verticalSidebar.addSubview(sidebarScrollView)
        sidebarScrollView.addSubview(sidebarStack)
        containerView.translatesAutoresizingMaskIntoConstraints = false

        view.addSubview(verticalSidebar)
        view.addSubview(containerView)

        NSLayoutConstraint.activate([
            statusDot.widthAnchor.constraint(equalToConstant: 8),
            statusDot.heightAnchor.constraint(equalToConstant: 8),

            sidebarScrollView.topAnchor.constraint(equalTo: verticalSidebar.safeAreaLayoutGuide.topAnchor),
            sidebarScrollView.leadingAnchor.constraint(equalTo: verticalSidebar.leadingAnchor),
            sidebarScrollView.trailingAnchor.constraint(equalTo: verticalSidebar.trailingAnchor),
            sidebarScrollView.bottomAnchor.constraint(equalTo: verticalSidebar.safeAreaLayoutGuide.bottomAnchor),

            sidebarStack.topAnchor.constraint(equalTo: sidebarScrollView.contentLayoutGuide.topAnchor, constant: 10),
            sidebarStack.leadingAnchor.constraint(equalTo: sidebarScrollView.contentLayoutGuide.leadingAnchor),
            sidebarStack.trailingAnchor.constraint(equalTo: sidebarScrollView.contentLayoutGuide.trailingAnchor),
            sidebarStack.bottomAnchor.constraint(equalTo: sidebarScrollView.contentLayoutGuide.bottomAnchor, constant: -10),
            sidebarStack.widthAnchor.constraint(equalTo: sidebarScrollView.frameLayoutGuide.widthAnchor),
        ])

        applySidebarLayoutConstraints()
    }

    private func configureTabButton(_ btn: UIButton, systemName: String, mode: ControllerMode) {
        btn.translatesAutoresizingMaskIntoConstraints = false
        let config = UIImage.SymbolConfiguration(pointSize: 18, weight: .semibold)
        btn.setImage(UIImage(systemName: systemName, withConfiguration: config), for: .normal)
        btn.layer.cornerRadius = 8
        btn.widthAnchor.constraint(equalToConstant: 40).isActive = true
        btn.heightAnchor.constraint(equalToConstant: 40).isActive = true
        btn.addAction(UIAction { [weak self] _ in
            UISelectionFeedbackGenerator().selectionChanged()
            self?.showMode(mode)
        }, for: .touchUpInside)
    }

    private func makeSidebarActionButton(systemName: String, action: @escaping () -> Void) -> UIButton {
        let btn = UIButton(type: .system)
        btn.translatesAutoresizingMaskIntoConstraints = false
        let config = UIImage.SymbolConfiguration(pointSize: 16, weight: .medium)
        btn.setImage(UIImage(systemName: systemName, withConfiguration: config), for: .normal)
        btn.tintColor = UIColor(white: 1.0, alpha: 0.70)
        btn.backgroundColor = UIColor(white: 1.0, alpha: 0.06)
        btn.layer.cornerRadius = 8
        btn.widthAnchor.constraint(equalToConstant: 38).isActive = true
        btn.heightAnchor.constraint(equalToConstant: 38).isActive = true
        btn.addAction(UIAction { _ in
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
            action()
        }, for: .touchUpInside)
        return btn
    }

    private func applySidebarLayoutConstraints() {
        NSLayoutConstraint.deactivate(activeSidebarConstraints)
        activeSidebarConstraints.removeAll()

        let pos = store.settings.controllerSidebarPosition
        if pos == .left {
            activeSidebarConstraints = [
                verticalSidebar.topAnchor.constraint(equalTo: view.topAnchor),
                verticalSidebar.bottomAnchor.constraint(equalTo: view.bottomAnchor),
                verticalSidebar.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor),
                verticalSidebar.widthAnchor.constraint(equalToConstant: 52),

                containerView.topAnchor.constraint(equalTo: view.topAnchor),
                containerView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
                containerView.leadingAnchor.constraint(equalTo: verticalSidebar.trailingAnchor),
                containerView.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor),
            ]
        } else {
            activeSidebarConstraints = [
                verticalSidebar.topAnchor.constraint(equalTo: view.topAnchor),
                verticalSidebar.bottomAnchor.constraint(equalTo: view.bottomAnchor),
                verticalSidebar.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor),
                verticalSidebar.widthAnchor.constraint(equalToConstant: 52),

                containerView.topAnchor.constraint(equalTo: view.topAnchor),
                containerView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
                containerView.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor),
                containerView.trailingAnchor.constraint(equalTo: verticalSidebar.leadingAnchor),
            ]
        }
        NSLayoutConstraint.activate(activeSidebarConstraints)
        view.layoutIfNeeded()
    }

    private func updateTabButtonSelection() {
        let tabs: [(UIButton, ControllerMode)] = [
            (touchpadTabBtn, .touchpad),
            (keyboardTabBtn, .keyboard),
            (settingsTabBtn, .settings)
        ]
        for (btn, mode) in tabs {
            if mode == currentMode {
                btn.backgroundColor = UIColor(red: 0.22, green: 0.74, blue: 0.97, alpha: 0.28)
                btn.tintColor = UIColor(red: 0.22, green: 0.74, blue: 0.97, alpha: 1.0)
            } else {
                btn.backgroundColor = .clear
                btn.tintColor = UIColor(white: 1.0, alpha: 0.6)
            }
        }
    }

    private func showMode(_ mode: ControllerMode) {
        currentMode = mode
        updateTabButtonSelection()

        touchpadView.isHidden = (mode != .touchpad)
        keyboardContainer.isHidden = (mode != .keyboard)
        settingsScrollView.isHidden = (mode != .settings)

        if #available(iOS 14.0, *) {
            setNeedsUpdateOfPrefersPointerLocked()
        }

        switch mode {
        case .touchpad:
            hiddenInputTextField.resignFirstResponder()
            becomeFirstResponder()
        case .keyboard:
            stopEdgePush()
            hiddenInputTextField.becomeFirstResponder()
        case .settings:
            stopEdgePush()
            hiddenInputTextField.resignFirstResponder()
        }
    }

    // MARK: - Mode 1: Glass Touchpad

    private func setupTouchpadView() {
        touchpadView.translatesAutoresizingMaskIntoConstraints = false
        containerView.addSubview(touchpadView)

        touchpadSurface.translatesAutoresizingMaskIntoConstraints = false
        touchpadSurface.backgroundColor = UIColor(red: 0.06, green: 0.08, blue: 0.13, alpha: 1.0)
        touchpadSurface.layer.cornerRadius = 14
        touchpadSurface.layer.borderWidth = 1.5
        touchpadSurface.layer.borderColor = UIColor(red: 0.22, green: 0.74, blue: 0.97, alpha: 0.25).cgColor

        // 1-finger move & 2-finger scroll recognizers on touchpad
        let panGesture = UIPanGestureRecognizer(target: self, action: #selector(handleTouchpadPan(_:)))
        panGesture.maximumNumberOfTouches = 2
        touchpadSurface.addGestureRecognizer(panGesture)

        let tapGesture = UITapGestureRecognizer(target: self, action: #selector(handleTouchpadTap(_:)))
        touchpadSurface.addGestureRecognizer(tapGesture)

        let twoFingerTap = UITapGestureRecognizer(target: self, action: #selector(handleTouchpadTwoFingerTap(_:)))
        twoFingerTap.numberOfTouchesRequired = 2
        touchpadSurface.addGestureRecognizer(twoFingerTap)
        tapGesture.require(toFail: twoFingerTap)

        // Long press for drag without buttons
        let longPress = UILongPressGestureRecognizer(target: self, action: #selector(handleTouchpadLongPress(_:)))
        longPress.minimumPressDuration = 0.26
        touchpadSurface.addGestureRecognizer(longPress)

        touchpadHelpLabel.translatesAutoresizingMaskIntoConstraints = false
        touchpadHelpLabel.numberOfLines = 2
        touchpadHelpLabel.textAlignment = .center
        touchpadHelpLabel.textColor = UIColor(white: 1.0, alpha: 0.45)
        touchpadHelpLabel.font = .systemFont(ofSize: 12, weight: .medium)
        touchpadSurface.addSubview(touchpadHelpLabel)

        mappingModeSegment.translatesAutoresizingMaskIntoConstraints = false
        mappingModeSegment.selectedSegmentIndex = store.settings.touchpadMappingMode == .fullDisplay ? 0 : 1
        mappingModeSegment.backgroundColor = UIColor(white: 1.0, alpha: 0.08)
        mappingModeSegment.selectedSegmentTintColor = UIColor(red: 0.22, green: 0.74, blue: 0.97, alpha: 0.35)
        mappingModeSegment.setTitleTextAttributes([.foregroundColor: UIColor.white, .font: UIFont.systemFont(ofSize: 11, weight: .semibold)], for: .normal)
        mappingModeSegment.setTitleTextAttributes([.foregroundColor: UIColor.white, .font: UIFont.systemFont(ofSize: 11, weight: .bold)], for: .selected)
        mappingModeSegment.addTarget(self, action: #selector(handleMappingModeChanged(_:)), for: .valueChanged)
        touchpadSurface.addSubview(mappingModeSegment)

        assistiveTouchButton.translatesAutoresizingMaskIntoConstraints = false
        var btnConfig = UIButton.Configuration.plain()
        btnConfig.image = UIImage(systemName: "computermouse.fill")
        btnConfig.title = "Physical Mouse & AssistiveTouch Guide"
        btnConfig.imagePadding = 6
        btnConfig.contentInsets = NSDirectionalEdgeInsets(top: 4, leading: 10, bottom: 4, trailing: 12)
        btnConfig.baseForegroundColor = UIColor(red: 0.22, green: 0.74, blue: 0.97, alpha: 1.0)
        assistiveTouchButton.configuration = btnConfig
        assistiveTouchButton.backgroundColor = UIColor(white: 1.0, alpha: 0.08)
        assistiveTouchButton.layer.cornerRadius = 14
        assistiveTouchButton.layer.borderWidth = 1
        assistiveTouchButton.layer.borderColor = UIColor(white: 1.0, alpha: 0.12).cgColor
        assistiveTouchButton.addTarget(self, action: #selector(openAssistiveTouchGuideModal), for: .touchUpInside)
        touchpadSurface.addSubview(assistiveTouchButton)

        // Optional bottom action buttons (controlled by settings.showTouchpadButtons)
        leftClickButton.translatesAutoresizingMaskIntoConstraints = false
        leftClickButton.setTitle("Left Click", for: .normal)
        leftClickButton.titleLabel?.font = .systemFont(ofSize: 13, weight: .bold)
        leftClickButton.backgroundColor = UIColor(red: 0.10, green: 0.14, blue: 0.22, alpha: 1.0)
        leftClickButton.setTitleColor(.white, for: .normal)
        leftClickButton.layer.cornerRadius = 8
        leftClickButton.layer.borderWidth = 1
        leftClickButton.layer.borderColor = UIColor(white: 1.0, alpha: 0.15).cgColor
        leftClickButton.addTarget(self, action: #selector(handleLeftClickDown), for: .touchDown)
        leftClickButton.addTarget(self, action: #selector(handleLeftClickUp), for: [.touchUpInside, .touchUpOutside])

        dragResizeButton.translatesAutoresizingMaskIntoConstraints = false
        dragResizeButton.setTitle("↔ Resize", for: .normal)
        dragResizeButton.titleLabel?.font = .systemFont(ofSize: 13, weight: .bold)
        dragResizeButton.backgroundColor = UIColor(red: 0.12, green: 0.17, blue: 0.28, alpha: 1.0)
        dragResizeButton.setTitleColor(.white, for: .normal)
        dragResizeButton.layer.cornerRadius = 8
        dragResizeButton.layer.borderWidth = 1
        dragResizeButton.layer.borderColor = UIColor(white: 1.0, alpha: 0.15).cgColor
        dragResizeButton.addTarget(self, action: #selector(handleDragResizeToggled), for: .touchUpInside)

        rightClickButton.translatesAutoresizingMaskIntoConstraints = false
        rightClickButton.setTitle("Right Click", for: .normal)
        rightClickButton.titleLabel?.font = .systemFont(ofSize: 13, weight: .bold)
        rightClickButton.backgroundColor = UIColor(red: 0.10, green: 0.14, blue: 0.22, alpha: 1.0)
        rightClickButton.setTitleColor(.white, for: .normal)
        rightClickButton.layer.cornerRadius = 8
        rightClickButton.layer.borderWidth = 1
        rightClickButton.layer.borderColor = UIColor(white: 1.0, alpha: 0.15).cgColor
        rightClickButton.addTarget(self, action: #selector(handleRightClickTapped), for: .touchUpInside)

        clickButtonsStack.translatesAutoresizingMaskIntoConstraints = false
        clickButtonsStack.axis = .horizontal
        clickButtonsStack.distribution = .fillEqually
        clickButtonsStack.spacing = 8
        clickButtonsStack.addArrangedSubview(leftClickButton)
        clickButtonsStack.addArrangedSubview(dragResizeButton)
        clickButtonsStack.addArrangedSubview(rightClickButton)

        touchpadView.addSubview(touchpadSurface)
        touchpadView.addSubview(clickButtonsStack)

        NSLayoutConstraint.activate([
            touchpadView.topAnchor.constraint(equalTo: containerView.topAnchor),
            touchpadView.leadingAnchor.constraint(equalTo: containerView.leadingAnchor),
            touchpadView.trailingAnchor.constraint(equalTo: containerView.trailingAnchor),
            touchpadView.bottomAnchor.constraint(equalTo: containerView.bottomAnchor),

            touchpadSurface.topAnchor.constraint(equalTo: touchpadView.topAnchor, constant: 10),
            touchpadSurface.leadingAnchor.constraint(equalTo: touchpadView.leadingAnchor, constant: 12),
            touchpadSurface.trailingAnchor.constraint(equalTo: touchpadView.trailingAnchor, constant: -12),

            touchpadHelpLabel.centerXAnchor.constraint(equalTo: touchpadSurface.centerXAnchor),
            touchpadHelpLabel.centerYAnchor.constraint(equalTo: touchpadSurface.centerYAnchor, constant: -32),
            touchpadHelpLabel.leadingAnchor.constraint(greaterThanOrEqualTo: touchpadSurface.leadingAnchor, constant: 16),
            touchpadHelpLabel.trailingAnchor.constraint(lessThanOrEqualTo: touchpadSurface.trailingAnchor, constant: -16),

            mappingModeSegment.centerXAnchor.constraint(equalTo: touchpadSurface.centerXAnchor),
            mappingModeSegment.topAnchor.constraint(equalTo: touchpadHelpLabel.bottomAnchor, constant: 12),
            mappingModeSegment.heightAnchor.constraint(equalToConstant: 28),

            assistiveTouchButton.centerXAnchor.constraint(equalTo: touchpadSurface.centerXAnchor),
            assistiveTouchButton.topAnchor.constraint(equalTo: mappingModeSegment.bottomAnchor, constant: 10),
            assistiveTouchButton.heightAnchor.constraint(equalToConstant: 28),
        ])

        updateTouchpadHelpText()
        updateTouchpadButtonsVisibility()
    }

    private func updateTouchpadHelpText() {
        if store.settings.touchpadMappingMode == .fullDisplay {
            touchpadHelpLabel.text = "🎯 Full Monitor 1:1: Entire phone maps directly to external monitor\nTap: Click • Press & Hold: Drag • 2-Finger: Scroll"
        } else {
            touchpadHelpLabel.text = "🖱️ Relative Trackpad: Touch edges for continuous travel\nTap: Click • Press & Hold: Drag • 2-Finger: Scroll"
        }
    }

    @objc private func handleMappingModeChanged(_ sender: UISegmentedControl) {
        let mode: TouchpadMappingMode = sender.selectedSegmentIndex == 0 ? .fullDisplay : .relative
        store.settings.touchpadMappingMode = mode
        settingsMappingModeSegment.selectedSegmentIndex = sender.selectedSegmentIndex
        updateTouchpadHelpText()
        stopEdgePush()
    }

    // MARK: - Edge Continuous Travel (Edge Push)

    private func checkEdgeContinuousPush(at point: CGPoint, in bounds: CGRect) {
        guard store.settings.edgeContinuousPush, store.settings.touchpadMappingMode == .relative else {
            stopEdgePush()
            return
        }

        let margin: CGFloat = 28.0
        var dx: CGFloat = 0
        var dy: CGFloat = 0

        if point.x <= margin {
            dx = -1.0 * (1.0 - max(0, point.x) / margin)
        } else if point.x >= bounds.width - margin {
            dx = 1.0 * (1.0 - max(0, bounds.width - point.x) / margin)
        }

        if point.y <= margin {
            dy = -1.0 * (1.0 - max(0, point.y) / margin)
        } else if point.y >= bounds.height - margin {
            dy = 1.0 * (1.0 - max(0, bounds.height - point.y) / margin)
        }

        if abs(dx) > 0.05 || abs(dy) > 0.05 {
            startEdgePush(direction: CGVector(dx: dx, dy: dy))
        } else {
            stopEdgePush()
        }
    }

    private func startEdgePush(direction: CGVector) {
        edgePushDirection = direction
        guard edgePushTimer == nil else { return }
        let link = CADisplayLink(target: self, selector: #selector(handleEdgePushTick))
        link.add(to: .main, forMode: .common)
        edgePushTimer = link
    }

    private func stopEdgePush() {
        edgePushTimer?.invalidate()
        edgePushTimer = nil
        edgePushDirection = .zero
    }

    @objc private func handleEdgePushTick() {
        guard edgePushDirection != .zero else {
            stopEdgePush()
            return
        }
        let baseSpeed: CGFloat = 16.0 * CGFloat(store.settings.pointerSensitivity)
        let delta = CGVector(
            dx: edgePushDirection.dx * baseSpeed,
            dy: edgePushDirection.dy * baseSpeed
        )
        let isDragging = isDragModeActive || isHoldingLeftClick
        workspaceVC?.handleCursorPan(delta: delta, isDragHeld: isDragging)
    }

    private func updateTouchpadButtonsVisibility() {
        let show = store.settings.showTouchpadButtons
        clickButtonsStack.isHidden = !show

        NSLayoutConstraint.deactivate(activeTouchpadConstraints)
        activeTouchpadConstraints.removeAll()

        if show {
            activeTouchpadConstraints = [
                touchpadSurface.bottomAnchor.constraint(equalTo: clickButtonsStack.topAnchor, constant: -8),
                clickButtonsStack.leadingAnchor.constraint(equalTo: touchpadView.leadingAnchor, constant: 12),
                clickButtonsStack.trailingAnchor.constraint(equalTo: touchpadView.trailingAnchor, constant: -12),
                clickButtonsStack.bottomAnchor.constraint(equalTo: touchpadView.safeAreaLayoutGuide.bottomAnchor, constant: -10),
                clickButtonsStack.heightAnchor.constraint(equalToConstant: 38),
            ]
        } else {
            activeTouchpadConstraints = [
                touchpadSurface.bottomAnchor.constraint(equalTo: touchpadView.safeAreaLayoutGuide.bottomAnchor, constant: -10),
            ]
        }
        NSLayoutConstraint.activate(activeTouchpadConstraints)
        touchpadView.layoutIfNeeded()
    }

    @objc private func handleTouchpadPan(_ gesture: UIPanGestureRecognizer) {
        let surfaceBounds = touchpadSurface.bounds
        guard surfaceBounds.width > 0, surfaceBounds.height > 0 else { return }

        if gesture.numberOfTouches == 2 {
            stopEdgePush()
            let translation = gesture.translation(in: touchpadSurface)
            workspaceVC?.performVirtualScroll(deltaX: -translation.x * 0.8, deltaY: -translation.y * 0.8)
            gesture.setTranslation(.zero, in: touchpadSurface)
            return
        }

        let isDragging = isDragModeActive || isHoldingLeftClick

        if store.settings.touchpadMappingMode == .fullDisplay {
            stopEdgePush()
            let loc = gesture.location(in: touchpadSurface)
            let normX = max(0.0, min(1.0, loc.x / surfaceBounds.width))
            let normY = max(0.0, min(1.0, loc.y / surfaceBounds.height))
            workspaceVC?.setCursorNormalizedPosition(x: normX, y: normY, isDragHeld: isDragging)
        } else {
            let translation = gesture.translation(in: touchpadSurface)
            let speed = CGFloat(store.settings.pointerSensitivity)
            let delta = CGVector(dx: translation.x * speed, dy: translation.y * speed)
            workspaceVC?.handleCursorPan(delta: delta, isDragHeld: isDragging)
            gesture.setTranslation(.zero, in: touchpadSurface)

            let loc = gesture.location(in: touchpadSurface)
            if gesture.state == .ended || gesture.state == .cancelled || gesture.state == .failed {
                stopEdgePush()
            } else {
                checkEdgeContinuousPush(at: loc, in: surfaceBounds)
            }
        }
    }

    @objc private func handleTouchpadTap(_ gesture: UITapGestureRecognizer) {
        stopEdgePush()
        if store.settings.touchpadMappingMode == .fullDisplay {
            let surfaceBounds = touchpadSurface.bounds
            if surfaceBounds.width > 0 && surfaceBounds.height > 0 {
                let loc = gesture.location(in: touchpadSurface)
                let normX = max(0.0, min(1.0, loc.x / surfaceBounds.width))
                let normY = max(0.0, min(1.0, loc.y / surfaceBounds.height))
                workspaceVC?.setCursorNormalizedPosition(x: normX, y: normY, isDragHeld: false)
            }
        }
        workspaceVC?.performVirtualClick()
    }

    @objc private func handleTouchpadTwoFingerTap(_ gesture: UITapGestureRecognizer) {
        workspaceVC?.routeSpecialKey(.escape)
    }

    @objc private func handleTouchpadLongPress(_ gesture: UILongPressGestureRecognizer) {
        switch gesture.state {
        case .began:
            isHoldingLeftClick = true
            UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        case .ended, .cancelled, .failed:
            isHoldingLeftClick = false
        default:
            break
        }
    }

    @objc private func handleLeftClickDown() {
        isHoldingLeftClick = true
        leftClickButton.backgroundColor = UIColor(red: 0.22, green: 0.74, blue: 0.97, alpha: 0.4)
    }

    @objc private func handleLeftClickUp() {
        isHoldingLeftClick = false
        leftClickButton.backgroundColor = UIColor(red: 0.10, green: 0.14, blue: 0.22, alpha: 1.0)
        workspaceVC?.performVirtualClick()
    }

    @objc private func handleDragResizeToggled() {
        isDragModeActive.toggle()
        if isDragModeActive {
            dragResizeButton.backgroundColor = UIColor(red: 0.22, green: 0.74, blue: 0.97, alpha: 0.9)
            dragResizeButton.setTitleColor(.black, for: .normal)
            dragResizeButton.setTitle("✓ Lock", for: .normal)
        } else {
            dragResizeButton.backgroundColor = UIColor(red: 0.12, green: 0.17, blue: 0.28, alpha: 1.0)
            dragResizeButton.setTitleColor(.white, for: .normal)
            dragResizeButton.setTitle("↔ Resize", for: .normal)
        }
    }

    @objc private func handleRightClickTapped() {
        workspaceVC?.routeSpecialKey(.escape)
    }

    public func switchToKeyboardForInput(placeholder: String) {
        // If a physical keyboard is connected via dock USB or Bluetooth,
        // do not interrupt the user or switch away from touchpad mode!
        if hasDetectedPhysicalKeyboard || GCKeyboard.coalesced != nil {
            return
        }
        activePaneLabel.text = "⌨️ Focused: \(placeholder)"
        showMode(.keyboard)
    }

    // MARK: - Mode 2: Keyboard & Developer Keypad

    private func setupKeyboardMode() {
        keyboardContainer.translatesAutoresizingMaskIntoConstraints = false
        containerView.addSubview(keyboardContainer)

        activePaneLabel.translatesAutoresizingMaskIntoConstraints = false
        activePaneLabel.font = .monospacedSystemFont(ofSize: 12, weight: .bold)
        activePaneLabel.textColor = UIColor(red: 0.22, green: 0.74, blue: 0.97, alpha: 1.0)
        activePaneLabel.textAlignment = .center
        updateActivePaneIndicator()

        // Custom Developer Keypad Grid
        let devKeysContainer = buildDeveloperKeypad()
        devKeysContainer.translatesAutoresizingMaskIntoConstraints = false

        // Hidden input field that captures software keyboard events
        hiddenInputTextField.translatesAutoresizingMaskIntoConstraints = false
        hiddenInputTextField.delegate = self
        hiddenInputTextField.autocorrectionType = .no
        hiddenInputTextField.autocapitalizationType = .none
        hiddenInputTextField.spellCheckingType = .no
        hiddenInputTextField.smartDashesType = .no
        hiddenInputTextField.smartQuotesType = .no
        hiddenInputTextField.smartInsertDeleteType = .no
        hiddenInputTextField.keyboardAppearance = .dark
        hiddenInputTextField.backgroundColor = UIColor(red: 0.07, green: 0.10, blue: 0.16, alpha: 1.0)
        hiddenInputTextField.textColor = .white
        hiddenInputTextField.font = .monospacedSystemFont(ofSize: 13, weight: .regular)
        hiddenInputTextField.layer.cornerRadius = 8
        hiddenInputTextField.layer.borderWidth = 1
        hiddenInputTextField.layer.borderColor = UIColor(white: 1.0, alpha: 0.15).cgColor
        hiddenInputTextField.placeholder = "Tap here to type on external monitor…"
        hiddenInputTextField.leftView = UIView(frame: CGRect(x: 0, y: 0, width: 10, height: 1))
        hiddenInputTextField.leftViewMode = .always

        let switchToTouchpadBtn = UIButton(type: .system)
        switchToTouchpadBtn.translatesAutoresizingMaskIntoConstraints = false
        switchToTouchpadBtn.setTitle("🖱️ Return to Touchpad", for: .normal)
        switchToTouchpadBtn.titleLabel?.font = .systemFont(ofSize: 13, weight: .bold)
        switchToTouchpadBtn.setTitleColor(.white, for: .normal)
        switchToTouchpadBtn.backgroundColor = UIColor(red: 0.12, green: 0.16, blue: 0.26, alpha: 1.0)
        switchToTouchpadBtn.layer.cornerRadius = 8
        switchToTouchpadBtn.addTarget(self, action: #selector(switchToTouchpadTapped), for: .touchUpInside)

        keyboardContainer.addSubview(activePaneLabel)
        keyboardContainer.addSubview(hiddenInputTextField)
        keyboardContainer.addSubview(devKeysContainer)
        keyboardContainer.addSubview(switchToTouchpadBtn)

        NSLayoutConstraint.activate([
            keyboardContainer.topAnchor.constraint(equalTo: containerView.topAnchor),
            keyboardContainer.leadingAnchor.constraint(equalTo: containerView.leadingAnchor),
            keyboardContainer.trailingAnchor.constraint(equalTo: containerView.trailingAnchor),
            keyboardContainer.bottomAnchor.constraint(equalTo: containerView.bottomAnchor),

            activePaneLabel.topAnchor.constraint(equalTo: keyboardContainer.topAnchor, constant: 8),
            activePaneLabel.leadingAnchor.constraint(equalTo: keyboardContainer.leadingAnchor, constant: 14),
            activePaneLabel.trailingAnchor.constraint(equalTo: keyboardContainer.trailingAnchor, constant: -14),

            hiddenInputTextField.topAnchor.constraint(equalTo: activePaneLabel.bottomAnchor, constant: 6),
            hiddenInputTextField.leadingAnchor.constraint(equalTo: keyboardContainer.leadingAnchor, constant: 14),
            hiddenInputTextField.trailingAnchor.constraint(equalTo: keyboardContainer.trailingAnchor, constant: -14),
            hiddenInputTextField.heightAnchor.constraint(equalToConstant: 36),

            devKeysContainer.topAnchor.constraint(equalTo: hiddenInputTextField.bottomAnchor, constant: 8),
            devKeysContainer.leadingAnchor.constraint(equalTo: keyboardContainer.leadingAnchor, constant: 14),
            devKeysContainer.trailingAnchor.constraint(equalTo: keyboardContainer.trailingAnchor, constant: -14),

            switchToTouchpadBtn.leadingAnchor.constraint(equalTo: keyboardContainer.leadingAnchor, constant: 14),
            switchToTouchpadBtn.trailingAnchor.constraint(equalTo: keyboardContainer.trailingAnchor, constant: -14),
            switchToTouchpadBtn.bottomAnchor.constraint(equalTo: keyboardContainer.safeAreaLayoutGuide.bottomAnchor, constant: -8),
            switchToTouchpadBtn.heightAnchor.constraint(equalToConstant: 34),
        ])
    }

    private func buildDeveloperKeypad() -> UIView {
        let container = UIStackView()
        container.axis = .vertical
        container.spacing = 6
        container.distribution = .fillEqually

        let row1Keys = ["Esc", "Tab", "Ctrl+C", "Ctrl+D", "Ctrl+L", "/", "-"]
        let row2Keys = ["|", "~", ":", "↑", "↓", "←", "→", "Enter"]

        let r1Stack = makeKeyRow(keys: row1Keys)
        let r2Stack = makeKeyRow(keys: row2Keys)

        container.addArrangedSubview(r1Stack)
        container.addArrangedSubview(r2Stack)
        return container
    }

    private func makeKeyRow(keys: [String]) -> UIStackView {
        let stack = UIStackView()
        stack.axis = .horizontal
        stack.spacing = 6
        stack.distribution = .fillEqually

        for key in keys {
            let btn = UIButton(type: .system)
            btn.setTitle(key, for: .normal)
            btn.titleLabel?.font = .monospacedSystemFont(ofSize: 12, weight: .bold)
            btn.setTitleColor(.white, for: .normal)
            btn.backgroundColor = UIColor(red: 0.11, green: 0.15, blue: 0.24, alpha: 1.0)
            btn.layer.cornerRadius = 6
            btn.layer.borderWidth = 1
            btn.layer.borderColor = UIColor(white: 1.0, alpha: 0.12).cgColor
            btn.heightAnchor.constraint(equalToConstant: 34).isActive = true
            btn.addAction(UIAction { [weak self] _ in
                self?.handleDeveloperKey(key)
            }, for: .touchUpInside)
            stack.addArrangedSubview(btn)
        }
        return stack
    }

    private func handleDeveloperKey(_ key: String) {
        switch key {
        case "Esc":
            workspaceVC?.routeSpecialKey(.escape)
        case "Tab":
            workspaceVC?.routeSpecialKey(.tab)
        case "Enter":
            workspaceVC?.routeSpecialKey(.enter)
        case "Ctrl+C":
            workspaceVC?.routeSpecialKey(.ctrlC)
        case "Ctrl+D":
            workspaceVC?.routeSpecialKey(.ctrlD)
        case "Ctrl+L":
            workspaceVC?.routeSpecialKey(.ctrlL)
        case "↑":
            workspaceVC?.routeSpecialKey(.up)
        case "↓":
            workspaceVC?.routeSpecialKey(.down)
        case "←":
            workspaceVC?.routeSpecialKey(.left)
        case "→":
            workspaceVC?.routeSpecialKey(.right)
        default:
            workspaceVC?.routeKeyInput(key)
        }
    }

    @objc private func switchToTouchpadTapped() {
        showMode(.touchpad)
    }

    // MARK: - UITextFieldDelegate

    public func textField(_ textField: UITextField, shouldChangeCharactersIn range: NSRange, replacementString string: String) -> Bool {
        if string.isEmpty {
            workspaceVC?.routeKeyInput("\u{7F}")
        } else {
            workspaceVC?.routeKeyInput(string)
        }
        return false // Don't keep local text; route directly to active workspace tab
    }

    public func textFieldShouldReturn(_ textField: UITextField) -> Bool {
        workspaceVC?.routeKeyInput("\n")
        showMode(.touchpad)
        return false
    }

    // MARK: - Mode 3: Workspace & Settings Management

    private func setupSettingsMode() {
        settingsScrollView.translatesAutoresizingMaskIntoConstraints = false
        containerView.addSubview(settingsScrollView)

        settingsStack.translatesAutoresizingMaskIntoConstraints = false
        settingsStack.axis = .vertical
        settingsStack.spacing = 14
        settingsScrollView.addSubview(settingsStack)

        NSLayoutConstraint.activate([
            settingsScrollView.topAnchor.constraint(equalTo: containerView.topAnchor),
            settingsScrollView.leadingAnchor.constraint(equalTo: containerView.leadingAnchor),
            settingsScrollView.trailingAnchor.constraint(equalTo: containerView.trailingAnchor),
            settingsScrollView.bottomAnchor.constraint(equalTo: containerView.bottomAnchor),

            settingsStack.topAnchor.constraint(equalTo: settingsScrollView.topAnchor, constant: 12),
            settingsStack.leadingAnchor.constraint(equalTo: settingsScrollView.leadingAnchor, constant: 14),
            settingsStack.trailingAnchor.constraint(equalTo: settingsScrollView.trailingAnchor, constant: -14),
            settingsStack.bottomAnchor.constraint(equalTo: settingsScrollView.bottomAnchor, constant: -18),
            settingsStack.widthAnchor.constraint(equalTo: settingsScrollView.widthAnchor, constant: -28),
        ])

        buildSettingsContent()
    }

    private func buildSettingsContent() {
        // Section 0: Phone Controller Layout & Options
        let section0Title = makeSectionHeader("📱 Phone Remote Controller")

        sidebarPosSegment.translatesAutoresizingMaskIntoConstraints = false
        sidebarPosSegment.selectedSegmentIndex = store.settings.controllerSidebarPosition == .left ? 0 : 1
        sidebarPosSegment.backgroundColor = UIColor(white: 1.0, alpha: 0.08)
        sidebarPosSegment.selectedSegmentTintColor = UIColor(red: 0.22, green: 0.74, blue: 0.97, alpha: 0.35)
        sidebarPosSegment.setTitleTextAttributes([.foregroundColor: UIColor.white, .font: UIFont.systemFont(ofSize: 12, weight: .semibold)], for: .normal)
        sidebarPosSegment.setTitleTextAttributes([.foregroundColor: UIColor.white, .font: UIFont.systemFont(ofSize: 12, weight: .bold)], for: .selected)
        sidebarPosSegment.addTarget(self, action: #selector(handleSidebarPosChanged), for: .valueChanged)

        let sidebarLabel = UILabel()
        sidebarLabel.text = "Sidebar Position"
        sidebarLabel.font = .systemFont(ofSize: 12, weight: .medium)
        sidebarLabel.textColor = UIColor(white: 0.8, alpha: 1.0)

        let sidebarRow = UIStackView(arrangedSubviews: [sidebarLabel, sidebarPosSegment])
        sidebarRow.axis = .horizontal
        sidebarRow.alignment = .center
        sidebarRow.distribution = .equalSpacing

        let buttonsLabel = UILabel()
        buttonsLabel.text = "Show Click & Resize Buttons"
        buttonsLabel.font = .systemFont(ofSize: 12, weight: .medium)
        buttonsLabel.textColor = UIColor(white: 0.8, alpha: 1.0)

        showButtonsSwitch.isOn = store.settings.showTouchpadButtons
        showButtonsSwitch.onTintColor = UIColor(red: 0.22, green: 0.74, blue: 0.97, alpha: 1.0)
        showButtonsSwitch.addTarget(self, action: #selector(handleShowButtonsToggled), for: .valueChanged)

        let buttonsRow = UIStackView(arrangedSubviews: [buttonsLabel, showButtonsSwitch])
        buttonsRow.axis = .horizontal
        buttonsRow.alignment = .center
        buttonsRow.distribution = .equalSpacing

        let orientLabel = UILabel()
        orientLabel.text = "Orientation"
        orientLabel.font = .systemFont(ofSize: 12, weight: .medium)
        orientLabel.textColor = UIColor(white: 0.8, alpha: 1.0)

        orientationSegment.translatesAutoresizingMaskIntoConstraints = false
        orientationSegment.backgroundColor = UIColor(white: 1.0, alpha: 0.08)
        orientationSegment.selectedSegmentTintColor = UIColor(red: 0.22, green: 0.74, blue: 0.97, alpha: 0.35)
        orientationSegment.setTitleTextAttributes([.foregroundColor: UIColor.white, .font: UIFont.systemFont(ofSize: 11, weight: .semibold)], for: .normal)
        orientationSegment.setTitleTextAttributes([.foregroundColor: UIColor.white, .font: UIFont.systemFont(ofSize: 11, weight: .bold)], for: .selected)
        orientationSegment.addTarget(self, action: #selector(handleOrientationSegmentChanged), for: .valueChanged)

        let orientRow = UIStackView(arrangedSubviews: [orientLabel, orientationSegment])
        orientRow.axis = .horizontal
        orientRow.alignment = .center
        orientRow.distribution = .equalSpacing

        let mappingLabel = UILabel()
        mappingLabel.text = "Touchpad Mapping"
        mappingLabel.font = .systemFont(ofSize: 12, weight: .medium)
        mappingLabel.textColor = UIColor(white: 0.8, alpha: 1.0)

        settingsMappingModeSegment.translatesAutoresizingMaskIntoConstraints = false
        settingsMappingModeSegment.selectedSegmentIndex = store.settings.touchpadMappingMode == .fullDisplay ? 0 : 1
        settingsMappingModeSegment.backgroundColor = UIColor(white: 1.0, alpha: 0.08)
        settingsMappingModeSegment.selectedSegmentTintColor = UIColor(red: 0.22, green: 0.74, blue: 0.97, alpha: 0.35)
        settingsMappingModeSegment.setTitleTextAttributes([.foregroundColor: UIColor.white, .font: UIFont.systemFont(ofSize: 11, weight: .semibold)], for: .normal)
        settingsMappingModeSegment.setTitleTextAttributes([.foregroundColor: UIColor.white, .font: UIFont.systemFont(ofSize: 11, weight: .bold)], for: .selected)
        settingsMappingModeSegment.addTarget(self, action: #selector(handleSettingsMappingModeChanged), for: .valueChanged)

        let mappingRow = UIStackView(arrangedSubviews: [mappingLabel, settingsMappingModeSegment])
        mappingRow.axis = .horizontal
        mappingRow.alignment = .center
        mappingRow.distribution = .equalSpacing

        let edgePushLabel = UILabel()
        edgePushLabel.text = "Edge Continuous Travel"
        edgePushLabel.font = .systemFont(ofSize: 12, weight: .medium)
        edgePushLabel.textColor = UIColor(white: 0.8, alpha: 1.0)

        edgePushSwitch.isOn = store.settings.edgeContinuousPush
        edgePushSwitch.onTintColor = UIColor(red: 0.22, green: 0.74, blue: 0.97, alpha: 1.0)
        edgePushSwitch.addTarget(self, action: #selector(handleEdgePushToggled), for: .valueChanged)

        let edgePushRow = UIStackView(arrangedSubviews: [edgePushLabel, edgePushSwitch])
        edgePushRow.axis = .horizontal
        edgePushRow.alignment = .center
        edgePushRow.distribution = .equalSpacing

        let sensLabel = UILabel()
        sensLabel.text = "Pointer Speed"
        sensLabel.font = .systemFont(ofSize: 12, weight: .medium)
        sensLabel.textColor = UIColor(white: 0.8, alpha: 1.0)

        sensitivityValueLabel.text = String(format: "%.1fx", store.settings.pointerSensitivity)
        sensitivityValueLabel.font = .monospacedSystemFont(ofSize: 12, weight: .semibold)
        sensitivityValueLabel.textColor = UIColor(red: 0.22, green: 0.74, blue: 0.97, alpha: 1.0)

        sensitivitySlider.minimumValue = 1.0
        sensitivitySlider.maximumValue = 5.0
        sensitivitySlider.value = Float(store.settings.pointerSensitivity)
        sensitivitySlider.tintColor = UIColor(red: 0.22, green: 0.74, blue: 0.97, alpha: 1.0)
        sensitivitySlider.addTarget(self, action: #selector(handleSensitivitySliderChanged), for: .valueChanged)

        let sensHeaderRow = UIStackView(arrangedSubviews: [sensLabel, sensitivityValueLabel])
        sensHeaderRow.axis = .horizontal
        sensHeaderRow.distribution = .equalSpacing

        let sensStack = UIStackView(arrangedSubviews: [sensHeaderRow, sensitivitySlider])
        sensStack.axis = .vertical
        sensStack.spacing = 4

        let controllerOptionsCard = UIStackView(arrangedSubviews: [sidebarRow, orientRow, buttonsRow, mappingRow, edgePushRow, sensStack])
        controllerOptionsCard.axis = .vertical
        controllerOptionsCard.spacing = 10
        controllerOptionsCard.backgroundColor = UIColor(red: 0.08, green: 0.11, blue: 0.18, alpha: 1.0)
        controllerOptionsCard.layer.cornerRadius = 8
        controllerOptionsCard.isLayoutMarginsRelativeArrangement = true
        controllerOptionsCard.layoutMargins = UIEdgeInsets(top: 10, left: 12, bottom: 10, right: 12)

        // Section 1: Open Website on External Monitor
        let section1Title = makeSectionHeader("🌐 Open Website on Monitor")
        urlTextField.translatesAutoresizingMaskIntoConstraints = false
        urlTextField.backgroundColor = UIColor(red: 0.08, green: 0.11, blue: 0.18, alpha: 1.0)
        urlTextField.textColor = .white
        urlTextField.font = .monospacedSystemFont(ofSize: 12, weight: .regular)
        urlTextField.layer.cornerRadius = 6
        urlTextField.placeholder = "https://github.com or search term…"
        urlTextField.autocapitalizationType = .none
        urlTextField.keyboardType = .URL
        urlTextField.leftView = UIView(frame: CGRect(x: 0, y: 0, width: 8, height: 1))
        urlTextField.leftViewMode = .always

        openUrlButton.setTitle("Open on Monitor", for: .normal)
        openUrlButton.titleLabel?.font = .systemFont(ofSize: 13, weight: .bold)
        openUrlButton.backgroundColor = UIColor(red: 0.22, green: 0.74, blue: 0.97, alpha: 1.0)
        openUrlButton.setTitleColor(.black, for: .normal)
        openUrlButton.layer.cornerRadius = 6
        openUrlButton.heightAnchor.constraint(equalToConstant: 36).isActive = true
        openUrlButton.addAction(UIAction { [weak self] _ in
            self?.handleOpenUrlTapped()
        }, for: .touchUpInside)

        let urlRow = UIStackView(arrangedSubviews: [urlTextField, openUrlButton])
        urlRow.axis = .vertical
        urlRow.spacing = 8

        // Section 2: Quick Tool Launchers
        let section2Title = makeSectionHeader("⚡ Add Tab to Monitor")
        let addWebBtn = makeActionButton("+ Web Browser") { [weak self] in
            self?.store.openTab(type: .web)
        }
        let addSshBtn = makeActionButton("+ SSH Terminal") { [weak self] in
            self?.store.openTab(type: .ssh)
        }
        let addFilesBtn = makeActionButton("+ Files Manager") { [weak self] in
            self?.store.openTab(type: .files)
        }
        let toolsStack = UIStackView(arrangedSubviews: [addWebBtn, addSshBtn, addFilesBtn])
        toolsStack.axis = .horizontal
        toolsStack.distribution = .fillEqually
        toolsStack.spacing = 8

        // Section 3: Monitor Layout Presets
        let section3Title = makeSectionHeader("📐 Monitor Split Layout")
        let p1 = makeActionButton("Single") { [weak self] in self?.store.applyPreset(.single) }
        let p2 = makeActionButton("2-Pane") { [weak self] in self?.store.applyPreset(.twoColumn) }
        let p3 = makeActionButton("1 + 2") { [weak self] in self?.store.applyPreset(.leftPlusTwoRight) }
        let p4 = makeActionButton("2 × 2") { [weak self] in self?.store.applyPreset(.twoByTwo) }
        let layoutStack = UIStackView(arrangedSubviews: [p1, p2, p3, p4])
        layoutStack.axis = .horizontal
        layoutStack.distribution = .fillEqually
        layoutStack.spacing = 6

        // Section 4: Hosts & Keys Manager
        let section4Title = makeSectionHeader("🔑 SSH Hosts & Bookmarks")
        let hostsBtn = makeActionButton("Manage SSH Hosts & Keys") { [weak self] in
            self?.openHostsModal()
        }
        let bookmarksBtn = makeActionButton("Manage Bookmarks") { [weak self] in
            self?.openBookmarksModal()
        }
        let settingsBtn = makeActionButton("Settings & Themes") { [weak self] in
            self?.openSettingsModal()
        }
        let hostsStack = UIStackView(arrangedSubviews: [hostsBtn, bookmarksBtn, settingsBtn])
        hostsStack.axis = .vertical
        hostsStack.spacing = 8

        settingsStack.addArrangedSubview(section0Title)
        settingsStack.addArrangedSubview(controllerOptionsCard)
        settingsStack.addArrangedSubview(section1Title)
        settingsStack.addArrangedSubview(urlRow)
        settingsStack.addArrangedSubview(section2Title)
        settingsStack.addArrangedSubview(toolsStack)
        settingsStack.addArrangedSubview(section3Title)
        settingsStack.addArrangedSubview(layoutStack)
        settingsStack.addArrangedSubview(section4Title)
        settingsStack.addArrangedSubview(hostsStack)
    }

    private func syncSettingsControls() {
        sidebarPosSegment.selectedSegmentIndex = store.settings.controllerSidebarPosition == .left ? 0 : 1
        switch store.settings.controllerOrientation {
        case .landscape: orientationSegment.selectedSegmentIndex = 0
        case .portrait: orientationSegment.selectedSegmentIndex = 1
        case .landscapeFlipped: orientationSegment.selectedSegmentIndex = 2
        case .auto: orientationSegment.selectedSegmentIndex = 0
        }
        showButtonsSwitch.isOn = store.settings.showTouchpadButtons
    }

    @objc private func handleOrientationSegmentChanged() {
        let selected: ControllerOrientation
        switch orientationSegment.selectedSegmentIndex {
        case 0: selected = .landscape
        case 1: selected = .portrait
        case 2: selected = .landscapeFlipped
        default: selected = .landscape
        }
        store.settings.controllerOrientation = selected
        applyOrientationChange(selected)
    }

    @objc private func handleSidebarPosChanged() {
        let newPos: ControllerSidebarPosition = sidebarPosSegment.selectedSegmentIndex == 0 ? .left : .right
        store.settings.controllerSidebarPosition = newPos
        applySidebarLayoutConstraints()
    }

    @objc private func handleShowButtonsToggled() {
        store.settings.showTouchpadButtons = showButtonsSwitch.isOn
        updateTouchpadButtonsVisibility()
    }

    @objc private func handleSettingsMappingModeChanged() {
        let mode: TouchpadMappingMode = settingsMappingModeSegment.selectedSegmentIndex == 0 ? .fullDisplay : .relative
        store.settings.touchpadMappingMode = mode
        mappingModeSegment.selectedSegmentIndex = settingsMappingModeSegment.selectedSegmentIndex
        updateTouchpadHelpText()
        stopEdgePush()
    }

    @objc private func handleEdgePushToggled() {
        store.settings.edgeContinuousPush = edgePushSwitch.isOn
        if !edgePushSwitch.isOn {
            stopEdgePush()
        }
    }

    @objc private func handleSensitivitySliderChanged() {
        let val = Double(round(sensitivitySlider.value * 2) / 2)
        store.settings.pointerSensitivity = val
        sensitivityValueLabel.text = String(format: "%.1fx", val)
    }

    private func handleOpenUrlTapped() {
        let raw = (urlTextField.text ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        guard !raw.isEmpty else { return }
        let formatted = PaneTreeOps.resolveAddressBarInput(
            raw,
            searchEngineUrl: store.settings.defaultSearchEngineUrl
        )
        store.openTab(type: .web, url: formatted)
        urlTextField.text = ""
        // Switch to touchpad so user can browse the opened website
        showMode(.touchpad)
    }

    private func openHostsModal() {
        let hostView = HostManagerView(store: store) { [weak self] host in
            self?.store.openTab(type: .ssh, hostId: host.id)
            self?.showMode(.touchpad)
        }
        let hc = UIHostingController(rootView: hostView)
        present(hc, animated: true)
    }

    private func openBookmarksModal() {
        let alert = UIAlertController(
            title: "Bookmarks",
            message: "Select a bookmark to open on the monitor",
            preferredStyle: .actionSheet
        )
        for bm in store.bookmarks {
            alert.addAction(UIAlertAction(title: "\(bm.title) (\(bm.url))", style: .default) { [weak self] _ in
                self?.store.openTab(type: .web, url: bm.url)
                self?.showMode(.touchpad)
            })
        }
        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel))
        present(alert, animated: true)
    }

    private func openSettingsModal() {
        let sv = SettingsSheetView(store: store)
        let hc = UIHostingController(rootView: sv)
        present(hc, animated: true)
    }

    @objc public func openAssistiveTouchGuideModal() {
        let guideView = AssistiveTouchGuideView()
        let hc = UIHostingController(rootView: guideView)
        present(hc, animated: true)
    }

    private func makeSectionHeader(_ title: String) -> UILabel {
        let label = UILabel()
        label.text = title
        label.font = .systemFont(ofSize: 13, weight: .bold)
        label.textColor = UIColor(white: 0.85, alpha: 1.0)
        return label
    }

    private func makeActionButton(_ title: String, action: @escaping () -> Void) -> UIButton {
        let btn = UIButton(type: .system)
        btn.setTitle(title, for: .normal)
        btn.titleLabel?.font = .systemFont(ofSize: 12, weight: .semibold)
        btn.setTitleColor(.white, for: .normal)
        btn.backgroundColor = UIColor(red: 0.10, green: 0.14, blue: 0.22, alpha: 1.0)
        btn.layer.cornerRadius = 6
        btn.layer.borderWidth = 1
        btn.layer.borderColor = UIColor(white: 1.0, alpha: 0.12).cgColor
        btn.heightAnchor.constraint(equalToConstant: 36).isActive = true
        btn.addAction(UIAction { _ in action() }, for: .touchUpInside)
        return btn
    }

    // MARK: - Dock Keyboard & Mouse Listeners

    private func setupDockMouseListeners() {
        // UIHoverGestureRecognizer captures external mouse movement over the phone view
        let hoverGesture = UIHoverGestureRecognizer(target: self, action: #selector(handleDockMouseHover(_:)))
        view.addGestureRecognizer(hoverGesture)

        // UIPanGestureRecognizer for mouse scroll wheel
        let scrollGesture = UIPanGestureRecognizer(target: self, action: #selector(handleDockMouseScroll(_:)))
        scrollGesture.allowedScrollTypesMask = [.continuous]
        view.addGestureRecognizer(scrollGesture)

        NotificationCenter.default.addObserver(
            forName: .GCMouseDidConnect,
            object: nil,
            queue: .main
        ) { [weak self] note in
            guard let mouse = note.object as? GCMouse else { return }
            Task { @MainActor [weak self] in
                self?.configureGCMouse(mouse)
            }
        }

        NotificationCenter.default.addObserver(
            forName: .GCMouseDidDisconnect,
            object: nil,
            queue: .main
        ) { [weak self] note in
            guard let mouse = note.object as? GCMouse else { return }
            Task { @MainActor [weak self] in
                self?.registeredMice.remove(mouse)
            }
        }

        for mouse in GCMouse.mice() {
            configureGCMouse(mouse)
        }
    }

    private func configureGCMouse(_ mouse: GCMouse) {
        registeredMice.insert(mouse)
        mouse.mouseInput?.mouseMovedHandler = { [weak self] (_, deltaX, deltaY) in
            Task { @MainActor [weak self] in
                guard let self = self else { return }
                let sens = CGFloat(self.store.settings.pointerSensitivity)
                let isDragging = self.isDragModeActive || self.isHoldingLeftClick
                let dx = CGFloat(deltaX) * sens
                let dy = -CGFloat(deltaY) * sens
                self.workspaceVC?.handleCursorPan(delta: CGVector(dx: dx, dy: dy), isDragHeld: isDragging)
            }
        }

        mouse.mouseInput?.leftButton.pressedChangedHandler = { [weak self] (_, _, pressed) in
            Task { @MainActor [weak self] in
                guard let self = self else { return }
                self.isHoldingLeftClick = pressed
                if !pressed {
                    self.workspaceVC?.performVirtualClick()
                }
            }
        }

        mouse.mouseInput?.rightButton?.pressedChangedHandler = { [weak self] (_, _, pressed) in
            Task { @MainActor [weak self] in
                guard let self = self else { return }
                if pressed {
                    self.workspaceVC?.routeSpecialKey(.escape)
                }
            }
        }

        mouse.mouseInput?.scroll.yAxis.valueChangedHandler = { [weak self] (_, value) in
            Task { @MainActor [weak self] in
                guard let self = self else { return }
                self.workspaceVC?.performVirtualScroll(deltaX: 0, deltaY: CGFloat(value) * -14.0)
            }
        }

        mouse.mouseInput?.scroll.xAxis.valueChangedHandler = { [weak self] (_, value) in
            Task { @MainActor [weak self] in
                guard let self = self else { return }
                self.workspaceVC?.performVirtualScroll(deltaX: CGFloat(value) * -14.0, deltaY: 0)
            }
        }
    }

    private func setupHardwareKeyboardListeners() {
        NotificationCenter.default.addObserver(
            forName: .GCKeyboardDidConnect,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            Task { @MainActor in
                self?.hasDetectedPhysicalKeyboard = true
            }
        }
        NotificationCenter.default.addObserver(
            forName: .GCKeyboardDidDisconnect,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            Task { @MainActor in
                if GCKeyboard.coalesced == nil {
                    self?.hasDetectedPhysicalKeyboard = false
                }
            }
        }
    }

    @objc private func handleDockMouseHover(_ gesture: UIHoverGestureRecognizer) {
        let locInView = gesture.location(in: view)
        let isDragging = isDragModeActive || isHoldingLeftClick

        if store.settings.touchpadMappingMode == .fullDisplay {
            stopEdgePush()
            let viewBounds = view.bounds
            guard viewBounds.width > 0, viewBounds.height > 0 else { return }
            let normX = max(0.0, min(1.0, locInView.x / viewBounds.width))
            let normY = max(0.0, min(1.0, locInView.y / viewBounds.height))
            workspaceVC?.setCursorNormalizedPosition(x: normX, y: normY, isDragHeld: isDragging)
        } else {
            if gesture.state == .began {
                lastPanLocation = locInView
                stopEdgePush()
            } else if gesture.state == .changed {
                let rawDx = locInView.x - lastPanLocation.x
                let rawDy = locInView.y - lastPanLocation.y
                let dist = hypot(rawDx, rawDy)
                let accelMultiplier: CGFloat = dist > 12 ? 1.4 : 1.0
                let speed = CGFloat(store.settings.pointerSensitivity) * accelMultiplier
                let dx = rawDx * speed
                let dy = rawDy * speed
                workspaceVC?.handleCursorPan(delta: CGVector(dx: dx, dy: dy), isDragHeld: isDragging)
                lastPanLocation = locInView

                checkEdgeContinuousPush(at: locInView, in: view.bounds)
            } else if gesture.state == .ended || gesture.state == .cancelled {
                stopEdgePush()
            }
        }
    }

    @objc private func handleDockMouseScroll(_ gesture: UIPanGestureRecognizer) {
        let translation = gesture.translation(in: view)
        workspaceVC?.performVirtualScroll(deltaX: -translation.x * 0.7, deltaY: -translation.y * 0.7)
        gesture.setTranslation(.zero, in: view)
    }

    // MARK: - Physical Keyboard Event Interception (UIPressesEvent)

    public override func pressesBegan(_ presses: Set<UIPress>, with event: UIPressesEvent?) {
        hasDetectedPhysicalKeyboard = true
        var handled = false
        for press in presses {
            guard let key = press.key else { continue }
            switch key.keyCode {
            case .keyboardReturnOrEnter:
                workspaceVC?.routeSpecialKey(.enter)
                handled = true
            case .keyboardEscape:
                workspaceVC?.routeSpecialKey(.escape)
                handled = true
            case .keyboardTab:
                workspaceVC?.routeSpecialKey(.tab)
                handled = true
            case .keyboardDeleteOrBackspace:
                workspaceVC?.routeKeyInput("\u{7F}")
                handled = true
            case .keyboardUpArrow:
                workspaceVC?.routeSpecialKey(.up)
                handled = true
            case .keyboardDownArrow:
                workspaceVC?.routeSpecialKey(.down)
                handled = true
            case .keyboardLeftArrow:
                workspaceVC?.routeSpecialKey(.left)
                handled = true
            case .keyboardRightArrow:
                workspaceVC?.routeSpecialKey(.right)
                handled = true
            default:
                if key.modifierFlags.contains(.command) || key.modifierFlags.contains(.control) {
                    let char = key.charactersIgnoringModifiers.uppercased()
                    switch char {
                    case "K", "P":
                        workspaceVC?.openCommandPalette()
                        handled = true
                    case "T":
                        store.openTab(type: .web)
                        handled = true
                    case "W":
                        if workspaceVC?.activeCommandPalette != nil {
                            workspaceVC?.activeCommandPalette?.dismissPalette()
                        } else {
                            store.closeTab()
                        }
                        handled = true
                    case "1":
                        store.applyPreset(.single)
                        handled = true
                    case "2":
                        store.applyPreset(.twoColumn)
                        handled = true
                    case "3":
                        store.applyPreset(.leftPlusTwoRight)
                        handled = true
                    case "4":
                        store.applyPreset(.twoByTwo)
                        handled = true
                    case "C":
                        workspaceVC?.routeSpecialKey(.ctrlC)
                        handled = true
                    case "D":
                        workspaceVC?.routeSpecialKey(.ctrlD)
                        handled = true
                    case "L":
                        workspaceVC?.routeSpecialKey(.ctrlL)
                        handled = true
                    case "Z":
                        workspaceVC?.routeSpecialKey(.ctrlZ)
                        handled = true
                    case ",":
                        openSettingsModal()
                        handled = true
                    default:
                        workspaceVC?.routeKeyInput(key.characters)
                        handled = true
                    }
                } else if !key.characters.isEmpty {
                    workspaceVC?.routeKeyInput(key.characters)
                    handled = true
                }
            }
        }
        if !handled {
            super.pressesBegan(presses, with: event)
        }
    }
}

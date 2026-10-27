import Combine
import SwiftUI
import TetherKit
import UIKit

/// Dedicated Phone Controller for External Monitor Sessions (PRD §4, §12).
/// When an external monitor is attached:
/// - The external monitor renders the full tiling split-pane desktop workspace.
/// - The phone does NOT mirror the workspace; instead it acts as:
///   1. Smooth Trackpad (1-finger move/click, 2-finger scroll, left/right click buttons).
///   2. Developer Keyboard (iOS software keyboard + Esc, Tab, Ctrl, Alt, ^C, ^D, arrows).
///   3. Workspace & Settings Manager (launch URLs, manage hosts & keys, switch layouts).
///   4. Dock Hardware Bridge (captures physical USB/Bluetooth keyboard and mouse from dock).
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

    // UI Elements
    private let topHeaderBar = UIView()
    private let statusBadge = UILabel()
    private let modeSegmentedControl = UISegmentedControl(items: ["Touchpad", "Keyboard", "Settings"])
    private let containerView = UIView()

    // Touchpad Mode views
    private let touchpadView = UIView()
    private let touchpadSurface = UIView()
    private let touchpadHelpLabel = UILabel()
    private let leftClickButton = UIButton(type: .system)
    private let dragResizeButton = UIButton(type: .system)
    private let rightClickButton = UIButton(type: .system)
    private let switchModeButton = UIButton(type: .system)

    private var isDragModeActive: Bool = false
    private var isHoldingLeftClick: Bool = false

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
        setupTopHeader()
        setupTouchpadView()
        setupKeyboardMode()
        setupSettingsMode()
        setupDockMouseListeners()
        bindStore()
        showMode(.touchpad)
    }

    public override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        becomeFirstResponder()
    }

    private func bindStore() {
        store.$externalDisplayDescription
            .receive(on: RunLoop.main)
            .sink { [weak self] desc in
                self?.statusBadge.text = "🖥️ \(desc)"
            }
            .store(in: &cancellables)

        store.$tree
            .receive(on: RunLoop.main)
            .sink { [weak self] _ in
                self?.updateActivePaneIndicator()
            }
            .store(in: &cancellables)
    }

    private func updateActivePaneIndicator() {
        if let focused = store.focusedPane, let active = focused.activeTab {
            activePaneLabel.text = "Target: [\(active.type.displayName.uppercased())] \(active.title)"
        } else {
            activePaneLabel.text = "Target: Active Workspace Pane"
        }
    }

    // MARK: - Top Header & Mode Switcher

    private func setupTopHeader() {
        topHeaderBar.translatesAutoresizingMaskIntoConstraints = false
        topHeaderBar.backgroundColor = UIColor(red: 0.07, green: 0.10, blue: 0.17, alpha: 1.0)
        topHeaderBar.layer.borderWidth = 1
        topHeaderBar.layer.borderColor = UIColor(white: 1.0, alpha: 0.08).cgColor

        statusBadge.translatesAutoresizingMaskIntoConstraints = false
        statusBadge.font = .monospacedSystemFont(ofSize: 11, weight: .semibold)
        statusBadge.textColor = UIColor(red: 0.20, green: 0.83, blue: 0.60, alpha: 1.0)
        statusBadge.text = "🖥️ \(store.externalDisplayDescription)"

        modeSegmentedControl.translatesAutoresizingMaskIntoConstraints = false
        modeSegmentedControl.selectedSegmentIndex = 0
        modeSegmentedControl.backgroundColor = UIColor(white: 1.0, alpha: 0.08)
        modeSegmentedControl.selectedSegmentTintColor = UIColor(red: 0.22, green: 0.74, blue: 0.97, alpha: 0.35)
        modeSegmentedControl.setTitleTextAttributes([.foregroundColor: UIColor.white, .font: UIFont.systemFont(ofSize: 12, weight: .semibold)], for: .normal)
        modeSegmentedControl.setTitleTextAttributes([.foregroundColor: UIColor.white, .font: UIFont.systemFont(ofSize: 12, weight: .bold)], for: .selected)
        modeSegmentedControl.addTarget(self, action: #selector(handleModeSegmentChanged), for: .valueChanged)

        containerView.translatesAutoresizingMaskIntoConstraints = false

        view.addSubview(topHeaderBar)
        topHeaderBar.addSubview(statusBadge)
        topHeaderBar.addSubview(modeSegmentedControl)
        view.addSubview(containerView)

        NSLayoutConstraint.activate([
            topHeaderBar.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            topHeaderBar.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            topHeaderBar.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            topHeaderBar.heightAnchor.constraint(equalToConstant: 76),

            statusBadge.topAnchor.constraint(equalTo: topHeaderBar.topAnchor, constant: 8),
            statusBadge.leadingAnchor.constraint(equalTo: topHeaderBar.leadingAnchor, constant: 14),
            statusBadge.trailingAnchor.constraint(equalTo: topHeaderBar.trailingAnchor, constant: -14),

            modeSegmentedControl.topAnchor.constraint(equalTo: statusBadge.bottomAnchor, constant: 6),
            modeSegmentedControl.leadingAnchor.constraint(equalTo: topHeaderBar.leadingAnchor, constant: 14),
            modeSegmentedControl.trailingAnchor.constraint(equalTo: topHeaderBar.trailingAnchor, constant: -14),
            modeSegmentedControl.heightAnchor.constraint(equalToConstant: 30),

            containerView.topAnchor.constraint(equalTo: topHeaderBar.bottomAnchor),
            containerView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            containerView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            containerView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
        ])
    }

    @objc private func handleModeSegmentChanged() {
        guard let mode = ControllerMode(rawValue: modeSegmentedControl.selectedSegmentIndex) else { return }
        showMode(mode)
    }

    private func showMode(_ mode: ControllerMode) {
        currentMode = mode
        modeSegmentedControl.selectedSegmentIndex = mode.rawValue

        touchpadView.isHidden = (mode != .touchpad)
        keyboardContainer.isHidden = (mode != .keyboard)
        settingsScrollView.isHidden = (mode != .settings)

        switch mode {
        case .touchpad:
            hiddenInputTextField.resignFirstResponder()
            becomeFirstResponder()
        case .keyboard:
            hiddenInputTextField.becomeFirstResponder()
        case .settings:
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

        touchpadHelpLabel.translatesAutoresizingMaskIntoConstraints = false
        touchpadHelpLabel.text = "1-Finger: Move & Tap to Click\n2-Finger: Scroll & Right-Click"
        touchpadHelpLabel.numberOfLines = 2
        touchpadHelpLabel.textAlignment = .center
        touchpadHelpLabel.textColor = UIColor(white: 1.0, alpha: 0.35)
        touchpadHelpLabel.font = .systemFont(ofSize: 13, weight: .medium)
        touchpadSurface.addSubview(touchpadHelpLabel)

        // Bottom action buttons
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

        switchModeButton.translatesAutoresizingMaskIntoConstraints = false
        switchModeButton.setTitle("⌨️ Switch to Keyboard", for: .normal)
        switchModeButton.titleLabel?.font = .systemFont(ofSize: 13, weight: .bold)
        switchModeButton.setTitleColor(UIColor(red: 0.22, green: 0.74, blue: 0.97, alpha: 1.0), for: .normal)
        switchModeButton.backgroundColor = UIColor(red: 0.08, green: 0.12, blue: 0.20, alpha: 1.0)
        switchModeButton.layer.cornerRadius = 8
        switchModeButton.addTarget(self, action: #selector(switchToKeyboardTapped), for: .touchUpInside)

        let clickButtonsStack = UIStackView(arrangedSubviews: [leftClickButton, dragResizeButton, rightClickButton])
        clickButtonsStack.translatesAutoresizingMaskIntoConstraints = false
        clickButtonsStack.axis = .horizontal
        clickButtonsStack.distribution = .fillEqually
        clickButtonsStack.spacing = 8

        touchpadView.addSubview(touchpadSurface)
        touchpadView.addSubview(clickButtonsStack)
        touchpadView.addSubview(switchModeButton)

        NSLayoutConstraint.activate([
            touchpadView.topAnchor.constraint(equalTo: containerView.topAnchor),
            touchpadView.leadingAnchor.constraint(equalTo: containerView.leadingAnchor),
            touchpadView.trailingAnchor.constraint(equalTo: containerView.trailingAnchor),
            touchpadView.bottomAnchor.constraint(equalTo: containerView.bottomAnchor),

            touchpadSurface.topAnchor.constraint(equalTo: touchpadView.topAnchor, constant: 12),
            touchpadSurface.leadingAnchor.constraint(equalTo: touchpadView.leadingAnchor, constant: 14),
            touchpadSurface.trailingAnchor.constraint(equalTo: touchpadView.trailingAnchor, constant: -14),
            touchpadSurface.bottomAnchor.constraint(equalTo: clickButtonsStack.topAnchor, constant: -12),

            touchpadHelpLabel.centerXAnchor.constraint(equalTo: touchpadSurface.centerXAnchor),
            touchpadHelpLabel.centerYAnchor.constraint(equalTo: touchpadSurface.centerYAnchor),

            clickButtonsStack.leadingAnchor.constraint(equalTo: touchpadView.leadingAnchor, constant: 14),
            clickButtonsStack.trailingAnchor.constraint(equalTo: touchpadView.trailingAnchor, constant: -14),
            clickButtonsStack.bottomAnchor.constraint(equalTo: switchModeButton.topAnchor, constant: -10),
            clickButtonsStack.heightAnchor.constraint(equalToConstant: 44),

            switchModeButton.leadingAnchor.constraint(equalTo: touchpadView.leadingAnchor, constant: 14),
            switchModeButton.trailingAnchor.constraint(equalTo: touchpadView.trailingAnchor, constant: -14),
            switchModeButton.bottomAnchor.constraint(equalTo: touchpadView.safeAreaLayoutGuide.bottomAnchor, constant: -10),
            switchModeButton.heightAnchor.constraint(equalToConstant: 38),
        ])
    }

    @objc private func handleTouchpadPan(_ gesture: UIPanGestureRecognizer) {
        let translation = gesture.translation(in: touchpadSurface)
        if gesture.numberOfTouches == 2 {
            // 2-finger scroll on monitor
            workspaceVC?.performVirtualScroll(deltaX: -translation.x * 0.8, deltaY: -translation.y * 0.8)
        } else {
            // 1-finger pointer move or pane resize drag
            let speed: CGFloat = 1.35
            let delta = CGVector(dx: translation.x * speed, dy: translation.y * speed)
            let isDragging = isDragModeActive || isHoldingLeftClick
            workspaceVC?.handleCursorPan(delta: delta, isDragHeld: isDragging)
        }
        gesture.setTranslation(.zero, in: touchpadSurface)
    }

    @objc private func handleTouchpadTap(_ gesture: UITapGestureRecognizer) {
        workspaceVC?.performVirtualClick()
    }

    @objc private func handleTouchpadTwoFingerTap(_ gesture: UITapGestureRecognizer) {
        workspaceVC?.routeSpecialKey(.escape)
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

    @objc private func switchToKeyboardTapped() {
        showMode(.keyboard)
    }

    public func switchToKeyboardForInput(placeholder: String) {
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

        let switchToTouchpadBtn = UIButton(type: .system)
        switchToTouchpadBtn.translatesAutoresizingMaskIntoConstraints = false
        switchToTouchpadBtn.setTitle("🖱️ Switch to Touchpad", for: .normal)
        switchToTouchpadBtn.titleLabel?.font = .systemFont(ofSize: 13, weight: .bold)
        switchToTouchpadBtn.setTitleColor(.white, for: .normal)
        switchToTouchpadBtn.backgroundColor = UIColor(red: 0.12, green: 0.16, blue: 0.26, alpha: 1.0)
        switchToTouchpadBtn.layer.cornerRadius = 8
        switchToTouchpadBtn.addTarget(self, action: #selector(switchToTouchpadTapped), for: .touchUpInside)

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

        keyboardContainer.addSubview(activePaneLabel)
        keyboardContainer.addSubview(hiddenInputTextField)
        keyboardContainer.addSubview(devKeysContainer)
        keyboardContainer.addSubview(switchToTouchpadBtn)

        NSLayoutConstraint.activate([
            keyboardContainer.topAnchor.constraint(equalTo: containerView.topAnchor),
            keyboardContainer.leadingAnchor.constraint(equalTo: containerView.leadingAnchor),
            keyboardContainer.trailingAnchor.constraint(equalTo: containerView.trailingAnchor),
            keyboardContainer.bottomAnchor.constraint(equalTo: containerView.bottomAnchor),

            activePaneLabel.topAnchor.constraint(equalTo: keyboardContainer.topAnchor, constant: 10),
            activePaneLabel.leadingAnchor.constraint(equalTo: keyboardContainer.leadingAnchor, constant: 14),
            activePaneLabel.trailingAnchor.constraint(equalTo: keyboardContainer.trailingAnchor, constant: -14),

            hiddenInputTextField.topAnchor.constraint(equalTo: activePaneLabel.bottomAnchor, constant: 8),
            hiddenInputTextField.leadingAnchor.constraint(equalTo: keyboardContainer.leadingAnchor, constant: 14),
            hiddenInputTextField.trailingAnchor.constraint(equalTo: keyboardContainer.trailingAnchor, constant: -14),
            hiddenInputTextField.heightAnchor.constraint(equalToConstant: 40),

            devKeysContainer.topAnchor.constraint(equalTo: hiddenInputTextField.bottomAnchor, constant: 10),
            devKeysContainer.leadingAnchor.constraint(equalTo: keyboardContainer.leadingAnchor, constant: 14),
            devKeysContainer.trailingAnchor.constraint(equalTo: keyboardContainer.trailingAnchor, constant: -14),

            switchToTouchpadBtn.leadingAnchor.constraint(equalTo: keyboardContainer.leadingAnchor, constant: 14),
            switchToTouchpadBtn.trailingAnchor.constraint(equalTo: keyboardContainer.trailingAnchor, constant: -14),
            switchToTouchpadBtn.bottomAnchor.constraint(equalTo: keyboardContainer.safeAreaLayoutGuide.bottomAnchor, constant: -10),
            switchToTouchpadBtn.heightAnchor.constraint(equalToConstant: 38),
        ])
    }

    private func buildDeveloperKeypad() -> UIView {
        let container = UIStackView()
        container.axis = .vertical
        container.spacing = 8
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
            btn.heightAnchor.constraint(equalToConstant: 36).isActive = true
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
        settingsStack.spacing = 16
        settingsScrollView.addSubview(settingsStack)

        NSLayoutConstraint.activate([
            settingsScrollView.topAnchor.constraint(equalTo: containerView.topAnchor),
            settingsScrollView.leadingAnchor.constraint(equalTo: containerView.leadingAnchor),
            settingsScrollView.trailingAnchor.constraint(equalTo: containerView.trailingAnchor),
            settingsScrollView.bottomAnchor.constraint(equalTo: containerView.bottomAnchor),

            settingsStack.topAnchor.constraint(equalTo: settingsScrollView.topAnchor, constant: 14),
            settingsStack.leadingAnchor.constraint(equalTo: settingsScrollView.leadingAnchor, constant: 14),
            settingsStack.trailingAnchor.constraint(equalTo: settingsScrollView.trailingAnchor, constant: -14),
            settingsStack.bottomAnchor.constraint(equalTo: settingsScrollView.bottomAnchor, constant: -20),
            settingsStack.widthAnchor.constraint(equalTo: settingsScrollView.widthAnchor, constant: -28),
        ])

        buildSettingsContent()
    }

    private func buildSettingsContent() {
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
        openUrlButton.heightAnchor.constraint(equalToConstant: 38).isActive = true
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

        settingsStack.addArrangedSubview(section1Title)
        settingsStack.addArrangedSubview(urlRow)
        settingsStack.addArrangedSubview(section2Title)
        settingsStack.addArrangedSubview(toolsStack)
        settingsStack.addArrangedSubview(section3Title)
        settingsStack.addArrangedSubview(layoutStack)
        settingsStack.addArrangedSubview(section4Title)
        settingsStack.addArrangedSubview(hostsStack)
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
    }

    @objc private func handleDockMouseHover(_ gesture: UIHoverGestureRecognizer) {
        let location = gesture.location(in: view)
        if gesture.state == .began {
            lastPanLocation = location
        } else if gesture.state == .changed {
            let dx = (location.x - lastPanLocation.x) * 1.5
            let dy = (location.y - lastPanLocation.y) * 1.5
            let isDragging = isDragModeActive || isHoldingLeftClick
            workspaceVC?.handleCursorPan(delta: CGVector(dx: dx, dy: dy), isDragHeld: isDragging)
            lastPanLocation = location
        }
    }

    @objc private func handleDockMouseScroll(_ gesture: UIPanGestureRecognizer) {
        let translation = gesture.translation(in: view)
        workspaceVC?.performVirtualScroll(deltaX: -translation.x * 0.7, deltaY: -translation.y * 0.7)
        gesture.setTranslation(.zero, in: view)
    }

    // MARK: - Physical Keyboard Event Interception (UIPressesEvent)

    public override func pressesBegan(_ presses: Set<UIPress>, with event: UIPressesEvent?) {
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
                if key.modifierFlags.contains(.control) {
                    let char = key.charactersIgnoringModifiers.uppercased()
                    switch char {
                    case "C": workspaceVC?.routeSpecialKey(.ctrlC); handled = true
                    case "D": workspaceVC?.routeSpecialKey(.ctrlD); handled = true
                    case "L": workspaceVC?.routeSpecialKey(.ctrlL); handled = true
                    case "Z": workspaceVC?.routeSpecialKey(.ctrlZ); handled = true
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

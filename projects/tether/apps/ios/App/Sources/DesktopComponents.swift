import TetherKit
import UIKit

// MARK: - Desktop Interaction Mode

public enum DesktopInteractionMode: String, Equatable {
    case normal = "NORMAL"
    case leader = "LEADER"
    case resize = "RESIZE"
    case swap = "SWAP"
}

// MARK: - Bottom Status & Context Ribbon (c20-bottom-status-hud)

@MainActor
public final class BottomStatusHudView: UIView {
    private let stack = UIStackView()
    private let leftStack = UIStackView()
    private let rightStack = UIStackView()

    private let workspaceBadge = UILabel()
    private let paneBadge = UILabel()
    private let toolBadge = UILabel()
    private let modeBadge = UILabel()
    private let shortcutsLabel = UILabel()

    public override init(frame: CGRect) {
        super.init(frame: frame)
        setupUI()
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    private func setupUI() {
        backgroundColor = UIColor(red: 0.04, green: 0.06, blue: 0.10, alpha: 1.0)
        layer.borderWidth = 0.5
        layer.borderColor = UIColor(white: 1.0, alpha: 0.08).cgColor

        stack.translatesAutoresizingMaskIntoConstraints = false
        stack.axis = .horizontal
        stack.distribution = .equalSpacing
        stack.alignment = .center
        addSubview(stack)

        leftStack.axis = .horizontal
        leftStack.spacing = 6
        leftStack.alignment = .center

        rightStack.axis = .horizontal
        rightStack.spacing = 8
        rightStack.alignment = .center

        // Workspace Pill
        workspaceBadge.font = .monospacedSystemFont(ofSize: 10, weight: .bold)
        workspaceBadge.textColor = UIColor(red: 0.22, green: 0.74, blue: 0.97, alpha: 1.0)
        workspaceBadge.backgroundColor = UIColor(red: 0.22, green: 0.74, blue: 0.97, alpha: 0.15)
        workspaceBadge.layer.cornerRadius = 3
        workspaceBadge.layer.masksToBounds = true

        // Pane Pill
        paneBadge.font = .monospacedSystemFont(ofSize: 10, weight: .medium)
        paneBadge.textColor = UIColor(white: 0.9, alpha: 1.0)
        paneBadge.backgroundColor = UIColor(white: 1.0, alpha: 0.08)
        paneBadge.layer.cornerRadius = 3
        paneBadge.layer.masksToBounds = true

        // Tool Pill
        toolBadge.font = .monospacedSystemFont(ofSize: 10, weight: .semibold)
        toolBadge.textColor = UIColor(white: 0.8, alpha: 1.0)

        // Mode Pill
        modeBadge.font = .monospacedSystemFont(ofSize: 10, weight: .bold)
        modeBadge.layer.cornerRadius = 3
        modeBadge.layer.masksToBounds = true

        leftStack.addArrangedSubview(workspaceBadge)
        leftStack.addArrangedSubview(paneBadge)
        leftStack.addArrangedSubview(toolBadge)

        // Shortcuts Label
        shortcutsLabel.font = .monospacedSystemFont(ofSize: 10, weight: .regular)
        shortcutsLabel.textColor = UIColor(white: 0.65, alpha: 1.0)

        rightStack.addArrangedSubview(modeBadge)
        rightStack.addArrangedSubview(shortcutsLabel)

        stack.addArrangedSubview(leftStack)
        stack.addArrangedSubview(rightStack)

        NSLayoutConstraint.activate([
            stack.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 10),
            stack.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -10),
            stack.topAnchor.constraint(equalTo: topAnchor),
            stack.bottomAnchor.constraint(equalTo: bottomAnchor),
        ])
    }

    public func update(
        workspaceIndex: Int,
        workspaceName: String,
        paneIndex: Int,
        totalPanes: Int,
        activeTab: TetherKit.Tab?,
        mode: DesktopInteractionMode
    ) {
        workspaceBadge.text = " [⌃\(workspaceIndex + 1)] \(workspaceName) "
        paneBadge.text = " Pane \(paneIndex + 1)/\(totalPanes) "

        if let tab = activeTab {
            let icon: String
            switch tab.type {
            case .web: icon = "🌐"
            case .ssh: icon = "💻"
            case .files: icon = "📁"
            }
            toolBadge.text = "\(icon) \(tab.title)"
        } else {
            toolBadge.text = "Empty Pane"
        }

        switch mode {
        case .normal:
            modeBadge.text = " NORMAL "
            modeBadge.textColor = UIColor(red: 0.22, green: 0.74, blue: 0.97, alpha: 1.0)
            modeBadge.backgroundColor = UIColor(red: 0.22, green: 0.74, blue: 0.97, alpha: 0.15)
            modeBadge.layer.borderColor = UIColor(red: 0.22, green: 0.74, blue: 0.97, alpha: 0.4).cgColor
            modeBadge.layer.borderWidth = 1

            if let tab = activeTab {
                switch tab.type {
                case .ssh:
                    shortcutsLabel.text = "⌃C Kill · ⌃D EOF · ⌘D Split · ⌘⌥O Flip · ⌘W Close"
                case .web:
                    shortcutsLabel.text = "⌘L Address · ⌘R Reload · Space Page · ⌘D Split · ⌘W Close"
                case .files:
                    shortcutsLabel.text = "↑↓ Move · ↵ Open · ⌘D Split · ⌘⌥O Flip · ⌘W Close"
                }
            } else {
                shortcutsLabel.text = "[W] Browser · [S] Terminal · [F] Files"
            }

        case .leader:
            modeBadge.text = " LEADER "
            modeBadge.textColor = UIColor(red: 0.96, green: 0.45, blue: 0.71, alpha: 1.0)
            modeBadge.backgroundColor = UIColor(red: 0.96, green: 0.45, blue: 0.71, alpha: 0.25)
            modeBadge.layer.borderColor = UIColor(red: 0.96, green: 0.45, blue: 0.71, alpha: 0.8).cgColor
            modeBadge.layer.borderWidth = 1
            shortcutsLabel.text = "[v] Split V · [h] Split H · [w] Close · [m] Max · [r] Resize · [s] Swap · Esc"

        case .resize:
            modeBadge.text = " RESIZE "
            modeBadge.textColor = UIColor(red: 0.98, green: 0.75, blue: 0.14, alpha: 1.0)
            modeBadge.backgroundColor = UIColor(red: 0.98, green: 0.75, blue: 0.14, alpha: 0.25)
            modeBadge.layer.borderColor = UIColor(red: 0.98, green: 0.75, blue: 0.14, alpha: 0.8).cgColor
            modeBadge.layer.borderWidth = 1
            shortcutsLabel.text = "←/→ Adjust (5%) · ⇧←/→ (1%) · ↵ / Esc Finish"

        case .swap:
            modeBadge.text = " SWAP "
            modeBadge.textColor = UIColor(red: 0.20, green: 0.83, blue: 0.60, alpha: 1.0)
            modeBadge.backgroundColor = UIColor(red: 0.20, green: 0.83, blue: 0.60, alpha: 0.25)
            modeBadge.layer.borderColor = UIColor(red: 0.20, green: 0.83, blue: 0.60, alpha: 0.8).cgColor
            modeBadge.layer.borderWidth = 1
            shortcutsLabel.text = "←/→/↑/↓ Choose Swap Target · Esc Cancel"
        }
    }
}

// MARK: - Interactive Tab Switcher HUD (c06-tab-switcher-hud)

@MainActor
public final class TabSwitcherOverlayView: UIView {
    private let card = UIView()
    private let titleLabel = UILabel()
    private let stack = UIStackView()
    private let hintLabel = UILabel()

    public private(set) var selectedIndex: Int = 0
    private var tabs: [TetherKit.Tab] = []
    public var onSelect: ((Int) -> Void)?
    public var onDismiss: (() -> Void)?

    public init(tabs: [TetherKit.Tab], initialIndex: Int) {
        self.tabs = tabs
        self.selectedIndex = min(max(0, initialIndex), max(0, tabs.count - 1))
        super.init(frame: .zero)
        setupUI()
        renderCards()
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    private func setupUI() {
        backgroundColor = UIColor(white: 0, alpha: 0.6)

        card.backgroundColor = UIColor(red: 0.08, green: 0.11, blue: 0.18, alpha: 0.96)
        card.layer.cornerRadius = 12
        card.layer.borderWidth = 1.5
        card.layer.borderColor = UIColor(red: 0.22, green: 0.74, blue: 0.97, alpha: 0.6).cgColor
        card.layer.shadowColor = UIColor.black.cgColor
        card.layer.shadowOpacity = 0.7
        card.layer.shadowOffset = CGSize(width: 0, height: 8)
        card.layer.shadowRadius = 18
        card.translatesAutoresizingMaskIntoConstraints = false
        addSubview(card)

        titleLabel.text = "📑 Tab Switcher (Ctrl+Tab)"
        titleLabel.font = .monospacedSystemFont(ofSize: 12, weight: .bold)
        titleLabel.textColor = UIColor(red: 0.22, green: 0.74, blue: 0.97, alpha: 1.0)
        titleLabel.translatesAutoresizingMaskIntoConstraints = false
        card.addSubview(titleLabel)

        stack.axis = .horizontal
        stack.spacing = 10
        stack.alignment = .fill
        stack.distribution = .fillEqually
        stack.translatesAutoresizingMaskIntoConstraints = false
        card.addSubview(stack)

        hintLabel.text = "Release Ctrl or press Enter to switch · Esc to cancel"
        hintLabel.font = .monospacedSystemFont(ofSize: 10, weight: .medium)
        hintLabel.textColor = UIColor(white: 0.6, alpha: 1.0)
        hintLabel.textAlignment = .center
        hintLabel.translatesAutoresizingMaskIntoConstraints = false
        card.addSubview(hintLabel)

        NSLayoutConstraint.activate([
            card.centerXAnchor.constraint(equalTo: centerXAnchor),
            card.centerYAnchor.constraint(equalTo: centerYAnchor),
            card.widthAnchor.constraint(lessThanOrEqualTo: widthAnchor, constant: -40),
            card.heightAnchor.constraint(equalToConstant: 130),

            titleLabel.topAnchor.constraint(equalTo: card.topAnchor, constant: 12),
            titleLabel.centerXAnchor.constraint(equalTo: card.centerXAnchor),

            stack.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 10),
            stack.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 16),
            stack.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -16),
            stack.heightAnchor.constraint(equalToConstant: 54),

            hintLabel.topAnchor.constraint(equalTo: stack.bottomAnchor, constant: 8),
            hintLabel.centerXAnchor.constraint(equalTo: card.centerXAnchor),
        ])
    }

    private func renderCards() {
        stack.arrangedSubviews.forEach {
            stack.removeArrangedSubview($0)
            $0.removeFromSuperview()
        }

        for (idx, tab) in tabs.enumerated() {
            let isSelected = (idx == selectedIndex)
            let tabCard = UIView()
            tabCard.backgroundColor = isSelected
                ? UIColor(red: 0.22, green: 0.74, blue: 0.97, alpha: 0.25)
                : UIColor(white: 1.0, alpha: 0.05)
            tabCard.layer.cornerRadius = 8
            tabCard.layer.borderWidth = isSelected ? 1.5 : 1.0
            tabCard.layer.borderColor = isSelected
                ? UIColor(red: 0.22, green: 0.74, blue: 0.97, alpha: 1.0).cgColor
                : UIColor(white: 1.0, alpha: 0.12).cgColor

            let idxLabel = UILabel()
            idxLabel.text = " [\(idx + 1)] "
            idxLabel.font = .monospacedSystemFont(ofSize: 10, weight: .bold)
            idxLabel.textColor = isSelected ? UIColor(red: 0.22, green: 0.74, blue: 0.97, alpha: 1.0) : UIColor(white: 0.5, alpha: 1.0)
            idxLabel.translatesAutoresizingMaskIntoConstraints = false
            tabCard.addSubview(idxLabel)

            let iconView = UIImageView()
            let config = UIImage.SymbolConfiguration(pointSize: 13, weight: .medium)
            iconView.image = UIImage(systemName: tab.type.systemImage, withConfiguration: config)
            iconView.tintColor = isSelected ? .white : UIColor(white: 0.7, alpha: 1.0)
            iconView.translatesAutoresizingMaskIntoConstraints = false
            tabCard.addSubview(iconView)

            let tLabel = UILabel()
            tLabel.text = tab.title
            tLabel.font = .systemFont(ofSize: 11, weight: isSelected ? .bold : .medium)
            tLabel.textColor = isSelected ? .white : UIColor(white: 0.8, alpha: 1.0)
            tLabel.lineBreakMode = .byTruncatingTail
            tLabel.translatesAutoresizingMaskIntoConstraints = false
            tabCard.addSubview(tLabel)

            NSLayoutConstraint.activate([
                idxLabel.topAnchor.constraint(equalTo: tabCard.topAnchor, constant: 6),
                idxLabel.leadingAnchor.constraint(equalTo: tabCard.leadingAnchor, constant: 6),

                iconView.centerYAnchor.constraint(equalTo: tabCard.centerYAnchor, constant: 6),
                iconView.leadingAnchor.constraint(equalTo: tabCard.leadingAnchor, constant: 8),
                iconView.widthAnchor.constraint(equalToConstant: 16),
                iconView.heightAnchor.constraint(equalToConstant: 16),

                tLabel.centerYAnchor.constraint(equalTo: iconView.centerYAnchor),
                tLabel.leadingAnchor.constraint(equalTo: iconView.trailingAnchor, constant: 6),
                tLabel.trailingAnchor.constraint(equalTo: tabCard.trailingAnchor, constant: -8),
                tabCard.widthAnchor.constraint(greaterThanOrEqualToConstant: 110),
            ])

            let tap = UITapGestureRecognizer(target: self, action: #selector(handleCardTap(_:)))
            tabCard.tag = idx
            tabCard.addGestureRecognizer(tap)

            stack.addArrangedSubview(tabCard)
        }
    }

    @objc private func handleCardTap(_ gesture: UITapGestureRecognizer) {
        guard let idx = gesture.view?.tag else { return }
        selectedIndex = idx
        renderCards()
        commitSelection()
    }

    public func step(reverse: Bool = false) {
        guard !tabs.isEmpty else { return }
        if reverse {
            selectedIndex = (selectedIndex - 1 + tabs.count) % tabs.count
        } else {
            selectedIndex = (selectedIndex + 1) % tabs.count
        }
        renderCards()
    }

    public func commitSelection() {
        onSelect?(selectedIndex)
        removeFromSuperview()
    }

    public func cancel() {
        onDismiss?()
        removeFromSuperview()
    }
}

// MARK: - Workspace Slide Toast Banner (c17-workspace-hotkeys)

@MainActor
public final class WorkspaceToastBannerView: UIView {
    private let titleLabel = UILabel()
    private let badgeLabel = UILabel()

    public static func show(in container: UIView, workspaceIndex: Int, workspaceName: String) {
        container.subviews.compactMap { $0 as? WorkspaceToastBannerView }.forEach { $0.removeFromSuperview() }

        let toast = WorkspaceToastBannerView(workspaceIndex: workspaceIndex, workspaceName: workspaceName)
        toast.translatesAutoresizingMaskIntoConstraints = false
        toast.alpha = 0
        toast.transform = CGAffineTransform(translationX: 0, y: -20)
        container.addSubview(toast)

        NSLayoutConstraint.activate([
            toast.topAnchor.constraint(equalTo: container.safeAreaLayoutGuide.topAnchor, constant: 46),
            toast.centerXAnchor.constraint(equalTo: container.centerXAnchor),
            toast.heightAnchor.constraint(equalToConstant: 34),
        ])

        UIView.animate(withDuration: 0.3, delay: 0, usingSpringWithDamping: 0.8, initialSpringVelocity: 0.5) {
            toast.alpha = 1.0
            toast.transform = .identity
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) {
            UIView.animate(withDuration: 0.25, animations: {
                toast.alpha = 0.0
                toast.transform = CGAffineTransform(translationX: 0, y: -10)
            }) { _ in
                toast.removeFromSuperview()
            }
        }
    }

    private init(workspaceIndex: Int, workspaceName: String) {
        super.init(frame: .zero)
        backgroundColor = UIColor(red: 0.06, green: 0.10, blue: 0.18, alpha: 0.95)
        layer.cornerRadius = 8
        layer.borderWidth = 1.5
        layer.borderColor = UIColor(red: 0.22, green: 0.74, blue: 0.97, alpha: 0.8).cgColor
        layer.shadowColor = UIColor.black.cgColor
        layer.shadowOpacity = 0.6
        layer.shadowOffset = CGSize(width: 0, height: 4)
        layer.shadowRadius = 12

        let stack = UIStackView()
        stack.translatesAutoresizingMaskIntoConstraints = false
        stack.axis = .horizontal
        stack.spacing = 8
        stack.alignment = .center
        addSubview(stack)

        badgeLabel.text = " ⌃\(workspaceIndex + 1) "
        badgeLabel.font = .monospacedSystemFont(ofSize: 11, weight: .bold)
        badgeLabel.textColor = UIColor(red: 0.22, green: 0.74, blue: 0.97, alpha: 1.0)
        badgeLabel.backgroundColor = UIColor(red: 0.22, green: 0.74, blue: 0.97, alpha: 0.2)
        badgeLabel.layer.cornerRadius = 4
        badgeLabel.layer.masksToBounds = true
        stack.addArrangedSubview(badgeLabel)

        titleLabel.text = "Workspace \(workspaceIndex + 1): \(workspaceName)"
        titleLabel.font = .monospacedSystemFont(ofSize: 12, weight: .bold)
        titleLabel.textColor = .white
        stack.addArrangedSubview(titleLabel)

        NSLayoutConstraint.activate([
            stack.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 12),
            stack.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -12),
            stack.topAnchor.constraint(equalTo: topAnchor),
            stack.bottomAnchor.constraint(equalTo: bottomAnchor),
        ])
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
}

// MARK: - Keyboard Split Resizer HUD (c14-keyboard-resizer)

@MainActor
public final class ResizeHudOverlayView: UIView {
    private let badgeLabel = UILabel()
    private let hintsLabel = UILabel()

    public override init(frame: CGRect) {
        super.init(frame: frame)
        setupUI()
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    private func setupUI() {
        backgroundColor = UIColor(red: 0.12, green: 0.09, blue: 0.03, alpha: 0.95)
        layer.cornerRadius = 8
        layer.borderWidth = 1.5
        layer.borderColor = UIColor(red: 0.98, green: 0.75, blue: 0.14, alpha: 0.9).cgColor
        layer.shadowColor = UIColor.black.cgColor
        layer.shadowOpacity = 0.7
        layer.shadowRadius = 14

        let stack = UIStackView()
        stack.translatesAutoresizingMaskIntoConstraints = false
        stack.axis = .horizontal
        stack.spacing = 10
        stack.alignment = .center
        addSubview(stack)

        badgeLabel.font = .monospacedSystemFont(ofSize: 13, weight: .bold)
        badgeLabel.textColor = UIColor(red: 0.98, green: 0.75, blue: 0.14, alpha: 1.0)
        badgeLabel.backgroundColor = UIColor(red: 0.98, green: 0.75, blue: 0.14, alpha: 0.18)
        badgeLabel.layer.cornerRadius = 4
        badgeLabel.layer.masksToBounds = true

        hintsLabel.font = .monospacedSystemFont(ofSize: 11, weight: .medium)
        hintsLabel.textColor = UIColor(white: 0.9, alpha: 1.0)
        hintsLabel.text = "←/→ adjust (5%) · ⇧←/→ (1%) · ↵ / Esc finish"

        stack.addArrangedSubview(badgeLabel)
        stack.addArrangedSubview(hintsLabel)

        NSLayoutConstraint.activate([
            stack.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 14),
            stack.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -14),
            stack.topAnchor.constraint(equalTo: topAnchor),
            stack.bottomAnchor.constraint(equalTo: bottomAnchor),
        ])
    }

    public func updateRatio(_ ratio: Double) {
        let pct1 = Int((ratio * 100).rounded())
        let pct2 = 100 - pct1
        badgeLabel.text = " ↔ Split: \(pct1)% | \(pct2)% "
    }
}

// MARK: - Visual Pane Swap Target Overlay (c15-pane-swap-grid)

@MainActor
public final class PaneSwapTargetOverlayView: UIView {
    public let targetPaneId: String
    public var onSelect: ((String) -> Void)?

    public init(targetPaneId: String, directionHint: String) {
        self.targetPaneId = targetPaneId
        super.init(frame: .zero)
        setupUI(directionHint: directionHint)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    private func setupUI(directionHint: String) {
        backgroundColor = UIColor(red: 0.05, green: 0.15, blue: 0.10, alpha: 0.75)
        layer.borderWidth = 2.0
        layer.borderColor = UIColor(red: 0.20, green: 0.83, blue: 0.60, alpha: 0.8).cgColor

        let badge = UILabel()
        badge.translatesAutoresizingMaskIntoConstraints = false
        badge.text = " [\(directionHint)] Swap Target "
        badge.font = .monospacedSystemFont(ofSize: 14, weight: .bold)
        badge.textColor = UIColor(red: 0.20, green: 0.83, blue: 0.60, alpha: 1.0)
        badge.backgroundColor = UIColor(red: 0.08, green: 0.24, blue: 0.16, alpha: 0.95)
        badge.layer.cornerRadius = 6
        badge.layer.borderWidth = 1.5
        badge.layer.borderColor = UIColor(red: 0.20, green: 0.83, blue: 0.60, alpha: 1.0).cgColor
        badge.layer.masksToBounds = true
        addSubview(badge)

        NSLayoutConstraint.activate([
            badge.centerXAnchor.constraint(equalTo: centerXAnchor),
            badge.centerYAnchor.constraint(equalTo: centerYAnchor),
            badge.heightAnchor.constraint(equalToConstant: 36),
        ])

        let tap = UITapGestureRecognizer(target: self, action: #selector(handleTap))
        addGestureRecognizer(tap)
    }

    @objc private func handleTap() {
        onSelect?(targetPaneId)
    }
}

// MARK: - Empty Pane Tool Scaffolder Deck (c13-pane-creator-deck)

@MainActor
public final class PaneEmptyDeckView: UIView {
    public var onSelectType: ((TabType) -> Void)?

    public override init(frame: CGRect) {
        super.init(frame: frame)
        setupUI()
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    private func setupUI() {
        backgroundColor = UIColor(red: 0.03, green: 0.05, blue: 0.09, alpha: 1.0)

        let container = UIStackView()
        container.translatesAutoresizingMaskIntoConstraints = false
        container.axis = .vertical
        container.spacing = 16
        container.alignment = .center
        addSubview(container)

        let title = UILabel()
        title.text = "Select Tool for Empty Pane"
        title.font = .monospacedSystemFont(ofSize: 13, weight: .bold)
        title.textColor = UIColor(red: 0.22, green: 0.74, blue: 0.97, alpha: 1.0)
        container.addArrangedSubview(title)

        let deck = UIStackView()
        deck.axis = .horizontal
        deck.spacing = 14
        deck.alignment = .center
        deck.distribution = .fillEqually

        deck.addArrangedSubview(makeCard(hotkey: "W", title: "Browser", icon: "globe", type: .web))
        deck.addArrangedSubview(makeCard(hotkey: "S", title: "SSH Terminal", icon: "terminal.fill", type: .ssh))
        deck.addArrangedSubview(makeCard(hotkey: "F", title: "Files", icon: "folder.fill", type: .files))
        container.addArrangedSubview(deck)

        let footer = UILabel()
        footer.text = "Press [W], [S], or [F] on keyboard"
        footer.font = .monospacedSystemFont(ofSize: 11, weight: .medium)
        footer.textColor = UIColor(white: 0.5, alpha: 1.0)
        container.addArrangedSubview(footer)

        NSLayoutConstraint.activate([
            container.centerXAnchor.constraint(equalTo: centerXAnchor),
            container.centerYAnchor.constraint(equalTo: centerYAnchor),
            deck.heightAnchor.constraint(equalToConstant: 80),
        ])
    }

    private func makeCard(hotkey: String, title: String, icon: String, type: TabType) -> UIView {
        let card = UIButton(type: .system)
        card.backgroundColor = UIColor(white: 1.0, alpha: 0.06)
        card.layer.cornerRadius = 8
        card.layer.borderWidth = 1
        card.layer.borderColor = UIColor(white: 1.0, alpha: 0.15).cgColor
        card.translatesAutoresizingMaskIntoConstraints = false
        card.widthAnchor.constraint(equalToConstant: 110).isActive = true
        card.heightAnchor.constraint(equalToConstant: 76).isActive = true

        let keyBadge = UILabel()
        keyBadge.text = " [\(hotkey)] "
        keyBadge.font = .monospacedSystemFont(ofSize: 11, weight: .bold)
        keyBadge.textColor = UIColor(red: 0.22, green: 0.74, blue: 0.97, alpha: 1.0)
        keyBadge.backgroundColor = UIColor(red: 0.22, green: 0.74, blue: 0.97, alpha: 0.18)
        keyBadge.layer.cornerRadius = 3
        keyBadge.layer.masksToBounds = true
        keyBadge.translatesAutoresizingMaskIntoConstraints = false
        card.addSubview(keyBadge)

        let iconView = UIImageView()
        let config = UIImage.SymbolConfiguration(pointSize: 18, weight: .semibold)
        iconView.image = UIImage(systemName: icon, withConfiguration: config)
        iconView.tintColor = .white
        iconView.translatesAutoresizingMaskIntoConstraints = false
        card.addSubview(iconView)

        let label = UILabel()
        label.text = title
        label.font = .systemFont(ofSize: 11, weight: .bold)
        label.textColor = .white
        label.translatesAutoresizingMaskIntoConstraints = false
        card.addSubview(label)

        NSLayoutConstraint.activate([
            keyBadge.topAnchor.constraint(equalTo: card.topAnchor, constant: 6),
            keyBadge.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 6),

            iconView.centerXAnchor.constraint(equalTo: card.centerXAnchor),
            iconView.topAnchor.constraint(equalTo: card.topAnchor, constant: 22),

            label.centerXAnchor.constraint(equalTo: card.centerXAnchor),
            label.bottomAnchor.constraint(equalTo: card.bottomAnchor, constant: -8),
        ])

        card.addAction(UIAction { [weak self] _ in
            self?.onSelectType?(type)
        }, for: .touchUpInside)

        return card
    }
}

// MARK: - Smart Omnibar Suggestions Dropdown (c09-omnibar-launcher)

public struct OmnibarSuggestion {
    public let title: String
    public let subtitle: String
    public let url: String
    public let iconName: String
}

@MainActor
public final class OmnibarDropdownView: UIView {
    private let stack = UIStackView()
    private var suggestions: [OmnibarSuggestion] = []
    public private(set) var selectedIndex: Int = 0
    public var onCommit: ((String) -> Void)?

    public override init(frame: CGRect) {
        super.init(frame: frame)
        setupUI()
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    private func setupUI() {
        backgroundColor = UIColor(red: 0.07, green: 0.10, blue: 0.16, alpha: 0.98)
        layer.cornerRadius = 8
        layer.borderWidth = 1.0
        layer.borderColor = UIColor(red: 0.22, green: 0.74, blue: 0.97, alpha: 0.5).cgColor
        layer.shadowColor = UIColor.black.cgColor
        layer.shadowOpacity = 0.7
        layer.shadowOffset = CGSize(width: 0, height: 6)
        layer.shadowRadius = 14

        stack.translatesAutoresizingMaskIntoConstraints = false
        stack.axis = .vertical
        stack.spacing = 2
        addSubview(stack)

        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: topAnchor, constant: 6),
            stack.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 6),
            stack.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -6),
            stack.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -6),
        ])
    }

    public func update(query: String, bookmarks: [Bookmark]) {
        var list: [OmnibarSuggestion] = []
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)

        // 1. Search engines shortcuts
        if !trimmed.isEmpty {
            let encoded = trimmed.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? trimmed
            list.append(OmnibarSuggestion(
                title: "Google: \(trimmed)",
                subtitle: "Search Google for '\(trimmed)'",
                url: "https://www.google.com/search?q=\(encoded)",
                iconName: "magnifyingglass"
            ))
            list.append(OmnibarSuggestion(
                title: "DuckDuckGo: \(trimmed)",
                subtitle: "Search DuckDuckGo for '\(trimmed)'",
                url: "https://duckduckgo.com/?q=\(encoded)",
                iconName: "magnifyingglass.circle.fill"
            ))
            list.append(OmnibarSuggestion(
                title: "GitHub: \(trimmed)",
                subtitle: "Search GitHub code & repos for '\(trimmed)'",
                url: "https://github.com/search?q=\(encoded)",
                iconName: "terminal.fill"
            ))
        }

        // 2. Bookmarks
        for bm in bookmarks {
            if trimmed.isEmpty || bm.title.localizedCaseInsensitiveContains(trimmed) || bm.url.localizedCaseInsensitiveContains(trimmed) {
                list.append(OmnibarSuggestion(
                    title: bm.title,
                    subtitle: bm.url,
                    url: bm.url,
                    iconName: "star.fill"
                ))
            }
        }

        // 3. Common developer hosts
        let devUrls = [
            ("Local Dev Server", "http://localhost:3000"),
            ("Local API Server", "http://localhost:8080"),
            ("Local Vite Server", "http://localhost:5173"),
            ("GitHub", "https://github.com"),
        ]
        for (devTitle, devUrl) in devUrls {
            if trimmed.isEmpty || devTitle.localizedCaseInsensitiveContains(trimmed) || devUrl.localizedCaseInsensitiveContains(trimmed) {
                list.append(OmnibarSuggestion(
                    title: devTitle,
                    subtitle: devUrl,
                    url: devUrl,
                    iconName: "network"
                ))
            }
        }

        self.suggestions = Array(list.prefix(6))
        self.selectedIndex = 0
        renderRows()
    }

    private func renderRows() {
        stack.arrangedSubviews.forEach {
            stack.removeArrangedSubview($0)
            $0.removeFromSuperview()
        }

        for (idx, item) in suggestions.enumerated() {
            let isSelected = (idx == selectedIndex)
            let row = UIButton(type: .system)
            row.backgroundColor = isSelected ? UIColor(red: 0.22, green: 0.74, blue: 0.97, alpha: 0.25) : .clear
            row.layer.cornerRadius = 4

            let rowStack = UIStackView()
            rowStack.isUserInteractionEnabled = false
            rowStack.axis = .horizontal
            rowStack.spacing = 8
            rowStack.alignment = .center
            rowStack.translatesAutoresizingMaskIntoConstraints = false
            row.addSubview(rowStack)

            let icon = UIImageView()
            let cfg = UIImage.SymbolConfiguration(pointSize: 11, weight: .semibold)
            icon.image = UIImage(systemName: item.iconName, withConfiguration: cfg)
            icon.tintColor = isSelected ? UIColor(red: 0.22, green: 0.74, blue: 0.97, alpha: 1.0) : UIColor(white: 0.6, alpha: 1.0)
            icon.translatesAutoresizingMaskIntoConstraints = false
            icon.widthAnchor.constraint(equalToConstant: 14).isActive = true
            icon.heightAnchor.constraint(equalToConstant: 14).isActive = true
            rowStack.addArrangedSubview(icon)

            let tLbl = UILabel()
            tLbl.text = item.title
            tLbl.font = .systemFont(ofSize: 12, weight: isSelected ? .bold : .medium)
            tLbl.textColor = isSelected ? .white : UIColor(white: 0.85, alpha: 1.0)
            rowStack.addArrangedSubview(tLbl)

            let spacer = UIView()
            rowStack.addArrangedSubview(spacer)

            let subLbl = UILabel()
            subLbl.text = item.subtitle
            subLbl.font = .monospacedSystemFont(ofSize: 10, weight: .regular)
            subLbl.textColor = UIColor(white: 0.5, alpha: 1.0)
            rowStack.addArrangedSubview(subLbl)

            NSLayoutConstraint.activate([
                rowStack.leadingAnchor.constraint(equalTo: row.leadingAnchor, constant: 8),
                rowStack.trailingAnchor.constraint(equalTo: row.trailingAnchor, constant: -8),
                rowStack.topAnchor.constraint(equalTo: row.topAnchor, constant: 4),
                rowStack.bottomAnchor.constraint(equalTo: row.bottomAnchor, constant: -4),
                row.heightAnchor.constraint(equalToConstant: 26),
            ])

            row.addAction(UIAction { [weak self] _ in
                self?.onCommit?(item.url)
            }, for: .touchUpInside)

            stack.addArrangedSubview(row)
        }
    }

    public func selectNext() {
        guard !suggestions.isEmpty else { return }
        selectedIndex = (selectedIndex + 1) % suggestions.count
        renderRows()
    }

    public func selectPrevious() {
        guard !suggestions.isEmpty else { return }
        selectedIndex = (selectedIndex - 1 + suggestions.count) % suggestions.count
        renderRows()
    }

    public var selectedSuggestionUrl: String? {
        guard suggestions.indices.contains(selectedIndex) else { return nil }
        return suggestions[selectedIndex].url
    }
}

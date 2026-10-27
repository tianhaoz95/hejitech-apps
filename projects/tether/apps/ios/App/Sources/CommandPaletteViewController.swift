import TetherKit
import UIKit

public struct CommandPaletteItem {
    public let id: String
    public let title: String
    public let subtitle: String?
    public let category: String
    public let systemImage: String
    public let shortcutHint: String?
    public let action: @MainActor () -> Void

    public init(
        id: String,
        title: String,
        subtitle: String? = nil,
        category: String,
        systemImage: String,
        shortcutHint: String? = nil,
        action: @escaping @MainActor () -> Void
    ) {
        self.id = id
        self.title = title
        self.subtitle = subtitle
        self.category = category
        self.systemImage = systemImage
        self.shortcutHint = shortcutHint
        self.action = action
    }
}

/// Global Command Palette HUD (Cmd+K / Ctrl+K / Cmd+P).
/// Enables 100% keyboard-driven navigation across tabs, panes, SSH hosts, bookmarks, and layout presets.
@MainActor
public final class CommandPaletteViewController: UIViewController, UITextFieldDelegate, UITableViewDelegate, UITableViewDataSource {
    private let store: WorkspaceStore
    private weak var workspaceVC: TilingWorkspaceViewController?

    private var allItems: [CommandPaletteItem] = []
    private var filteredItems: [CommandPaletteItem] = []
    private var selectedIndex: Int = 0

    private let backdropView = UIView()
    private let dialogCard = UIView()
    private let searchField = UITextField()
    private let tableView = UITableView(frame: .zero, style: .plain)
    private let footerLabel = UILabel()

    public init(store: WorkspaceStore, workspaceVC: TilingWorkspaceViewController?) {
        self.store = store
        self.workspaceVC = workspaceVC
        super.init(nibName: nil, bundle: nil)
        modalPresentationStyle = .overFullScreen
        modalTransitionStyle = .crossDissolve
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    public override func viewDidLoad() {
        super.viewDidLoad()
        buildAllItems()
        setupUI()
        filterItems(query: "")
    }

    public override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        searchField.becomeFirstResponder()
    }

    private func buildAllItems() {
        var items: [CommandPaletteItem] = []

        // 1. Tab & Pane Operations
        items.append(CommandPaletteItem(
            id: "new-web",
            title: "New Web Tab",
            subtitle: "Open a new web browser tab",
            category: "Tabs",
            systemImage: "globe",
            shortcutHint: "⌘T"
        ) { [weak self] in
            self?.store.openTab(type: .web)
        })

        items.append(CommandPaletteItem(
            id: "new-ssh",
            title: "New SSH Terminal Tab",
            subtitle: "Open a secure terminal session",
            category: "Tabs",
            systemImage: "terminal.fill",
            shortcutHint: "⌘⇧T"
        ) { [weak self] in
            self?.store.openTab(type: .ssh)
        })

        items.append(CommandPaletteItem(
            id: "new-files",
            title: "New File Explorer Tab",
            subtitle: "Browse local or remote files",
            category: "Tabs",
            systemImage: "folder.fill",
            shortcutHint: "⌘⇧F"
        ) { [weak self] in
            self?.store.openTab(type: .files)
        })

        items.append(CommandPaletteItem(
            id: "close-tab",
            title: "Close Active Tab",
            subtitle: "Close the currently focused tab",
            category: "Tabs",
            systemImage: "xmark.circle",
            shortcutHint: "⌘W"
        ) { [weak self] in
            self?.store.closeTab()
        })

        items.append(CommandPaletteItem(
            id: "next-tab",
            title: "Next Tab",
            subtitle: "Cycle forward through tabs in pane",
            category: "Tabs",
            systemImage: "arrow.right.circle",
            shortcutHint: "Ctrl+Tab"
        ) { [weak self] in
            guard let self else { return }
            self.store.tree = PaneTreeOps.selectNextTab(self.store.tree, reverse: false)
        })

        items.append(CommandPaletteItem(
            id: "prev-tab",
            title: "Previous Tab",
            subtitle: "Cycle backward through tabs in pane",
            category: "Tabs",
            systemImage: "arrow.left.circle",
            shortcutHint: "Ctrl+⇧Tab"
        ) { [weak self] in
            guard let self else { return }
            self.store.tree = PaneTreeOps.selectNextTab(self.store.tree, reverse: true)
        })

        // 2. Layout Presets & Split Panes
        items.append(CommandPaletteItem(
            id: "layout-single",
            title: "Layout: Single Pane",
            subtitle: "Maximize workspace to 1 large pane",
            category: "Layout",
            systemImage: "rectangle",
            shortcutHint: "⌘1"
        ) { [weak self] in
            self?.store.applyPreset(.single)
        })

        items.append(CommandPaletteItem(
            id: "layout-2col",
            title: "Layout: Two Columns (50 / 50)",
            subtitle: "Side-by-side equal split",
            category: "Layout",
            systemImage: "rectangle.split.2x1",
            shortcutHint: "⌘2"
        ) { [weak self] in
            self?.store.applyPreset(.twoColumn)
        })

        items.append(CommandPaletteItem(
            id: "layout-1plus2",
            title: "Layout: 1 Left + 2 Stacked Right",
            subtitle: "Main focus pane with two utility panes",
            category: "Layout",
            systemImage: "rectangle.split.3x1",
            shortcutHint: "⌘3"
        ) { [weak self] in
            self?.store.applyPreset(.leftPlusTwoRight)
        })

        items.append(CommandPaletteItem(
            id: "layout-2x2",
            title: "Layout: 2 × 2 Grid (4 Panes)",
            subtitle: "Four independent quadrant panes",
            category: "Layout",
            systemImage: "rectangle.split.2x2",
            shortcutHint: "⌘4"
        ) { [weak self] in
            self?.store.applyPreset(.twoByTwo)
        })

        items.append(CommandPaletteItem(
            id: "split-vert",
            title: "Split Pane Vertically",
            subtitle: "Divide focused pane side-by-side",
            category: "Layout",
            systemImage: "rectangle.split.2x1",
            shortcutHint: "⌘D"
        ) { [weak self] in
            self?.store.splitFocusedPane(.horizontal)
        })

        items.append(CommandPaletteItem(
            id: "split-horiz",
            title: "Split Pane Horizontally",
            subtitle: "Divide focused pane top and bottom",
            category: "Layout",
            systemImage: "rectangle.split.1x2",
            shortcutHint: "⌘⇧D"
        ) { [weak self] in
            self?.store.splitFocusedPane(.vertical)
        })

        items.append(CommandPaletteItem(
            id: "close-pane",
            title: "Close Focused Pane",
            subtitle: "Close pane and redistribute remaining tabs",
            category: "Layout",
            systemImage: "xmark.square",
            shortcutHint: "⌘⇧W"
        ) { [weak self] in
            self?.store.closePane()
        })

        items.append(CommandPaletteItem(
            id: "toggle-max",
            title: "Toggle Maximize Focused Pane",
            subtitle: "Temporarily expand pane to full workspace",
            category: "Layout",
            systemImage: "arrow.up.left.and.arrow.down.right",
            shortcutHint: "⌘⇧M"
        ) { [weak self] in
            self?.store.toggleMaximiseFocusedPane()
        })

        // 3. Web & Authentication Actions
        items.append(CommandPaletteItem(
            id: "focus-address",
            title: "Focus Address Bar / Search",
            subtitle: "Type URL or search query in active web tab",
            category: "Browser",
            systemImage: "text.cursor",
            shortcutHint: "⌘L"
        ) { [weak self] in
            self?.workspaceVC?.activeWebTabController()?.focusAddressBar()
        })

        items.append(CommandPaletteItem(
            id: "reload-page",
            title: "Reload Current Web Page",
            subtitle: "Refresh the content of the focused tab",
            category: "Browser",
            systemImage: "arrow.clockwise",
            shortcutHint: "⌘R"
        ) { [weak self] in
            self?.workspaceVC?.activeWebTabController()?.reloadCurrentPage()
        })

        items.append(CommandPaletteItem(
            id: "starter-page",
            title: "Open Starter Web Page",
            subtitle: "Display the clean Tether starter dashboard",
            category: "Browser",
            systemImage: "house.fill",
            shortcutHint: nil
        ) { [weak self] in
            self?.store.openTab(type: .web, url: TetherConstants.defaultWebHomeURL)
        })

        // 4. All Open Tabs (Jump to Tab)
        for pane in store.panes {
            for tab in pane.tabs {
                let icon: String
                switch tab.type {
                case .web: icon = "globe"
                case .ssh: icon = "terminal"
                case .files: icon = "folder"
                }
                items.append(CommandPaletteItem(
                    id: "tab-\(tab.id)",
                    title: "Switch to: \(tab.title)",
                    subtitle: "Pane \(pane.id.suffix(4)) · \(tab.type.displayName)",
                    category: "Open Tabs",
                    systemImage: icon,
                    shortcutHint: nil
                ) { [weak self] in
                    guard let self else { return }
                    self.store.tree = PaneTreeOps.focusPane(self.store.tree, paneId: pane.id)
                    self.store.tree = PaneTreeOps.selectTab(self.store.tree, paneId: pane.id, tabId: tab.id)
                }
                )
            }
        }

        // 5. SSH Hosts (Quick Connect)
        for host in store.hosts {
            items.append(CommandPaletteItem(
                id: "host-\(host.id)",
                title: "SSH Connect: \(host.displayTitle)",
                subtitle: "\(host.connectionString) · \(host.auth.displayName)",
                category: "SSH Hosts",
                systemImage: "terminal.fill",
                shortcutHint: nil
            ) { [weak self] in
                self?.store.openTab(type: .ssh, hostId: host.id)
            })
        }

        // 6. Bookmarks (Quick Open)
        for bm in store.bookmarks {
            items.append(CommandPaletteItem(
                id: "bm-\(bm.id)",
                title: "Open Bookmark: \(bm.title)",
                subtitle: bm.url,
                category: "Bookmarks",
                systemImage: "star.fill",
                shortcutHint: nil
            ) { [weak self] in
                self?.store.openTab(type: .web, url: bm.url)
            })
        }

        // 7. Controller & Preferences
        items.append(CommandPaletteItem(
            id: "toggle-orientation",
            title: "Toggle Phone Orientation",
            subtitle: "Switch phone between Landscape and Portrait",
            category: "Settings",
            systemImage: "rectangle.landscape.rotate",
            shortcutHint: nil
        ) { [weak self] in
            guard let self else { return }
            let next: ControllerOrientation = self.store.settings.controllerOrientation == .landscape ? .portrait : .landscape
            self.store.settings.controllerOrientation = next
            DisplayHost.shared.phoneControllerVC?.applyOrientationChange(next)
        })

        items.append(CommandPaletteItem(
            id: "toggle-sidebar",
            title: "Toggle Sidebar Position",
            subtitle: "Switch phone controller sidebar between Left and Right",
            category: "Settings",
            systemImage: "sidebar.left",
            shortcutHint: nil
        ) { [weak self] in
            guard let self else { return }
            let next: ControllerSidebarPosition = self.store.settings.controllerSidebarPosition == .left ? .right : .left
            self.store.settings.controllerSidebarPosition = next
        })

        items.append(CommandPaletteItem(
            id: "toggle-touchpad-buttons",
            title: "Toggle Touchpad Buttons",
            subtitle: "Show or hide bottom Click & Resize buttons on phone trackpad",
            category: "Settings",
            systemImage: "computermouse.fill",
            shortcutHint: nil
        ) { [weak self] in
            guard let self else { return }
            self.store.settings.showTouchpadButtons.toggle()
        })

        items.append(CommandPaletteItem(
            id: "open-settings",
            title: "Open Settings",
            subtitle: "Themes, layouts, search engines, and cloud sync",
            category: "Settings",
            systemImage: "gearshape.fill",
            shortcutHint: "⌘,"
        ) { [weak self] in
            self?.workspaceVC?.openSettingsTapped()
        })

        self.allItems = items
    }

    private func setupUI() {
        view.backgroundColor = .clear

        backdropView.translatesAutoresizingMaskIntoConstraints = false
        backdropView.backgroundColor = UIColor(white: 0.0, alpha: 0.65)
        let tap = UITapGestureRecognizer(target: self, action: #selector(handleBackdropTapped))
        backdropView.addGestureRecognizer(tap)
        view.addSubview(backdropView)

        dialogCard.translatesAutoresizingMaskIntoConstraints = false
        dialogCard.backgroundColor = UIColor(red: 0.07, green: 0.10, blue: 0.16, alpha: 0.98)
        dialogCard.layer.cornerRadius = 14
        dialogCard.layer.borderWidth = 1
        dialogCard.layer.borderColor = UIColor(red: 0.22, green: 0.74, blue: 0.97, alpha: 0.35).cgColor
        dialogCard.layer.shadowColor = UIColor.black.cgColor
        dialogCard.layer.shadowOpacity = 0.5
        dialogCard.layer.shadowOffset = CGSize(width: 0, height: 10)
        dialogCard.layer.shadowRadius = 25
        dialogCard.clipsToBounds = true
        view.addSubview(dialogCard)

        // Search Input Header
        let searchHeader = UIView()
        searchHeader.translatesAutoresizingMaskIntoConstraints = false
        searchHeader.backgroundColor = UIColor(red: 0.09, green: 0.13, blue: 0.22, alpha: 1.0)

        let searchIcon = UIImageView(image: UIImage(systemName: "magnifyingglass"))
        searchIcon.translatesAutoresizingMaskIntoConstraints = false
        searchIcon.tintColor = UIColor(red: 0.22, green: 0.74, blue: 0.97, alpha: 1.0)
        searchIcon.contentMode = .scaleAspectFit

        searchField.translatesAutoresizingMaskIntoConstraints = false
        searchField.delegate = self
        searchField.placeholder = "Type a command, tab, host, or action… (Esc to exit)"
        searchField.font = .systemFont(ofSize: 15, weight: .medium)
        searchField.textColor = .white
        searchField.tintColor = UIColor(red: 0.22, green: 0.74, blue: 0.97, alpha: 1.0)
        searchField.autocorrectionType = .no
        searchField.autocapitalizationType = .none
        searchField.clearButtonMode = .whileEditing
        searchField.addTarget(self, action: #selector(handleSearchChanged), for: .editingChanged)

        searchHeader.addSubview(searchIcon)
        searchHeader.addSubview(searchField)

        // Table View
        tableView.translatesAutoresizingMaskIntoConstraints = false
        tableView.backgroundColor = .clear
        tableView.separatorColor = UIColor(white: 1.0, alpha: 0.08)
        tableView.delegate = self
        tableView.dataSource = self
        tableView.rowHeight = 48
        tableView.keyboardDismissMode = .none
        tableView.register(CommandPaletteCell.self, forCellReuseIdentifier: "CommandCell")

        // Footer
        let footerBar = UIView()
        footerBar.translatesAutoresizingMaskIntoConstraints = false
        footerBar.backgroundColor = UIColor(red: 0.05, green: 0.07, blue: 0.12, alpha: 1.0)

        footerLabel.translatesAutoresizingMaskIntoConstraints = false
        footerLabel.font = .systemFont(ofSize: 11, weight: .regular)
        footerLabel.textColor = UIColor(white: 1.0, alpha: 0.5)
        footerLabel.text = "↑/↓ to navigate  •  ↵ to run  •  esc to cancel"
        footerBar.addSubview(footerLabel)

        dialogCard.addSubview(searchHeader)
        dialogCard.addSubview(tableView)
        dialogCard.addSubview(footerBar)

        NSLayoutConstraint.activate([
            backdropView.topAnchor.constraint(equalTo: view.topAnchor),
            backdropView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            backdropView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            backdropView.bottomAnchor.constraint(equalTo: view.bottomAnchor),

            dialogCard.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            dialogCard.centerYAnchor.constraint(equalTo: view.centerYAnchor, constant: -40),
            dialogCard.widthAnchor.constraint(equalTo: view.widthAnchor, multiplier: 0.75, constant: 0),
            dialogCard.widthAnchor.constraint(lessThanOrEqualToConstant: 580),
            dialogCard.widthAnchor.constraint(greaterThanOrEqualToConstant: 320),
            dialogCard.heightAnchor.constraint(equalToConstant: 380),

            searchHeader.topAnchor.constraint(equalTo: dialogCard.topAnchor),
            searchHeader.leadingAnchor.constraint(equalTo: dialogCard.leadingAnchor),
            searchHeader.trailingAnchor.constraint(equalTo: dialogCard.trailingAnchor),
            searchHeader.heightAnchor.constraint(equalToConstant: 48),

            searchIcon.leadingAnchor.constraint(equalTo: searchHeader.leadingAnchor, constant: 14),
            searchIcon.centerYAnchor.constraint(equalTo: searchHeader.centerYAnchor),
            searchIcon.widthAnchor.constraint(equalToConstant: 18),
            searchIcon.heightAnchor.constraint(equalToConstant: 18),

            searchField.leadingAnchor.constraint(equalTo: searchIcon.trailingAnchor, constant: 10),
            searchField.trailingAnchor.constraint(equalTo: searchHeader.trailingAnchor, constant: -14),
            searchField.centerYAnchor.constraint(equalTo: searchHeader.centerYAnchor),

            tableView.topAnchor.constraint(equalTo: searchHeader.bottomAnchor),
            tableView.leadingAnchor.constraint(equalTo: dialogCard.leadingAnchor),
            tableView.trailingAnchor.constraint(equalTo: dialogCard.trailingAnchor),
            tableView.bottomAnchor.constraint(equalTo: footerBar.topAnchor),

            footerBar.leadingAnchor.constraint(equalTo: dialogCard.leadingAnchor),
            footerBar.trailingAnchor.constraint(equalTo: dialogCard.trailingAnchor),
            footerBar.bottomAnchor.constraint(equalTo: dialogCard.bottomAnchor),
            footerBar.heightAnchor.constraint(equalToConstant: 28),

            footerLabel.leadingAnchor.constraint(equalTo: footerBar.leadingAnchor, constant: 14),
            footerLabel.centerYAnchor.constraint(equalTo: footerBar.centerYAnchor),
        ])
    }

    @objc private func handleBackdropTapped() {
        dismiss(animated: true)
    }

    @objc private func handleSearchChanged() {
        let q = (searchField.text ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        filterItems(query: q)
    }

    private func filterItems(query: String) {
        if query.isEmpty {
            filteredItems = allItems
        } else {
            filteredItems = allItems.filter { item in
                item.title.lowercased().contains(query) ||
                (item.subtitle?.lowercased().contains(query) ?? false) ||
                item.category.lowercased().contains(query) ||
                (item.shortcutHint?.lowercased().contains(query) ?? false)
            }
        }
        selectedIndex = 0
        tableView.reloadData()
        if !filteredItems.isEmpty {
            tableView.selectRow(at: IndexPath(row: 0, section: 0), animated: false, scrollPosition: .top)
        }
    }

    public func executeSelectedItem() {
        guard !filteredItems.isEmpty, selectedIndex < filteredItems.count else { return }
        let item = filteredItems[selectedIndex]
        dismiss(animated: true) {
            item.action()
        }
    }

    // MARK: - Key Handling in Command Palette

    public override func pressesBegan(_ presses: Set<UIPress>, with event: UIPressesEvent?) {
        for press in presses {
            guard let key = press.key else { continue }
            switch key.keyCode {
            case .keyboardDownArrow:
                if selectedIndex < filteredItems.count - 1 {
                    selectedIndex += 1
                    let ip = IndexPath(row: selectedIndex, section: 0)
                    tableView.selectRow(at: ip, animated: true, scrollPosition: .middle)
                }
                return
            case .keyboardUpArrow:
                if selectedIndex > 0 {
                    selectedIndex -= 1
                    let ip = IndexPath(row: selectedIndex, section: 0)
                    tableView.selectRow(at: ip, animated: true, scrollPosition: .middle)
                }
                return
            case .keyboardReturnOrEnter:
                executeSelectedItem()
                return
            case .keyboardEscape:
                dismiss(animated: true)
                return
            default:
                break
            }
        }
        super.pressesBegan(presses, with: event)
    }

    public func textFieldShouldReturn(_ textField: UITextField) -> Bool {
        executeSelectedItem()
        return true
    }

    // MARK: - UITableViewDataSource & Delegate

    public func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        filteredItems.count
    }

    public func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        let cell = tableView.dequeueReusableCell(withIdentifier: "CommandCell", for: indexPath) as! CommandPaletteCell
        let item = filteredItems[indexPath.row]
        cell.configure(item: item)
        return cell
    }

    public func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
        selectedIndex = indexPath.row
        executeSelectedItem()
    }
}

final class CommandPaletteCell: UITableViewCell {
    private let iconView = UIImageView()
    private let titleLabel = UILabel()
    private let subtitleLabel = UILabel()
    private let shortcutBadge = UILabel()
    private let textStack = UIStackView()

    override init(style: UITableViewCell.CellStyle, reuseIdentifier: String?) {
        super.init(style: style, reuseIdentifier: reuseIdentifier)
        backgroundColor = .clear
        let selectedBg = UIView()
        selectedBg.backgroundColor = UIColor(red: 0.22, green: 0.74, blue: 0.97, alpha: 0.22)
        selectedBackgroundView = selectedBg

        iconView.translatesAutoresizingMaskIntoConstraints = false
        iconView.tintColor = UIColor(red: 0.22, green: 0.74, blue: 0.97, alpha: 1.0)
        iconView.contentMode = .scaleAspectFit

        titleLabel.font = .systemFont(ofSize: 13, weight: .semibold)
        titleLabel.textColor = .white

        subtitleLabel.font = .systemFont(ofSize: 11, weight: .regular)
        subtitleLabel.textColor = UIColor(white: 1.0, alpha: 0.5)

        textStack.translatesAutoresizingMaskIntoConstraints = false
        textStack.axis = .vertical
        textStack.spacing = 2
        textStack.addArrangedSubview(titleLabel)
        textStack.addArrangedSubview(subtitleLabel)

        shortcutBadge.translatesAutoresizingMaskIntoConstraints = false
        shortcutBadge.font = .monospacedSystemFont(ofSize: 11, weight: .bold)
        shortcutBadge.textColor = UIColor(red: 0.22, green: 0.74, blue: 0.97, alpha: 1.0)
        shortcutBadge.backgroundColor = UIColor(white: 1.0, alpha: 0.08)
        shortcutBadge.layer.cornerRadius = 4
        shortcutBadge.clipsToBounds = true
        shortcutBadge.textAlignment = .center

        contentView.addSubview(iconView)
        contentView.addSubview(textStack)
        contentView.addSubview(shortcutBadge)

        NSLayoutConstraint.activate([
            iconView.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 14),
            iconView.centerYAnchor.constraint(equalTo: contentView.centerYAnchor),
            iconView.widthAnchor.constraint(equalToConstant: 20),
            iconView.heightAnchor.constraint(equalToConstant: 20),

            textStack.leadingAnchor.constraint(equalTo: iconView.trailingAnchor, constant: 12),
            textStack.trailingAnchor.constraint(lessThanOrEqualTo: shortcutBadge.leadingAnchor, constant: -8),
            textStack.centerYAnchor.constraint(equalTo: contentView.centerYAnchor),

            shortcutBadge.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -14),
            shortcutBadge.centerYAnchor.constraint(equalTo: contentView.centerYAnchor),
            shortcutBadge.heightAnchor.constraint(equalToConstant: 20),
        ])
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    func configure(item: CommandPaletteItem) {
        iconView.image = UIImage(systemName: item.systemImage)
        titleLabel.text = item.title
        subtitleLabel.text = item.subtitle
        subtitleLabel.isHidden = (item.subtitle == nil)

        if let shortcut = item.shortcutHint, !shortcut.isEmpty {
            shortcutBadge.isHidden = false
            shortcutBadge.text = " \(shortcut) "
        } else {
            shortcutBadge.isHidden = true
            shortcutBadge.text = nil
        }
    }
}

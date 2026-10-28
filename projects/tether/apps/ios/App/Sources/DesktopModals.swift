import CryptoKit
import TetherKit
import UIKit

// MARK: - Desktop Hosts & Keys Modal View (PRD §4, §12)

@MainActor
public final class DesktopHostsModalView: UIView, UITableViewDataSource, UITableViewDelegate {
    private let backdrop = UIView()
    private let card = UIView()
    private let titleLabel = UILabel()
    private let closeButton = UIButton(type: .system)
    private let addHostButton = UIButton(type: .system)
    private let generateKeyButton = UIButton(type: .system)
    private let tableView = UITableView(frame: .zero, style: .plain)

    private let store: WorkspaceStore
    public var onConnect: ((SshHost) -> Void)?
    public var onDismiss: (() -> Void)?

    public init(store: WorkspaceStore, onConnect: ((SshHost) -> Void)? = nil) {
        self.store = store
        self.onConnect = onConnect
        super.init(frame: .zero)
        setupUI()
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    private func setupUI() {
        backdrop.backgroundColor = UIColor(white: 0, alpha: 0.65)
        backdrop.translatesAutoresizingMaskIntoConstraints = false
        let tap = UITapGestureRecognizer(target: self, action: #selector(handleBackdropTap(_:)))
        backdrop.addGestureRecognizer(tap)
        addSubview(backdrop)

        card.backgroundColor = UIColor(red: 0.08, green: 0.11, blue: 0.18, alpha: 1.0)
        card.layer.cornerRadius = 14
        card.layer.borderWidth = 1.5
        card.layer.borderColor = UIColor(red: 0.22, green: 0.74, blue: 0.97, alpha: 0.35).cgColor
        card.layer.shadowColor = UIColor.black.cgColor
        card.layer.shadowOpacity = 0.8
        card.layer.shadowOffset = CGSize(width: 0, height: 10)
        card.layer.shadowRadius = 24
        card.translatesAutoresizingMaskIntoConstraints = false
        addSubview(card)

        titleLabel.text = "SSH Hosts & Keys"
        titleLabel.font = .monospacedSystemFont(ofSize: 16, weight: .bold)
        titleLabel.textColor = UIColor(red: 0.22, green: 0.74, blue: 0.97, alpha: 1.0)
        titleLabel.translatesAutoresizingMaskIntoConstraints = false
        card.addSubview(titleLabel)

        let xConfig = UIImage.SymbolConfiguration(pointSize: 14, weight: .bold)
        closeButton.setImage(UIImage(systemName: "xmark", withConfiguration: xConfig), for: .normal)
        closeButton.tintColor = UIColor(white: 1.0, alpha: 0.6)
        closeButton.backgroundColor = UIColor(white: 1.0, alpha: 0.08)
        closeButton.layer.cornerRadius = 14
        closeButton.translatesAutoresizingMaskIntoConstraints = false
        closeButton.addTarget(self, action: #selector(dismissModal), for: .touchUpInside)
        card.addSubview(closeButton)

        addHostButton.setTitle("+ Add Host", for: .normal)
        addHostButton.titleLabel?.font = .monospacedSystemFont(ofSize: 12, weight: .bold)
        addHostButton.setTitleColor(UIColor(red: 0.22, green: 0.74, blue: 0.97, alpha: 1.0), for: .normal)
        addHostButton.backgroundColor = UIColor(white: 1.0, alpha: 0.08)
        addHostButton.layer.cornerRadius = 6
        addHostButton.translatesAutoresizingMaskIntoConstraints = false
        addHostButton.addTarget(self, action: #selector(handleAddHostTapped), for: .touchUpInside)
        card.addSubview(addHostButton)

        generateKeyButton.setTitle("🔑 Keys", for: .normal)
        generateKeyButton.titleLabel?.font = .monospacedSystemFont(ofSize: 12, weight: .bold)
        generateKeyButton.setTitleColor(.white, for: .normal)
        generateKeyButton.backgroundColor = UIColor(white: 1.0, alpha: 0.08)
        generateKeyButton.layer.cornerRadius = 6
        generateKeyButton.translatesAutoresizingMaskIntoConstraints = false
        generateKeyButton.addTarget(self, action: #selector(handleKeysTapped), for: .touchUpInside)
        card.addSubview(generateKeyButton)

        tableView.backgroundColor = .clear
        tableView.separatorColor = UIColor(white: 1.0, alpha: 0.1)
        tableView.dataSource = self
        tableView.delegate = self
        tableView.register(DesktopHostCell.self, forCellReuseIdentifier: "HostCell")
        tableView.translatesAutoresizingMaskIntoConstraints = false
        card.addSubview(tableView)

        NSLayoutConstraint.activate([
            backdrop.topAnchor.constraint(equalTo: topAnchor),
            backdrop.leadingAnchor.constraint(equalTo: leadingAnchor),
            backdrop.trailingAnchor.constraint(equalTo: trailingAnchor),
            backdrop.bottomAnchor.constraint(equalTo: bottomAnchor),

            card.centerXAnchor.constraint(equalTo: centerXAnchor),
            card.centerYAnchor.constraint(equalTo: centerYAnchor),
            card.widthAnchor.constraint(equalToConstant: min(680, UIScreen.main.bounds.width - 40)),
            card.heightAnchor.constraint(equalToConstant: min(480, UIScreen.main.bounds.height - 60)),

            titleLabel.topAnchor.constraint(equalTo: card.topAnchor, constant: 16),
            titleLabel.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 20),

            closeButton.topAnchor.constraint(equalTo: card.topAnchor, constant: 14),
            closeButton.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -16),
            closeButton.widthAnchor.constraint(equalToConstant: 28),
            closeButton.heightAnchor.constraint(equalToConstant: 28),

            generateKeyButton.centerYAnchor.constraint(equalTo: titleLabel.centerYAnchor),
            generateKeyButton.trailingAnchor.constraint(equalTo: closeButton.leadingAnchor, constant: -12),
            generateKeyButton.heightAnchor.constraint(equalToConstant: 28),
            generateKeyButton.widthAnchor.constraint(equalToConstant: 80),

            addHostButton.centerYAnchor.constraint(equalTo: titleLabel.centerYAnchor),
            addHostButton.trailingAnchor.constraint(equalTo: generateKeyButton.leadingAnchor, constant: -8),
            addHostButton.heightAnchor.constraint(equalToConstant: 28),
            addHostButton.widthAnchor.constraint(equalToConstant: 95),

            tableView.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 16),
            tableView.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 12),
            tableView.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -12),
            tableView.bottomAnchor.constraint(equalTo: card.bottomAnchor, constant: -16),
        ])
    }

    @objc private func handleBackdropTap(_ gesture: UITapGestureRecognizer) {
        let pt = gesture.location(in: self)
        if !card.frame.contains(pt) {
            dismissModal()
        }
    }

    @objc public func dismissModal() {
        onDismiss?()
        removeFromSuperview()
    }

    @objc private func handleAddHostTapped() {
        guard let ws = findWorkspace() else { return }
        ws.showDesktopDialog(
            title: "Add SSH Host",
            message: "Enter hostname or IP address (e.g. 192.168.1.50):",
            actions: [
                DesktopAlertAction(title: "Cancel", style: .cancel),
                DesktopAlertAction(title: "Next", style: .default) { [weak self, weak ws] hostStr in
                    guard let self, let ws, let hostStr = hostStr?.trimmingCharacters(in: .whitespacesAndNewlines), !hostStr.isEmpty else { return }
                    ws.showDesktopDialog(
                        title: "SSH Username",
                        message: "Enter username for \(hostStr):",
                        actions: [
                            DesktopAlertAction(title: "Cancel", style: .cancel),
                            DesktopAlertAction(title: "Save Host", style: .default) { [weak self] userStr in
                                guard let self else { return }
                                let user = userStr?.trimmingCharacters(in: .whitespacesAndNewlines) ?? "root"
                                let newHost = SshHost(
                                    label: hostStr,
                                    host: hostStr,
                                    port: 22,
                                    username: user.isEmpty ? "root" : user,
                                    auth: .password,
                                    autoConnect: false
                                )
                                self.store.hosts.append(newHost)
                                self.tableView.reloadData()
                            }
                        ],
                        textFieldPlaceholder: "root",
                        textFieldDefaultText: "root"
                    )
                }
            ],
            textFieldPlaceholder: "192.168.1.50"
        )
    }

    @objc private func handleKeysTapped() {
        guard let ws = findWorkspace() else { return }
        let keys = store.secureStore.listSshKeys()
        let desc = keys.isEmpty ? "No stored SSH keys yet." : "Stored Keys: " + keys.map(\.label).joined(separator: ", ")
        ws.showDesktopDialog(
            title: "SSH Key Management",
            message: "\(desc)\n\nGenerate a new Ed25519 key pair stored securely in Keychain:",
            actions: [
                DesktopAlertAction(title: "Cancel", style: .cancel),
                DesktopAlertAction(title: "Generate Key", style: .default) { [weak self] label in
                    guard let self else { return }
                    let keyLabel = (label?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false) ? label! : "Tether Key"
                    let newKey = SshKeyGenerator.generateEd25519Key(id: "key-\(UUID().uuidString.prefix(8))", label: keyLabel)
                    self.store.secureStore.saveSshKey(newKey)
                    self.tableView.reloadData()
                }
            ],
            textFieldPlaceholder: "Key label (e.g. My MacBook Key)",
            textFieldDefaultText: "Tether Ed25519 Key"
        )
    }

    private func findWorkspace() -> TilingWorkspaceViewController? {
        var current: UIResponder? = self
        while let r = current {
            if let ws = r as? TilingWorkspaceViewController { return ws }
            current = r.next
        }
        return nil
    }

    // MARK: - UITableViewDataSource & Delegate

    public func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        return max(1, store.hosts.count)
    }

    public func tableView(_ tableView: UITableView, heightForRowAt indexPath: IndexPath) -> CGFloat {
        return 58
    }

    public func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        guard !store.hosts.isEmpty else {
            let cell = UITableViewCell(style: .default, reuseIdentifier: "EmptyCell")
            cell.backgroundColor = .clear
            cell.textLabel?.text = "No SSH hosts saved yet. Click '+ Add Host' above."
            cell.textLabel?.font = .monospacedSystemFont(ofSize: 12, weight: .regular)
            cell.textLabel?.textColor = UIColor(white: 1.0, alpha: 0.5)
            cell.textLabel?.textAlignment = .center
            cell.selectionStyle = .none
            return cell
        }

        let cell = tableView.dequeueReusableCell(withIdentifier: "HostCell", for: indexPath) as! DesktopHostCell
        let host = store.hosts[indexPath.row]
        let hasPassword = store.secureStore.loadHostPassword(forHostId: host.id) != nil
        cell.configure(host: host, hasPassword: hasPassword, onConnect: { [weak self] in
            self?.dismissModal()
            self?.onConnect?(host)
        }, onDelete: { [weak self] in
            guard let self else { return }
            self.store.secureStore.deleteHostPassword(forHostId: host.id)
            self.store.hosts.remove(at: indexPath.row)
            self.tableView.reloadData()
        })
        return cell
    }
}

// MARK: - Desktop Host Table Cell

final class DesktopHostCell: UITableViewCell {
    private let titleLabel = UILabel()
    private let subtitleLabel = UILabel()
    private let connectButton = UIButton(type: .system)
    private let deleteButton = UIButton(type: .system)
    private var onConnectAction: (() -> Void)?
    private var onDeleteAction: (() -> Void)?

    override init(style: UITableViewCell.CellStyle, reuseIdentifier: String?) {
        super.init(style: style, reuseIdentifier: reuseIdentifier)
        backgroundColor = .clear
        selectionStyle = .none

        titleLabel.font = .monospacedSystemFont(ofSize: 13, weight: .bold)
        titleLabel.textColor = .white
        titleLabel.translatesAutoresizingMaskIntoConstraints = false

        subtitleLabel.font = .monospacedSystemFont(ofSize: 11, weight: .regular)
        subtitleLabel.textColor = UIColor(red: 0.22, green: 0.74, blue: 0.97, alpha: 0.9)
        subtitleLabel.translatesAutoresizingMaskIntoConstraints = false

        connectButton.setTitle("Connect", for: .normal)
        connectButton.titleLabel?.font = .systemFont(ofSize: 12, weight: .bold)
        connectButton.setTitleColor(.white, for: .normal)
        connectButton.backgroundColor = UIColor(red: 0.12, green: 0.55, blue: 0.95, alpha: 1.0)
        connectButton.layer.cornerRadius = 6
        connectButton.translatesAutoresizingMaskIntoConstraints = false
        connectButton.addTarget(self, action: #selector(handleConnect), for: .touchUpInside)

        deleteButton.setTitle("✕", for: .normal)
        deleteButton.titleLabel?.font = .systemFont(ofSize: 12, weight: .bold)
        deleteButton.setTitleColor(UIColor(red: 0.95, green: 0.35, blue: 0.35, alpha: 1.0), for: .normal)
        deleteButton.backgroundColor = UIColor(white: 1.0, alpha: 0.08)
        deleteButton.layer.cornerRadius = 6
        deleteButton.translatesAutoresizingMaskIntoConstraints = false
        deleteButton.addTarget(self, action: #selector(handleDelete), for: .touchUpInside)

        contentView.addSubview(titleLabel)
        contentView.addSubview(subtitleLabel)
        contentView.addSubview(connectButton)
        contentView.addSubview(deleteButton)

        NSLayoutConstraint.activate([
            titleLabel.topAnchor.constraint(equalTo: contentView.topAnchor, constant: 10),
            titleLabel.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 12),
            titleLabel.trailingAnchor.constraint(lessThanOrEqualTo: connectButton.leadingAnchor, constant: -10),

            subtitleLabel.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 3),
            subtitleLabel.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 12),
            subtitleLabel.trailingAnchor.constraint(lessThanOrEqualTo: connectButton.leadingAnchor, constant: -10),

            deleteButton.centerYAnchor.constraint(equalTo: contentView.centerYAnchor),
            deleteButton.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -8),
            deleteButton.widthAnchor.constraint(equalToConstant: 28),
            deleteButton.heightAnchor.constraint(equalToConstant: 28),

            connectButton.centerYAnchor.constraint(equalTo: contentView.centerYAnchor),
            connectButton.trailingAnchor.constraint(equalTo: deleteButton.leadingAnchor, constant: -8),
            connectButton.widthAnchor.constraint(equalToConstant: 76),
            connectButton.heightAnchor.constraint(equalToConstant: 28),
        ])
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    func configure(host: SshHost, hasPassword: Bool, onConnect: @escaping () -> Void, onDelete: @escaping () -> Void) {
        var title = host.displayTitle
        if host.autoConnect == true { title += " [AUTO]" }
        if hasPassword { title += " 🔑" }
        titleLabel.text = title
        subtitleLabel.text = "\(host.connectionString) (\(host.auth.displayName))"
        self.onConnectAction = onConnect
        self.onDeleteAction = onDelete
    }

    @objc private func handleConnect() { onConnectAction?() }
    @objc private func handleDelete() { onDeleteAction?() }
}

// MARK: - Desktop Settings Modal View (PRD §4, §12)

@MainActor
public final class DesktopSettingsModalView: UIView {
    private let backdrop = UIView()
    private let card = UIView()
    private let titleLabel = UILabel()
    private let closeButton = UIButton(type: .system)
    private let scrollView = UIScrollView()
    private let stack = UIStackView()

    private let store: WorkspaceStore
    public var onDismiss: (() -> Void)?
    public var onOpenShortcuts: (() -> Void)?

    public init(store: WorkspaceStore, onDismiss: (() -> Void)? = nil, onOpenShortcuts: (() -> Void)? = nil) {
        self.store = store
        self.onDismiss = onDismiss
        self.onOpenShortcuts = onOpenShortcuts
        super.init(frame: .zero)
        setupUI()
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    private func setupUI() {
        backdrop.backgroundColor = UIColor(white: 0, alpha: 0.65)
        backdrop.translatesAutoresizingMaskIntoConstraints = false
        let tap = UITapGestureRecognizer(target: self, action: #selector(handleBackdropTap(_:)))
        backdrop.addGestureRecognizer(tap)
        addSubview(backdrop)

        card.backgroundColor = UIColor(red: 0.08, green: 0.11, blue: 0.18, alpha: 1.0)
        card.layer.cornerRadius = 14
        card.layer.borderWidth = 1.5
        card.layer.borderColor = UIColor(red: 0.22, green: 0.74, blue: 0.97, alpha: 0.35).cgColor
        card.layer.shadowColor = UIColor.black.cgColor
        card.layer.shadowOpacity = 0.8
        card.layer.shadowOffset = CGSize(width: 0, height: 10)
        card.layer.shadowRadius = 24
        card.translatesAutoresizingMaskIntoConstraints = false
        addSubview(card)

        titleLabel.text = "Workspace Settings"
        titleLabel.font = .monospacedSystemFont(ofSize: 16, weight: .bold)
        titleLabel.textColor = UIColor(red: 0.22, green: 0.74, blue: 0.97, alpha: 1.0)
        titleLabel.translatesAutoresizingMaskIntoConstraints = false
        card.addSubview(titleLabel)

        let xConfig = UIImage.SymbolConfiguration(pointSize: 14, weight: .bold)
        closeButton.setImage(UIImage(systemName: "xmark", withConfiguration: xConfig), for: .normal)
        closeButton.tintColor = UIColor(white: 1.0, alpha: 0.6)
        closeButton.backgroundColor = UIColor(white: 1.0, alpha: 0.08)
        closeButton.layer.cornerRadius = 14
        closeButton.translatesAutoresizingMaskIntoConstraints = false
        closeButton.addTarget(self, action: #selector(dismissModal), for: .touchUpInside)
        card.addSubview(closeButton)

        scrollView.translatesAutoresizingMaskIntoConstraints = false
        scrollView.showsVerticalScrollIndicator = true
        card.addSubview(scrollView)

        stack.axis = .vertical
        stack.spacing = 16
        stack.translatesAutoresizingMaskIntoConstraints = false
        scrollView.addSubview(stack)

        NSLayoutConstraint.activate([
            backdrop.topAnchor.constraint(equalTo: topAnchor),
            backdrop.leadingAnchor.constraint(equalTo: leadingAnchor),
            backdrop.trailingAnchor.constraint(equalTo: trailingAnchor),
            backdrop.bottomAnchor.constraint(equalTo: bottomAnchor),

            card.centerXAnchor.constraint(equalTo: centerXAnchor),
            card.centerYAnchor.constraint(equalTo: centerYAnchor),
            card.widthAnchor.constraint(equalToConstant: min(640, UIScreen.main.bounds.width - 40)),
            card.heightAnchor.constraint(equalToConstant: min(520, UIScreen.main.bounds.height - 60)),

            titleLabel.topAnchor.constraint(equalTo: card.topAnchor, constant: 16),
            titleLabel.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 20),

            closeButton.topAnchor.constraint(equalTo: card.topAnchor, constant: 14),
            closeButton.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -16),
            closeButton.widthAnchor.constraint(equalToConstant: 28),
            closeButton.heightAnchor.constraint(equalToConstant: 28),

            scrollView.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 16),
            scrollView.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 20),
            scrollView.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -20),
            scrollView.bottomAnchor.constraint(equalTo: card.bottomAnchor, constant: -16),

            stack.topAnchor.constraint(equalTo: scrollView.topAnchor),
            stack.leadingAnchor.constraint(equalTo: scrollView.leadingAnchor),
            stack.trailingAnchor.constraint(equalTo: scrollView.trailingAnchor),
            stack.bottomAnchor.constraint(equalTo: scrollView.bottomAnchor),
            stack.widthAnchor.constraint(equalTo: scrollView.widthAnchor),
        ])

        buildSettingsRows()
    }

    private func buildSettingsRows() {
        // 1. Theme
        let themeLabel = makeSectionHeader("Theme")
        let themeSegment = UISegmentedControl(items: ["System", "Light", "Dark"])
        switch store.settings.theme {
        case .system: themeSegment.selectedSegmentIndex = 0
        case .light: themeSegment.selectedSegmentIndex = 1
        case .dark: themeSegment.selectedSegmentIndex = 2
        }
        themeSegment.addAction(UIAction { [weak self, weak themeSegment] _ in
            guard let self, let idx = themeSegment?.selectedSegmentIndex else { return }
            let theme: ThemeMode = idx == 1 ? .light : (idx == 2 ? .dark : .system)
            self.store.settings.theme = theme
            DisplayHost.shared.applyTheme(theme)
        }, for: .valueChanged)
        stack.addArrangedSubview(themeLabel)
        stack.addArrangedSubview(themeSegment)

        // 2. Default Split Preset
        let presetLabel = makeSectionHeader("Default Layout Preset")
        let presetSegment = UISegmentedControl(items: ["Single", "2-Col", "1 + 2", "2 × 2"])
        switch store.settings.defaultLayoutPreset {
        case .single: presetSegment.selectedSegmentIndex = 0
        case .twoColumn: presetSegment.selectedSegmentIndex = 1
        case .leftPlusTwoRight: presetSegment.selectedSegmentIndex = 2
        case .twoByTwo: presetSegment.selectedSegmentIndex = 3
        }
        presetSegment.addAction(UIAction { [weak self, weak presetSegment] _ in
            guard let self, let idx = presetSegment?.selectedSegmentIndex else { return }
            let presets: [LayoutPresetId] = [.single, .twoColumn, .leftPlusTwoRight, .twoByTwo]
            self.store.settings.defaultLayoutPreset = presets[idx]
        }, for: .valueChanged)
        stack.addArrangedSubview(presetLabel)
        stack.addArrangedSubview(presetSegment)

        // 3. Workspaces Management
        let wsLabel = makeSectionHeader("Workspaces (Spaces)")
        stack.addArrangedSubview(wsLabel)

        let wsStack = UIStackView()
        wsStack.axis = .vertical
        wsStack.spacing = 8
        for (idx, ws) in store.workspaces.enumerated() {
            let row = UIStackView()
            row.axis = .horizontal
            row.spacing = 10
            row.alignment = .center

            let nameLbl = UILabel()
            nameLbl.text = "\(ws.name)\(idx == store.activeWorkspaceIndex ? " (Active)" : "")"
            nameLbl.font = .monospacedSystemFont(ofSize: 13, weight: idx == store.activeWorkspaceIndex ? .bold : .regular)
            nameLbl.textColor = idx == store.activeWorkspaceIndex ? UIColor(red: 0.22, green: 0.74, blue: 0.97, alpha: 1.0) : .white

            let switchBtn = UIButton(type: .system)
            switchBtn.setTitle(idx == store.activeWorkspaceIndex ? "Active" : "Switch", for: .normal)
            switchBtn.titleLabel?.font = .systemFont(ofSize: 12, weight: .bold)
            switchBtn.setTitleColor(idx == store.activeWorkspaceIndex ? UIColor(white: 0.7, alpha: 1.0) : .white, for: .normal)
            switchBtn.backgroundColor = idx == store.activeWorkspaceIndex ? UIColor(white: 1.0, alpha: 0.08) : UIColor(red: 0.12, green: 0.55, blue: 0.95, alpha: 1.0)
            switchBtn.layer.cornerRadius = 6
            switchBtn.translatesAutoresizingMaskIntoConstraints = false
            switchBtn.widthAnchor.constraint(equalToConstant: 70).isActive = true
            switchBtn.heightAnchor.constraint(equalToConstant: 26).isActive = true
            switchBtn.isEnabled = (idx != store.activeWorkspaceIndex)
            switchBtn.addAction(UIAction { [weak self] _ in
                self?.store.switchToWorkspace(at: idx)
                self?.dismissModal()
            }, for: .touchUpInside)

            row.addArrangedSubview(nameLbl)
            row.addArrangedSubview(UIView()) // spacer
            row.addArrangedSubview(switchBtn)
            wsStack.addArrangedSubview(row)
        }

        let addWsBtn = UIButton(type: .system)
        addWsBtn.setTitle("+ Add New Workspace", for: .normal)
        addWsBtn.titleLabel?.font = .monospacedSystemFont(ofSize: 12, weight: .bold)
        addWsBtn.setTitleColor(UIColor(red: 0.22, green: 0.74, blue: 0.97, alpha: 1.0), for: .normal)
        addWsBtn.backgroundColor = UIColor(white: 1.0, alpha: 0.08)
        addWsBtn.layer.cornerRadius = 6
        addWsBtn.heightAnchor.constraint(equalToConstant: 32).isActive = true
        addWsBtn.addAction(UIAction { [weak self] _ in
            self?.store.addWorkspace()
            self?.dismissModal()
        }, for: .touchUpInside)

        wsStack.addArrangedSubview(addWsBtn)
        stack.addArrangedSubview(wsStack)

        // 4. Keyboard Shortcuts button
        let shortcutsHeader = makeSectionHeader("Navigation & Accessibility")
        let openShortcutsBtn = UIButton(type: .system)
        openShortcutsBtn.setTitle("⌨️ View All Keyboard Shortcuts (⌘/)", for: .normal)
        openShortcutsBtn.titleLabel?.font = .monospacedSystemFont(ofSize: 13, weight: .bold)
        openShortcutsBtn.setTitleColor(.white, for: .normal)
        openShortcutsBtn.backgroundColor = UIColor(red: 0.12, green: 0.35, blue: 0.65, alpha: 1.0)
        openShortcutsBtn.layer.cornerRadius = 8
        openShortcutsBtn.heightAnchor.constraint(equalToConstant: 36).isActive = true
        openShortcutsBtn.addAction(UIAction { [weak self] _ in
            self?.dismissModal()
            self?.onOpenShortcuts?()
        }, for: .touchUpInside)

        stack.addArrangedSubview(shortcutsHeader)
        stack.addArrangedSubview(openShortcutsBtn)
    }

    private func makeSectionHeader(_ title: String) -> UILabel {
        let l = UILabel()
        l.text = title
        l.font = .monospacedSystemFont(ofSize: 12, weight: .bold)
        l.textColor = UIColor(red: 0.22, green: 0.74, blue: 0.97, alpha: 0.9)
        return l
    }

    @objc private func handleBackdropTap(_ gesture: UITapGestureRecognizer) {
        let pt = gesture.location(in: self)
        if !card.frame.contains(pt) {
            dismissModal()
        }
    }

    @objc public func dismissModal() {
        onDismiss?()
        removeFromSuperview()
    }
}

// MARK: - Desktop Keyboard Shortcuts Cheat Sheet Modal View (PRD §4, §12)

@MainActor
public final class DesktopShortcutsModalView: UIView {
    private let backdrop = UIView()
    private let card = UIView()
    private let titleLabel = UILabel()
    private let closeButton = UIButton(type: .system)
    private let scrollView = UIScrollView()
    private let stack = UIStackView()

    public var onDismiss: (() -> Void)?

    public init(onDismiss: (() -> Void)? = nil) {
        self.onDismiss = onDismiss
        super.init(frame: .zero)
        setupUI()
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    private func setupUI() {
        backdrop.backgroundColor = UIColor(white: 0, alpha: 0.65)
        backdrop.translatesAutoresizingMaskIntoConstraints = false
        let tap = UITapGestureRecognizer(target: self, action: #selector(handleBackdropTap(_:)))
        backdrop.addGestureRecognizer(tap)
        addSubview(backdrop)

        card.backgroundColor = UIColor(red: 0.08, green: 0.11, blue: 0.18, alpha: 1.0)
        card.layer.cornerRadius = 14
        card.layer.borderWidth = 1.5
        card.layer.borderColor = UIColor(red: 0.22, green: 0.74, blue: 0.97, alpha: 0.35).cgColor
        card.layer.shadowColor = UIColor.black.cgColor
        card.layer.shadowOpacity = 0.8
        card.layer.shadowOffset = CGSize(width: 0, height: 10)
        card.layer.shadowRadius = 24
        card.translatesAutoresizingMaskIntoConstraints = false
        addSubview(card)

        titleLabel.text = "⌨️ Keyboard Shortcuts Cheat Sheet"
        titleLabel.font = .monospacedSystemFont(ofSize: 16, weight: .bold)
        titleLabel.textColor = UIColor(red: 0.22, green: 0.74, blue: 0.97, alpha: 1.0)
        titleLabel.translatesAutoresizingMaskIntoConstraints = false
        card.addSubview(titleLabel)

        let xConfig = UIImage.SymbolConfiguration(pointSize: 14, weight: .bold)
        closeButton.setImage(UIImage(systemName: "xmark", withConfiguration: xConfig), for: .normal)
        closeButton.tintColor = UIColor(white: 1.0, alpha: 0.6)
        closeButton.backgroundColor = UIColor(white: 1.0, alpha: 0.08)
        closeButton.layer.cornerRadius = 14
        closeButton.translatesAutoresizingMaskIntoConstraints = false
        closeButton.addTarget(self, action: #selector(dismissModal), for: .touchUpInside)
        card.addSubview(closeButton)

        scrollView.translatesAutoresizingMaskIntoConstraints = false
        scrollView.showsVerticalScrollIndicator = true
        card.addSubview(scrollView)

        stack.axis = .vertical
        stack.spacing = 14
        stack.translatesAutoresizingMaskIntoConstraints = false
        scrollView.addSubview(stack)

        NSLayoutConstraint.activate([
            backdrop.topAnchor.constraint(equalTo: topAnchor),
            backdrop.leadingAnchor.constraint(equalTo: leadingAnchor),
            backdrop.trailingAnchor.constraint(equalTo: trailingAnchor),
            backdrop.bottomAnchor.constraint(equalTo: bottomAnchor),

            card.centerXAnchor.constraint(equalTo: centerXAnchor),
            card.centerYAnchor.constraint(equalTo: centerYAnchor),
            card.widthAnchor.constraint(equalToConstant: min(680, UIScreen.main.bounds.width - 40)),
            card.heightAnchor.constraint(equalToConstant: min(540, UIScreen.main.bounds.height - 60)),

            titleLabel.topAnchor.constraint(equalTo: card.topAnchor, constant: 16),
            titleLabel.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 20),

            closeButton.topAnchor.constraint(equalTo: card.topAnchor, constant: 14),
            closeButton.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -16),
            closeButton.widthAnchor.constraint(equalToConstant: 28),
            closeButton.heightAnchor.constraint(equalToConstant: 28),

            scrollView.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 16),
            scrollView.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 20),
            scrollView.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -20),
            scrollView.bottomAnchor.constraint(equalTo: card.bottomAnchor, constant: -16),

            stack.topAnchor.constraint(equalTo: scrollView.topAnchor),
            stack.leadingAnchor.constraint(equalTo: scrollView.leadingAnchor),
            stack.trailingAnchor.constraint(equalTo: scrollView.trailingAnchor),
            stack.bottomAnchor.constraint(equalTo: scrollView.bottomAnchor),
            stack.widthAnchor.constraint(equalTo: scrollView.widthAnchor),
        ])

        buildShortcutsContent()
    }

    private func buildShortcutsContent() {
        addCategory("🌌 Workspaces (Spaces)", items: [
            ("Cycle to Next Workspace", "⌃→  or  ⌘⌥→  or  ⌃⌥]"),
            ("Cycle to Previous Workspace", "⌃←  or  ⌘⌥←  or  ⌃⌥["),
            ("Direct Jump to Space 1..4", "⌃1  ..  ⌃4"),
            ("New Workspace", "⌘⇧N"),
        ])

        addCategory("🪟 Panes & Focus Navigation", items: [
            ("Cycle Next Pane", "⌘⌥]  or  ⌃Tab  or  ⌃`  or  F6"),
            ("Cycle Previous Pane", "⌘⌥[  or  ⌃⇧Tab"),
            ("Move Focus Directional", "⌃⌥ + Arrow Keys"),
            ("Split Vertically (Columns)", "⌘D  or  ⌃⌥\\"),
            ("Split Horizontally (Rows)", "⌘⇧D  or  ⌃⌥-"),
            ("Close Focused Pane", "⌘⇧W  or  ⌃⌥W"),
            ("Toggle Maximise Pane", "⌘⇧M  or  ⌃⌥Enter"),
            ("Swap Focused Pane", "⌃⌥S"),
            ("Adjust Split Ratio", "⌃⌥[  /  ⌃⌥]"),
        ])

        addCategory("📑 Tabs", items: [
            ("New Tab", "⌘T  or  ⌃T"),
            ("Close Active Tab", "⌘W"),
            ("Cycle Next Tab", "⌘]  or  ⌃Tab"),
            ("Cycle Previous Tab", "⌘[  or  ⌃⇧Tab"),
        ])

        addCategory("⚡ Navigation & System", items: [
            ("Command Palette", "⌘K  or  ⌘P"),
            ("SSH Hosts & Keys", "⌘⇧H"),
            ("Workspace Settings", "⌘,"),
            ("Keyboard Shortcuts Cheat Sheet", "⌘/  or  ⌘?"),
            ("Dismiss Dialog / Modal", "Escape"),
        ])
    }

    private func addCategory(_ title: String, items: [(String, String)]) {
        let header = UILabel()
        header.text = title
        header.font = .monospacedSystemFont(ofSize: 13, weight: .bold)
        header.textColor = UIColor(red: 0.22, green: 0.74, blue: 0.97, alpha: 1.0)
        stack.addArrangedSubview(header)

        for (action, key) in items {
            let row = UIStackView()
            row.axis = .horizontal
            row.distribution = .equalSpacing
            row.alignment = .center

            let actionLbl = UILabel()
            actionLbl.text = action
            actionLbl.font = .systemFont(ofSize: 12, weight: .regular)
            actionLbl.textColor = UIColor(white: 0.9, alpha: 1.0)

            let keyBadge = UILabel()
            keyBadge.text = " \(key) "
            keyBadge.font = .monospacedSystemFont(ofSize: 11, weight: .bold)
            keyBadge.textColor = UIColor(red: 0.20, green: 0.83, blue: 0.60, alpha: 1.0)
            keyBadge.backgroundColor = UIColor(white: 1.0, alpha: 0.08)
            keyBadge.layer.cornerRadius = 4
            keyBadge.layer.masksToBounds = true

            row.addArrangedSubview(actionLbl)
            row.addArrangedSubview(keyBadge)
            stack.addArrangedSubview(row)
        }
    }

    @objc private func handleBackdropTap(_ gesture: UITapGestureRecognizer) {
        let pt = gesture.location(in: self)
        if !card.frame.contains(pt) {
            dismissModal()
        }
    }

    @objc public func dismissModal() {
        onDismiss?()
        removeFromSuperview()
    }
}

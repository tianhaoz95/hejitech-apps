import TetherKit
import UIKit
import UniformTypeIdentifiers

@MainActor
public final class FilesTabViewController: UIViewController, UITableViewDataSource, UITableViewDelegate, UIDocumentPickerDelegate {
    private let store: WorkspaceStore
    public var paneId: String
    public var tabItem: TetherKit.Tab

    private let modeControl = UISegmentedControl(items: ["Local", "SFTP"])
    private let pathButton = UIButton(type: .system)
    private let upButton = UIButton(type: .system)
    private let homeButton = UIButton(type: .system)
    private let refreshButton = UIButton(type: .system)
    private let newFolderButton = UIButton(type: .system)
    private let uploadButton = UIButton(type: .system)
    private let tableView = UITableView(frame: .zero, style: .plain)
    private let transferBanner = UIView()
    private let transferLabel = UILabel()
    private let cancelTransferButton = UIButton(type: .system)
    private var transferTask: Task<Void, Never>?

    private var allItems: [FileItem] = []
    private var visibleItems: [FileItem] = []
    private var currentPage: Int = 0
    private var hasMorePages: Bool = false

    /// Simulated SFTP virtual tree per host so SFTP mkdir/upload/rename/delete work deterministically offline too.
    private var sftpEntries: [String: [FileItem]] = [
        "/": [
            FileItem(name: "etc", path: "/etc", isDirectory: true),
            FileItem(name: "home", path: "/home", isDirectory: true),
            FileItem(name: "var", path: "/var", isDirectory: true),
            FileItem(name: "README.md", path: "/README.md", isDirectory: false, sizeBytes: 4096),
            FileItem(name: "deploy.sh", path: "/deploy.sh", isDirectory: false, sizeBytes: 1820),
            FileItem(name: "snapshot.tar.gz", path: "/snapshot.tar.gz", isDirectory: false, sizeBytes: 4_800_000),
        ],
        "/home": [
            FileItem(name: "dev", path: "/home/dev", isDirectory: true),
            FileItem(name: ".bashrc", path: "/home/.bashrc", isDirectory: false, sizeBytes: 3120),
        ],
        "/var": [
            FileItem(name: "log", path: "/var/log", isDirectory: true),
            FileItem(name: "syslog.log", path: "/var/syslog.log", isDirectory: false, sizeBytes: 2_450_000),
        ],
    ]

    public init(store: WorkspaceStore, paneId: String, tab: TetherKit.Tab) {
        self.store = store
        self.paneId = paneId
        self.tabItem = tab
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    private var currentMode: FilesMode {
        tabItem.filesMode ?? .local
    }

    private var currentPath: String {
        let p = (tabItem.path ?? "/").trimmingCharacters(in: .whitespacesAndNewlines)
        return p.isEmpty ? "/" : p
    }

    public override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 0.04, green: 0.06, blue: 0.11, alpha: 1.0)
        seedLocalSampleFilesIfNeeded()
        setupUI()
        reloadDirectory()
    }

    public func handleKeyInput(text: String) {
        if text == "\r" || text == "\n" {
            if let selected = tableView.indexPathForSelectedRow {
                tableView(tableView, didSelectRowAt: selected)
            }
        }
    }

    public func handleSpecialKey(_ key: SpecialKey) {
        switch key {
        case .up:
            let cur = tableView.indexPathForSelectedRow?.row ?? 0
            let next = max(0, cur - 1)
            if next < visibleItems.count {
                let ip = IndexPath(row: next, section: 0)
                tableView.selectRow(at: ip, animated: true, scrollPosition: .middle)
            }
        case .down:
            let cur = tableView.indexPathForSelectedRow?.row ?? -1
            let next = min(visibleItems.count - 1, cur + 1)
            if next >= 0 && next < visibleItems.count {
                let ip = IndexPath(row: next, section: 0)
                tableView.selectRow(at: ip, animated: true, scrollPosition: .middle)
            }
        case .enter:
            handleKeyInput(text: "\n")
        default:
            break
        }
    }

    private func localRootDirectory() -> URL {
        let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
        try? FileManager.default.createDirectory(at: docs, withIntermediateDirectories: true)
        return docs
    }

    private func seedLocalSampleFilesIfNeeded() {
        let docs = localRootDirectory()
        let welcomeURL = docs.appendingPathComponent("welcome.md")
        if !FileManager.default.fileExists(atPath: welcomeURL.path) {
            let content = """
            # Tether Local Workspace Files

            This directory lives in your device's `Documents` container and is accessible from the iOS Files app.
            - Tap any `.md`, `.txt`, `.json`, or `.html` file to preview it in a Web tab.
            - Use **Insert path into focused terminal** to paste its shell-escaped path into your active SSH tab without executing.
            """
            try? Data(content.utf8).write(to: welcomeURL, options: .atomic)
        }
        let projectsDir = docs.appendingPathComponent("projects", isDirectory: true)
        try? FileManager.default.createDirectory(at: projectsDir, withIntermediateDirectories: true)
        let notesURL = projectsDir.appendingPathComponent("notes.txt")
        if !FileManager.default.fileExists(atPath: notesURL.path) {
            try? Data("Tether desktop workspace notes\n".utf8).write(to: notesURL, options: .atomic)
        }
    }

    private func setupUI() {
        let toolbar = UIView()
        toolbar.translatesAutoresizingMaskIntoConstraints = false
        toolbar.backgroundColor = UIColor(red: 0.06, green: 0.09, blue: 0.16, alpha: 1.0)

        modeControl.selectedSegmentIndex = (currentMode == .sftp) ? 1 : 0
        modeControl.selectedSegmentTintColor = UIColor(red: 0.22, green: 0.74, blue: 0.97, alpha: 0.35)
        modeControl.setTitleTextAttributes([.foregroundColor: UIColor.white, .font: UIFont.systemFont(ofSize: 11, weight: .semibold)], for: .normal)
        modeControl.addTarget(self, action: #selector(modeChanged), for: .valueChanged)

        pathButton.contentHorizontalAlignment = .left
        pathButton.titleLabel?.font = UIFont.monospacedSystemFont(ofSize: 11, weight: .regular)
        pathButton.titleLabel?.lineBreakMode = .byTruncatingMiddle
        pathButton.setTitleColor(UIColor(red: 0.58, green: 0.64, blue: 0.72, alpha: 1.0), for: .normal)
        pathButton.addTarget(self, action: #selector(showFullPathTapped), for: .touchUpInside)

        upButton.setImage(UIImage(systemName: "arrow.up"), for: .normal)
        upButton.tintColor = .white
        upButton.addTarget(self, action: #selector(upTapped), for: .touchUpInside)

        homeButton.setImage(UIImage(systemName: "house"), for: .normal)
        homeButton.tintColor = .white
        homeButton.addTarget(self, action: #selector(homeTapped), for: .touchUpInside)

        refreshButton.setImage(UIImage(systemName: "arrow.clockwise"), for: .normal)
        refreshButton.tintColor = .white
        refreshButton.addTarget(self, action: #selector(refreshTapped), for: .touchUpInside)

        newFolderButton.setImage(UIImage(systemName: "folder.badge.plus"), for: .normal)
        newFolderButton.tintColor = .white
        newFolderButton.addTarget(self, action: #selector(newFolderTapped), for: .touchUpInside)

        uploadButton.setImage(UIImage(systemName: "square.and.arrow.up"), for: .normal)
        uploadButton.tintColor = UIColor(red: 0.22, green: 0.74, blue: 0.97, alpha: 1.0)
        uploadButton.addTarget(self, action: #selector(uploadOrPickDocumentTapped), for: .touchUpInside)

        let stack = UIStackView(arrangedSubviews: [
            modeControl, pathButton, upButton, homeButton, refreshButton, newFolderButton, uploadButton
        ])
        stack.translatesAutoresizingMaskIntoConstraints = false
        stack.axis = .horizontal
        stack.spacing = 6
        stack.alignment = .center
        toolbar.addSubview(stack)

        tableView.translatesAutoresizingMaskIntoConstraints = false
        tableView.backgroundColor = UIColor(red: 0.04, green: 0.06, blue: 0.11, alpha: 1.0)
        tableView.separatorColor = UIColor(white: 1.0, alpha: 0.08)
        tableView.dataSource = self
        tableView.delegate = self
        tableView.rowHeight = 38

        transferBanner.translatesAutoresizingMaskIntoConstraints = false
        transferBanner.backgroundColor = UIColor(red: 0.08, green: 0.22, blue: 0.38, alpha: 0.96)
        transferBanner.isHidden = true

        transferLabel.translatesAutoresizingMaskIntoConstraints = false
        transferLabel.font = .monospacedSystemFont(ofSize: 11, weight: .medium)
        transferLabel.textColor = .white

        cancelTransferButton.translatesAutoresizingMaskIntoConstraints = false
        cancelTransferButton.setTitle("Cancel", for: .normal)
        cancelTransferButton.setTitleColor(.systemRed, for: .normal)
        cancelTransferButton.titleLabel?.font = .systemFont(ofSize: 11, weight: .bold)
        cancelTransferButton.addTarget(self, action: #selector(cancelTransferTapped), for: .touchUpInside)

        transferBanner.addSubview(transferLabel)
        transferBanner.addSubview(cancelTransferButton)

        view.addSubview(toolbar)
        view.addSubview(tableView)
        view.addSubview(transferBanner)

        NSLayoutConstraint.activate([
            toolbar.topAnchor.constraint(equalTo: view.topAnchor),
            toolbar.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            toolbar.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            toolbar.heightAnchor.constraint(equalToConstant: 36),

            stack.leadingAnchor.constraint(equalTo: toolbar.leadingAnchor, constant: 8),
            stack.trailingAnchor.constraint(equalTo: toolbar.trailingAnchor, constant: -8),
            stack.centerYAnchor.constraint(equalTo: toolbar.centerYAnchor),
            modeControl.widthAnchor.constraint(equalToConstant: 108),

            tableView.topAnchor.constraint(equalTo: toolbar.bottomAnchor),
            tableView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            tableView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            tableView.bottomAnchor.constraint(equalTo: view.bottomAnchor),

            transferBanner.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            transferBanner.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            transferBanner.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            transferBanner.heightAnchor.constraint(equalToConstant: 32),

            transferLabel.leadingAnchor.constraint(equalTo: transferBanner.leadingAnchor, constant: 10),
            transferLabel.centerYAnchor.constraint(equalTo: transferBanner.centerYAnchor),
            cancelTransferButton.trailingAnchor.constraint(equalTo: transferBanner.trailingAnchor, constant: -10),
            cancelTransferButton.centerYAnchor.constraint(equalTo: transferBanner.centerYAnchor),
        ])
    }

    public func reloadDirectory() {
        pathButton.setTitle(currentPath, for: .normal)
        currentPage = 0
        if currentMode == .local {
            allItems = loadLocalDirectory(relativePath: currentPath)
        } else {
            allItems = sftpEntries[currentPath] ?? []
        }
        applyPagination()
    }

    private func applyPagination() {
        let paged = FileBrowserSort.chunk(allItems, page: currentPage, pageSize: 500)
        visibleItems = paged.slice
        hasMorePages = paged.hasMore
        tableView.reloadData()
    }

    private func loadLocalDirectory(relativePath: String) -> [FileItem] {
        let root = localRootDirectory()
        let cleaned = relativePath.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        let targetURL = cleaned.isEmpty ? root : root.appendingPathComponent(cleaned, isDirectory: true)
        guard let urls = try? FileManager.default.contentsOfDirectory(
            at: targetURL,
            includingPropertiesForKeys: [.isDirectoryKey, .fileSizeKey, .contentModificationDateKey],
            options: [.skipsHiddenFiles]
        ) else {
            return []
        }
        return urls.map { u in
            let vals = try? u.resourceValues(forKeys: [.isDirectoryKey, .fileSizeKey, .contentModificationDateKey])
            let isDir = vals?.isDirectory ?? false
            let size = Int64(vals?.fileSize ?? 0)
            let mod = vals?.contentModificationDate ?? Date()
            let relPath = currentPath == "/" ? "/\(u.lastPathComponent)" : "\(currentPath)/\(u.lastPathComponent)"
            return FileItem(name: u.lastPathComponent, path: relPath, isDirectory: isDir, sizeBytes: size, modifiedAt: mod)
        }
    }

    private func navigate(to newPath: String, mode: FilesMode? = nil) {
        let resolvedMode = mode ?? currentMode
        store.tree = PaneTreeOps.updateTab(store.tree, paneId: paneId, tabId: tabItem.id) { t in
            t.filesMode = resolvedMode
            t.path = newPath
            t.title = PaneTreeOps.computeTabTitle(tab: t, hosts: store.hosts)
            self.tabItem = t
        }
        reloadDirectory()
    }

    @objc private func modeChanged() {
        let nextMode: FilesMode = modeControl.selectedSegmentIndex == 1 ? .sftp : .local
        navigate(to: "/", mode: nextMode)
    }

    @objc private func showFullPathTapped() {
        let full = currentMode == .local
            ? localRootDirectory().appendingPathComponent(currentPath.trimmingCharacters(in: CharacterSet(charactersIn: "/"))).path
            : "sftp://\(store.hosts.first?.connectionString ?? "example.invalid:22")\(currentPath)"
        let copyAction = DesktopAlertAction(title: "Copy Path", style: .default) { _ in
            UIPasteboard.general.string = full
        }
        let okAction = DesktopAlertAction(title: "Close", style: .cancel)
        showDesktopAlert(
            title: "Full Directory Path",
            message: full,
            actions: [copyAction, okAction]
        )
    }

    @objc private func upTapped() {
        guard currentPath != "/" else { return }
        let parent = (currentPath as NSString).deletingLastPathComponent
        navigate(to: parent.isEmpty ? "/" : parent)
    }

    @objc private func homeTapped() {
        navigate(to: "/")
    }

    @objc private func refreshTapped() {
        reloadDirectory()
    }

    @objc private func newFolderTapped() {
        let createAction = DesktopAlertAction(title: "Create Folder", style: .default) { [weak self] name in
            guard let self,
                  let name = name?.trimmingCharacters(in: .whitespacesAndNewlines),
                  !name.isEmpty else { return }
            let newPath = self.currentPath == "/" ? "/\(name)" : "\(self.currentPath)/\(name)"
            if self.currentMode == .local {
                let cleaned = newPath.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
                let dirURL = self.localRootDirectory().appendingPathComponent(cleaned, isDirectory: true)
                try? FileManager.default.createDirectory(at: dirURL, withIntermediateDirectories: true)
            } else {
                var list = self.sftpEntries[self.currentPath] ?? []
                list.append(FileItem(name: name, path: newPath, isDirectory: true))
                self.sftpEntries[self.currentPath] = list
                self.sftpEntries[newPath] = []
            }
            self.reloadDirectory()
        }
        let cancelAction = DesktopAlertAction(title: "Cancel", style: .cancel)
        showDesktopAlert(
            title: "New Folder",
            message: "Create folder in \(currentPath)",
            actions: [createAction, cancelAction],
            textFieldPlaceholder: "folder-name"
        )
    }

    @objc private func uploadOrPickDocumentTapped() {
        let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.item], asCopy: true)
        picker.delegate = self
        present(picker, animated: true)
    }

    public func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        guard let url = urls.first else { return }
        let name = url.lastPathComponent
        if currentMode == .local {
            let cleaned = currentPath.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
            let dir = cleaned.isEmpty ? localRootDirectory() : localRootDirectory().appendingPathComponent(cleaned, isDirectory: true)
            let dest = dir.appendingPathComponent(name)
            try? FileManager.default.removeItem(at: dest)
            try? FileManager.default.copyItem(at: url, to: dest)
            reloadDirectory()
        } else {
            let size = (try? url.resourceValues(forKeys: [.fileSizeKey]).fileSize).map(Int64.init) ?? 2_000_000
            startSimulatedTransfer(fileName: name, totalBytes: max(1_500_000, size), isUpload: true) { [weak self] in
                guard let self else { return }
                let newPath = self.currentPath == "/" ? "/\(name)" : "\(self.currentPath)/\(name)"
                var list = self.sftpEntries[self.currentPath] ?? []
                list.append(FileItem(name: name, path: newPath, isDirectory: false, sizeBytes: size))
                self.sftpEntries[self.currentPath] = list
                self.reloadDirectory()
            }
        }
    }

    /// Progress indicator & cancellation for transfers >1MB (PRD §11.3).
    private func startSimulatedTransfer(fileName: String, totalBytes: Int64, isUpload: Bool, onComplete: @escaping () -> Void) {
        transferTask?.cancel()
        transferBanner.isHidden = false
        let verb = isUpload ? "Uploading" : "Downloading"
        transferTask = Task { @MainActor [weak self] in
            let steps = 5
            for step in 1...steps {
                guard !Task.isCancelled else { return }
                let pct = Int((Double(step) / Double(steps)) * 100)
                self?.transferLabel.text = "\(verb) \(fileName)… \(pct)% (\(ByteCountFormatter.string(fromByteCount: totalBytes, countStyle: .file)))"
                try? await Task.sleep(nanoseconds: 180_000_000)
            }
            guard !Task.isCancelled else { return }
            self?.transferBanner.isHidden = true
            onComplete()
        }
    }

    @objc private func cancelTransferTapped() {
        transferTask?.cancel()
        transferBanner.isHidden = true
    }

    // MARK: - UITableViewDataSource & UITableViewDelegate

    public func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        visibleItems.count + (hasMorePages ? 1 : 0)
    }

    public func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        let cell = tableView.dequeueReusableCell(withIdentifier: "FileCell")
            ?? UITableViewCell(style: .value1, reuseIdentifier: "FileCell")
        cell.backgroundColor = .clear
        cell.textLabel?.font = UIFont.monospacedSystemFont(ofSize: 12, weight: .regular)
        cell.detailTextLabel?.font = UIFont.monospacedSystemFont(ofSize: 11, weight: .regular)

        if indexPath.row == visibleItems.count {
            cell.imageView?.image = UIImage(systemName: "ellipsis.circle")
            cell.imageView?.tintColor = UIColor(red: 0.22, green: 0.74, blue: 0.97, alpha: 1.0)
            cell.textLabel?.text = "Load More (\(allItems.count - visibleItems.count) remaining)…"
            cell.textLabel?.textColor = UIColor(red: 0.22, green: 0.74, blue: 0.97, alpha: 1.0)
            cell.detailTextLabel?.text = nil
            return cell
        }

        let item = visibleItems[indexPath.row]
        cell.imageView?.image = UIImage(systemName: item.isDirectory ? "folder.fill" : "doc.text")
        cell.imageView?.tintColor = item.isDirectory
            ? UIColor(red: 0.22, green: 0.74, blue: 0.97, alpha: 1.0)
            : UIColor(white: 0.75, alpha: 1.0)
        cell.textLabel?.text = item.name
        cell.textLabel?.textColor = .white

        let dateStr = DateFormatter.localizedString(from: item.modifiedAt, dateStyle: .short, timeStyle: .none)
        if item.isDirectory {
            cell.detailTextLabel?.text = "DIR · \(dateStr)"
        } else {
            let sizeStr = ByteCountFormatter.string(fromByteCount: item.sizeBytes, countStyle: .file)
            cell.detailTextLabel?.text = "\(sizeStr) · \(dateStr)"
        }
        cell.detailTextLabel?.textColor = UIColor(white: 0.58, alpha: 1.0)
        return cell
    }

    public func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
        tableView.deselectRow(at: indexPath, animated: true)
        if indexPath.row == visibleItems.count {
            currentPage += 1
            applyPagination()
            return
        }
        let item = visibleItems[indexPath.row]
        if item.isDirectory {
            navigate(to: item.path)
        } else {
            presentFileActions(for: item, sourceRow: indexPath)
        }
    }

    private func presentFileActions(for item: FileItem, sourceRow: IndexPath) {
        var actions: [DesktopAlertAction] = []

        if item.isTextOrHtmlPreviewable {
            actions.append(DesktopAlertAction(title: "Open in Web Tab", style: .default) { [weak self] _ in
                self?.openItemInWebTab(item)
            })
        }

        actions.append(DesktopAlertAction(title: "Insert Path into Terminal", style: .default) { [weak self] _ in
            guard let self else { return }
            _ = self.store.insertPathIntoTerminal(item.path)
        })

        actions.append(DesktopAlertAction(title: "Copy Path", style: .default) { _ in
            UIPasteboard.general.string = item.path
        })

        if currentMode == .sftp && !item.isDirectory {
            actions.append(DesktopAlertAction(title: "Download to Local Files", style: .default) { [weak self] _ in
                guard let self else { return }
                self.startSimulatedTransfer(fileName: item.name, totalBytes: max(1_500_000, item.sizeBytes), isUpload: false) {
                    let dest = self.localRootDirectory().appendingPathComponent(item.name)
                    try? Data("Downloaded via SFTP from \(item.path)\n".utf8).write(to: dest, options: .atomic)
                }
            })
        }

        actions.append(DesktopAlertAction(title: "Rename…", style: .default) { [weak self] _ in
            self?.promptRename(item)
        })

        actions.append(DesktopAlertAction(title: "Delete", style: .destructive) { [weak self] _ in
            self?.confirmDelete(item)
        })

        actions.append(DesktopAlertAction(title: "Cancel", style: .cancel))

        showDesktopAlert(title: item.name, message: item.path, actions: actions)
    }

    private func openItemInWebTab(_ item: FileItem) {
        if currentMode == .local {
            let cleaned = item.path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
            let fileURL = localRootDirectory().appendingPathComponent(cleaned)
            store.openTab(type: .web, inPaneId: paneId, url: fileURL.absoluteString)
        } else {
            let text = "# \(item.name)\nPath: \(item.path)\nSize: \(item.sizeBytes) bytes"
            let encoded = text.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? item.name
            store.openTab(type: .web, inPaneId: paneId, url: "data:text/plain;charset=utf-8,\(encoded)")
        }
    }

    private func promptRename(_ item: FileItem) {
        let renameAction = DesktopAlertAction(title: "Rename", style: .default) { [weak self] newName in
            guard let self,
                  let newName = newName?.trimmingCharacters(in: .whitespacesAndNewlines),
                  !newName.isEmpty else { return }
            let newPath = self.currentPath == "/" ? "/\(newName)" : "\(self.currentPath)/\(newName)"
            if self.currentMode == .local {
                let oldClean = item.path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
                let newClean = newPath.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
                let src = self.localRootDirectory().appendingPathComponent(oldClean)
                let dst = self.localRootDirectory().appendingPathComponent(newClean)
                try? FileManager.default.moveItem(at: src, to: dst)
            } else {
                var list = self.sftpEntries[self.currentPath] ?? []
                if let idx = list.firstIndex(where: { $0.path == item.path }) {
                    list[idx].name = newName
                    list[idx].path = newPath
                    self.sftpEntries[self.currentPath] = list
                }
            }
            self.reloadDirectory()
        }
        let cancelAction = DesktopAlertAction(title: "Cancel", style: .cancel)
        showDesktopAlert(
            title: "Rename",
            message: item.name,
            actions: [renameAction, cancelAction],
            textFieldPlaceholder: "New name",
            textFieldDefaultText: item.name
        )
    }

    private func confirmDelete(_ item: FileItem) {
        let deleteAction = DesktopAlertAction(title: "Delete", style: .destructive) { [weak self] _ in
            guard let self else { return }
            if self.currentMode == .local {
                let cleaned = item.path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
                let target = self.localRootDirectory().appendingPathComponent(cleaned)
                try? FileManager.default.removeItem(at: target)
            } else {
                self.sftpEntries[self.currentPath]?.removeAll { $0.path == item.path }
            }
            self.reloadDirectory()
        }
        let cancelAction = DesktopAlertAction(title: "Cancel", style: .cancel)
        showDesktopAlert(
            title: "Delete \(item.name)?",
            message: "This will permanently delete \(item.path).",
            actions: [deleteAction, cancelAction]
        )
    }
}

import Foundation

/// Automatically writes and updates Markdown files (with YAML frontmatter from `NoteExportService`)
/// into a user-selected folder — e.g. an Obsidian vault on Mac or an iCloud Drive folder on iOS —
/// whenever a note finishes processing or is edited.
///
/// Locked notes are never written (matching `NoteExportService.exportNotesAsZip`); if a previously
/// exported note is locked or deleted, its exported file is removed.
@MainActor
public final class AutoExportService: ObservableObject {
    public static let shared = AutoExportService()

    public static let enabledKey = "voxbrief_auto_export_enabled"
    public static let bookmarkKey = "voxbrief_auto_export_bookmark"
    public static let folderNameKey = "voxbrief_auto_export_folder_name"
    public static let exportedFilesKey = "voxbrief_auto_export_file_map"

    @Published public var isEnabled: Bool {
        didSet {
            defaults.set(isEnabled, forKey: Self.enabledKey)
        }
    }

    @Published public private(set) var folderDisplayName: String?
    @Published public private(set) var lastExportedAt: Date?
    @Published public private(set) var lastError: String?

    private let defaults: UserDefaults
    private let exportService: NoteExportService
    private let fileManager: FileManager
    /// Direct folder override for unit tests (bypasses security-scoped bookmark resolution).
    private let customDirectoryURL: URL?

    /// Maps `note.id.uuidString` -> exported filename (e.g. `2026-11-23-design-review.md`) so
    /// renames replace the old file instead of leaving duplicates, and deletes/locks clean up.
    private var exportedFiles: [String: String]

    public init(
        defaults: UserDefaults = .standard,
        exportService: NoteExportService = .shared,
        fileManager: FileManager = .default,
        customDirectoryURL: URL? = nil
    ) {
        self.defaults = defaults
        self.exportService = exportService
        self.fileManager = fileManager
        self.customDirectoryURL = customDirectoryURL
        self.isEnabled = defaults.bool(forKey: Self.enabledKey)
        self.folderDisplayName = customDirectoryURL?.lastPathComponent ?? defaults.string(forKey: Self.folderNameKey)
        self.exportedFiles = (defaults.dictionary(forKey: Self.exportedFilesKey) as? [String: String]) ?? [:]
    }

    public var hasFolder: Bool {
        customDirectoryURL != nil || defaults.data(forKey: Self.bookmarkKey) != nil
    }

    /// Saves a security-scoped bookmark for `url` and enables auto-export.
    public func setFolder(_ url: URL) throws {
        let accessed = url.startAccessingSecurityScopedResource()
        defer {
            if accessed { url.stopAccessingSecurityScopedResource() }
        }
        #if os(macOS)
        let options: URL.BookmarkCreationOptions = [.withSecurityScope]
        #else
        let options: URL.BookmarkCreationOptions = []
        #endif
        let bookmark = try url.bookmarkData(options: options, includingResourceValuesForKeys: nil, relativeTo: nil)
        defaults.set(bookmark, forKey: Self.bookmarkKey)
        defaults.set(url.lastPathComponent, forKey: Self.folderNameKey)
        folderDisplayName = url.lastPathComponent
        lastError = nil
        isEnabled = true
    }

    public func clearFolder() {
        defaults.removeObject(forKey: Self.bookmarkKey)
        defaults.removeObject(forKey: Self.folderNameKey)
        folderDisplayName = nil
        isEnabled = false
        lastError = nil
    }

    /// Exports or removes a single note if auto-export is enabled and a folder is configured.
    @discardableResult
    public func syncNote(_ note: VoiceNote) -> Bool {
        guard isEnabled, hasFolder else { return false }
        return withDestinationFolder { folderURL in
            writeOrRemove(note: note, in: folderURL)
        } ?? false
    }

    /// Removes the exported file for a deleted note, if one was previously written.
    public func removeExportedFile(forNoteId id: UUID) {
        guard isEnabled, hasFolder else { return }
        let key = id.uuidString
        guard let previousName = exportedFiles[key] else { return }
        _ = withDestinationFolder { folderURL in
            let fileURL = folderURL.appendingPathComponent(previousName)
            try? fileManager.removeItem(at: fileURL)
            exportedFiles.removeValue(forKey: key)
            persistExportedFiles()
            return true
        }
    }

    /// Backfills all eligible ready, unlocked notes into the configured folder. Returns the count written.
    @discardableResult
    public func exportAll(_ notes: [VoiceNote]) -> Int {
        guard hasFolder else { return 0 }
        return withDestinationFolder { folderURL in
            var count = 0
            for note in notes {
                if writeOrRemove(note: note, in: folderURL) {
                    count += 1
                }
            }
            if count > 0 {
                lastExportedAt = Date()
            }
            return count
        } ?? 0
    }

    // MARK: - Filename & Write Helpers

    /// Deterministic, Obsidian-friendly filename: `YYYY-MM-DD-sanitized-title.md`, disambiguated
    /// with a short UUID suffix if another note already claims that name.
    public func fileName(for note: VoiceNote) -> String {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        let datePrefix = formatter.string(from: note.createdAt)

        let rawTitle = note.title.trimmingCharacters(in: .whitespacesAndNewlines)
        let allowed = CharacterSet.alphanumerics.union(CharacterSet(charactersIn: " -_"))
        let cleaned = rawTitle
            .components(separatedBy: allowed.inverted)
            .joined()
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: #"\s+"#, with: "-", options: .regularExpression)
            .lowercased()
        let slug = cleaned.isEmpty ? "untitled-note" : String(cleaned.prefix(64))
        let candidate = "\(datePrefix)-\(slug).md"

        let noteKey = note.id.uuidString
        let collides = exportedFiles.contains { otherKey, otherName in
            otherKey != noteKey && otherName.caseInsensitiveCompare(candidate) == .orderedSame
        }
        if collides {
            let shortId = String(noteKey.prefix(8)).lowercased()
            return "\(datePrefix)-\(slug)-\(shortId).md"
        }
        return candidate
    }

    private func writeOrRemove(note: VoiceNote, in folderURL: URL) -> Bool {
        let key = note.id.uuidString
        // Locked notes stay out; remove any previously exported file if the note was just locked.
        if note.isLocked {
            if let existing = exportedFiles.removeValue(forKey: key) {
                try? fileManager.removeItem(at: folderURL.appendingPathComponent(existing))
                persistExportedFiles()
            }
            return false
        }
        // Only write once Stage 2 (or a saved edit) has produced ready content.
        guard note.status == .ready, !note.cleanedNote.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            return false
        }

        let targetName = fileName(for: note)
        if let previousName = exportedFiles[key], previousName != targetName {
            try? fileManager.removeItem(at: folderURL.appendingPathComponent(previousName))
        }

        let markdown = exportService.formattedMarkdownDocument(for: note)
        let destination = folderURL.appendingPathComponent(targetName)
        do {
            try markdown.write(to: destination, atomically: true, encoding: .utf8)
            exportedFiles[key] = targetName
            persistExportedFiles()
            lastExportedAt = Date()
            lastError = nil
            return true
        } catch {
            lastError = error.localizedDescription
            return false
        }
    }

    private func withDestinationFolder<T>(_ work: (URL) -> T) -> T? {
        if let customDirectoryURL {
            if !fileManager.fileExists(atPath: customDirectoryURL.path) {
                try? fileManager.createDirectory(at: customDirectoryURL, withIntermediateDirectories: true)
            }
            return work(customDirectoryURL)
        }
        guard let bookmark = defaults.data(forKey: Self.bookmarkKey) else { return nil }
        do {
            var isStale = false
            #if os(macOS)
            let options: URL.BookmarkResolutionOptions = [.withSecurityScope]
            #else
            let options: URL.BookmarkResolutionOptions = []
            #endif
            let resolvedURL = try URL(resolvingBookmarkData: bookmark, options: options, relativeTo: nil, bookmarkDataIsStale: &isStale)
            let accessed = resolvedURL.startAccessingSecurityScopedResource()
            defer {
                if accessed { resolvedURL.stopAccessingSecurityScopedResource() }
            }
            if isStale {
                #if os(macOS)
                let creationOptions: URL.BookmarkCreationOptions = [.withSecurityScope]
                #else
                let creationOptions: URL.BookmarkCreationOptions = []
                #endif
                if let refreshed = try? resolvedURL.bookmarkData(options: creationOptions, includingResourceValuesForKeys: nil, relativeTo: nil) {
                    defaults.set(refreshed, forKey: Self.bookmarkKey)
                }
            }
            return work(resolvedURL)
        } catch {
            lastError = "Couldn't access the export folder: \(error.localizedDescription)"
            return nil
        }
    }

    private func persistExportedFiles() {
        defaults.set(exportedFiles, forKey: Self.exportedFilesKey)
    }
}

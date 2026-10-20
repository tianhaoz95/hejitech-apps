import Foundation

/// Audio and video handed to Voxbrief from the share sheet. `VoxbriefShare` can't run the
/// pipeline itself (WhisperKit and the language models live in the app, and an extension gets a
/// fraction of the memory), so it copies each file into the App Group here and the app imports
/// whatever is waiting the next time it becomes active (`AudioImportService.importSharedInbox`).
///
/// Each file sits in its own folder, `ShareInbox/<UUID>/<original name>`, so the note can be
/// titled after the original name and a half-written copy is never mistaken for a finished one
/// (the folder is created under a temporary name and renamed once the copy is complete).
public enum SharedImportInbox {
    private static let folderName = "ShareInbox"
    private static let partialSuffix = ".partial"

    public static var directory: URL? {
        FileManager.default
            .containerURL(forSecurityApplicationGroupIdentifier: KeyboardHandoff.appGroupID)?
            .appendingPathComponent(folderName, isDirectory: true)
    }

    /// Copies `source` into the inbox. Called by the share extension.
    public static func add(_ source: URL, originalName: String) throws {
        guard let directory else { throw CocoaError(.fileNoSuchFile) }
        let id = UUID().uuidString
        let partial = directory.appendingPathComponent(id + partialSuffix, isDirectory: true)
        try FileManager.default.createDirectory(at: partial, withIntermediateDirectories: true)
        try FileManager.default.copyItem(at: source, to: partial.appendingPathComponent(originalName))
        try FileManager.default.moveItem(at: partial, to: directory.appendingPathComponent(id, isDirectory: true))
    }

    /// Finished entries, oldest first: each entry's folder and the file inside it.
    public static func pending() -> [(folder: URL, file: URL)] {
        guard let directory,
              let folders = try? FileManager.default.contentsOfDirectory(
                at: directory, includingPropertiesForKeys: [.creationDateKey], options: .skipsHiddenFiles
              ) else { return [] }
        return folders
            .filter { !$0.lastPathComponent.hasSuffix(partialSuffix) }
            .compactMap { folder -> (Date, URL, URL)? in
                guard let file = (try? FileManager.default.contentsOfDirectory(at: folder, includingPropertiesForKeys: nil, options: .skipsHiddenFiles))?.first else { return nil }
                let created = (try? folder.resourceValues(forKeys: [.creationDateKey]).creationDate) ?? .distantPast
                return (created, folder, file)
            }
            .sorted { $0.0 < $1.0 }
            .map { ($0.1, $0.2) }
    }

    public static func remove(_ folder: URL) {
        try? FileManager.default.removeItem(at: folder)
    }
}

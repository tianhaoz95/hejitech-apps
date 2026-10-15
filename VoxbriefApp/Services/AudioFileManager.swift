import Foundation

public final class AudioFileManager: Sendable {
    public static let shared = AudioFileManager()

    /// Overrides where audio files are stored. Only needed on platforms where
    /// `.documentDirectory` resolves to a real, user-visible folder (e.g. non-sandboxed macOS,
    /// where it's the user's actual `~/Documents`) and writing app-private audio there would be
    /// clutter -- iOS leaves this `nil` and keeps its existing sandboxed-Documents behavior.
    private let baseDirectoryOverride: URL?

    private var notesDirectoryURL: URL {
        let base = baseDirectoryOverride ?? FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        let audioDir = base.appendingPathComponent(AudioConstants.audioDirectoryName, isDirectory: true)
        if !FileManager.default.fileExists(atPath: audioDir.path) {
            try? FileManager.default.createDirectory(at: audioDir, withIntermediateDirectories: true)
        }
        return audioDir
    }

    public init(baseDirectoryOverride: URL? = nil) {
        self.baseDirectoryOverride = baseDirectoryOverride
    }
    
    /// Returns the absolute file URL for a given audio file name
    public func url(for fileName: String) -> URL {
        return notesDirectoryURL.appendingPathComponent(fileName)
    }
    
    /// Generates a unique file URL for a new recording
    public func newAudioFileURL(for noteId: UUID = UUID()) -> URL {
        let fileName = "\(noteId.uuidString).\(AudioConstants.fileExtension)"
        return notesDirectoryURL.appendingPathComponent(fileName)
    }
    
    /// Copies an incoming file (e.g. from WatchConnectivity temporary directory) to persistent storage
    public func copyIncomingAudioFile(from sourceURL: URL, noteId: UUID) throws -> String {
        let targetFileName = "\(noteId.uuidString).\(AudioConstants.fileExtension)"
        let targetURL = notesDirectoryURL.appendingPathComponent(targetFileName)
        
        if FileManager.default.fileExists(atPath: targetURL.path) {
            try? FileManager.default.removeItem(at: targetURL)
        }
        
        try FileManager.default.copyItem(at: sourceURL, to: targetURL)
        return targetFileName
    }
    
    /// Deletes an audio file if it exists
    public func deleteAudioFile(fileName: String) {
        let fileURL = notesDirectoryURL.appendingPathComponent(fileName)
        if FileManager.default.fileExists(atPath: fileURL.path) {
            try? FileManager.default.removeItem(at: fileURL)
        }
    }
    
    /// Checks if the audio file exists
    public func fileExists(fileName: String) -> Bool {
        let fileURL = notesDirectoryURL.appendingPathComponent(fileName)
        return FileManager.default.fileExists(atPath: fileURL.path)
    }

    public struct StorageUsage: Sendable, Equatable {
        public let fileCount: Int
        public let totalBytes: Int64

        public init(fileCount: Int, totalBytes: Int64) {
            self.fileCount = fileCount
            self.totalBytes = totalBytes
        }

        public var formattedBytes: String {
            ByteCountFormatter.string(fromByteCount: totalBytes, countStyle: .file)
        }
    }

    /// Computes total storage consumed by recordings in the audio directory
    public func calculateStorageUsage() -> StorageUsage {
        let fileManager = FileManager.default
        guard let files = try? fileManager.contentsOfDirectory(at: notesDirectoryURL, includingPropertiesForKeys: [.fileSizeKey], options: .skipsHiddenFiles) else {
            return StorageUsage(fileCount: 0, totalBytes: 0)
        }

        var total: Int64 = 0
        var count = 0
        for file in files where file.pathExtension.lowercased() == AudioConstants.fileExtension.lowercased() {
            count += 1
            if let resources = try? file.resourceValues(forKeys: [.fileSizeKey]), let size = resources.fileSize {
                total += Int64(size)
            }
        }
        return StorageUsage(fileCount: count, totalBytes: total)
    }

    /// Purges audio files older than a given number of days, optionally preserving active note audio
    @discardableResult
    public func purgeAudioFiles(olderThanDays days: Int, preservingFileNames: Set<String> = []) -> Int {
        let fileManager = FileManager.default
        let cutoffDate = Date().addingTimeInterval(-Double(days * 24 * 3600))
        guard let files = try? fileManager.contentsOfDirectory(at: notesDirectoryURL, includingPropertiesForKeys: [.contentModificationDateKey], options: .skipsHiddenFiles) else {
            return 0
        }

        var purgedCount = 0
        for file in files where file.pathExtension.lowercased() == AudioConstants.fileExtension.lowercased() {
            let filename = file.lastPathComponent
            if preservingFileNames.contains(filename) {
                continue
            }
            if let resources = try? file.resourceValues(forKeys: [.contentModificationDateKey]),
               let modDate = resources.contentModificationDate,
               modDate < cutoffDate {
                if (try? fileManager.removeItem(at: file)) != nil {
                    purgedCount += 1
                }
            }
        }
        return purgedCount
    }

    /// Removes any audio files from the audio directory that are no longer referenced by any note.
    @discardableResult
    public func cleanupOrphanedFiles(referencedFileNames: Set<String>) -> Int {
        let fileManager = FileManager.default
        guard let files = try? fileManager.contentsOfDirectory(at: notesDirectoryURL, includingPropertiesForKeys: nil, options: .skipsHiddenFiles) else {
            return 0
        }

        var removed = 0
        for file in files where file.pathExtension.lowercased() == AudioConstants.fileExtension.lowercased() {
            let filename = file.lastPathComponent
            if !referencedFileNames.contains(filename) {
                if (try? fileManager.removeItem(at: file)) != nil {
                    removed += 1
                }
            }
        }
        return removed
    }
}


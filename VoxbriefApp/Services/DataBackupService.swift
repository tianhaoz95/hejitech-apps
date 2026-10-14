import Foundation

public struct BackupMetadata: Codable, Sendable {
    public let appVersion: String
    public let exportedAt: Date
    public let noteCount: Int

    public init(appVersion: String = "1.21.0", exportedAt: Date = Date(), noteCount: Int) {
        self.appVersion = appVersion
        self.exportedAt = exportedAt
        self.noteCount = noteCount
    }
}

public struct BackupPackage: Codable, Sendable {
    public let metadata: BackupMetadata
    public let notes: [VoiceNote]

    public init(notes: [VoiceNote]) {
        self.metadata = BackupMetadata(noteCount: notes.count)
        self.notes = notes
    }
}

public enum BackupError: LocalizedError {
    case invalidFileFormat
    case emptyBackup
    case writeFailed

    public var errorDescription: String? {
        switch self {
        case .invalidFileFormat:
            return "The selected file is not a valid Voxbrief backup JSON package."
        case .emptyBackup:
            return "The backup file contains no voice notes."
        case .writeFailed:
            return "Failed to write backup package to disk."
        }
    }
}

/// Manages full JSON backups and restores of the entire note library.
public final class DataBackupService: @unchecked Sendable {
    public static let shared = DataBackupService()

    public init() {}

    /// Exports all voice notes into an encrypted/portable JSON package.
    public func createBackupFile(for notes: [VoiceNote]) -> URL? {
        let package = BackupPackage(notes: notes)
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        encoder.dateEncodingStrategy = .iso8601

        do {
            let data = try encoder.encode(package)
            let dateStr = ISO8601DateFormatter().string(from: Date()).replacingOccurrences(of: ":", with: "-")
            let fileName = "Voxbrief_Backup_\(dateStr).json"
            let tempURL = FileManager.default.temporaryDirectory.appendingPathComponent(fileName)
            try data.write(to: tempURL, options: .atomic)
            return tempURL
        } catch {
            print("[DataBackupService] Failed to create backup file: \(error)")
            return nil
        }
    }

    /// Restores notes from a JSON backup file URL.
    public func restoreNotes(from fileURL: URL) throws -> [VoiceNote] {
        let data = try Data(contentsOf: fileURL)
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601

        // Attempt package decode first
        if let package = try? decoder.decode(BackupPackage.self, from: data) {
            guard !package.notes.isEmpty else {
                throw BackupError.emptyBackup
            }
            return package.notes
        }

        // Fall back to plain [VoiceNote] array decode
        if let notes = try? decoder.decode([VoiceNote].self, from: data) {
            guard !notes.isEmpty else {
                throw BackupError.emptyBackup
            }
            return notes
        }

        throw BackupError.invalidFileFormat
    }
}

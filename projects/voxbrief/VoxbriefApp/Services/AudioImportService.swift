import AVFoundation
import Foundation
import UniformTypeIdentifiers

enum AudioImportError: LocalizedError {
    case noAudioTrack
    case exportFailed(String)

    var errorDescription: String? {
        switch self {
        case .noAudioTrack:
            return "That file has no audio Voxbrief can read."
        case .exportFailed(let reason):
            return "Couldn't read the file's audio: \(reason)"
        }
    }
}

/// Turns a recording made elsewhere (a call, a lecture, a voice message, an old voice memo, a
/// video) into a note: copies or converts its audio to the app's own m4a storage, creates the
/// note with source `.imported`, and runs the same pipeline as a recording. Used by the list's
/// "Import Audio…" and by "Open in Voxbrief" from the share sheet or Files (the app declares
/// audio and video document types; iOS hands it a copy in Documents/Inbox).
@MainActor
final class AudioImportService {
    static let shared = AudioImportService()

    /// Formats copied as they are (AVFoundation and WhisperKit read them directly); anything else
    /// with an audio track, video included, is converted to m4a first.
    static let directlyReadableExtensions: Set<String> = ["m4a", "mp3", "wav", "aac", "caf", "aif", "aiff"]

    private let repository: NoteRepository
    private let pipeline: NoteProcessingPipeline
    private let audioFileManager: AudioFileManager
    private var isImportingInbox = false

    init(repository: NoteRepository = .shared, pipeline: NoteProcessingPipeline = .shared, audioFileManager: AudioFileManager = .shared) {
        self.repository = repository
        self.pipeline = pipeline
        self.audioFileManager = audioFileManager
    }

    /// Imports one file and starts processing it; returns the new note once it's saved (before
    /// processing finishes).
    @discardableResult
    func importFile(at source: URL, originalName: String? = nil) async throws -> VoiceNote {
        let noteId = UUID()
        let ext = source.pathExtension.lowercased()
        let storedExtension = Self.directlyReadableExtensions.contains(ext) ? ext : AudioConstants.fileExtension
        let fileName = "\(noteId.uuidString).\(storedExtension)"
        let destination = audioFileManager.url(for: fileName)

        if Self.directlyReadableExtensions.contains(ext) {
            try FileManager.default.copyItem(at: source, to: destination)
        } else {
            try await Self.exportAudio(from: source, to: destination)
        }

        let asset = AVURLAsset(url: destination)
        let duration = (try? await asset.load(.duration)).map(CMTimeGetSeconds) ?? 0
        let name = (originalName ?? source.lastPathComponent) as NSString

        let note = VoiceNote(
            id: noteId,
            createdAt: Date(),
            duration: duration.isFinite ? duration : 0,
            audioFileName: fileName,
            title: "Processing Voice Note...",
            summary: "Imported \(name.deletingPathExtension). Transcribing…",
            status: .transcribingASR,
            source: .imported
        )
        repository.save(note)
        Task { await pipeline.process(note: note) }
        return note
    }

    /// A file handed to the app by "Open in Voxbrief": imported, then the system's Inbox copy
    /// is deleted (the note keeps its own copy).
    func importOpenedFile(_ url: URL) async throws {
        defer { try? FileManager.default.removeItem(at: url) }
        let scoped = url.startAccessingSecurityScopedResource()
        defer { if scoped { url.stopAccessingSecurityScopedResource() } }
        try await importFile(at: url)
    }

    /// Imports what the share extension left in the App Group (`SharedImportInbox`). Called
    /// whenever the app becomes active; an entry that fails is dropped rather than retried
    /// forever.
    func importSharedInbox() async {
        guard !isImportingInbox else { return }
        isImportingInbox = true
        defer { isImportingInbox = false }
        for entry in SharedImportInbox.pending() {
            do {
                try await importFile(at: entry.file, originalName: entry.file.lastPathComponent)
            } catch {
                print("[AudioImportService] Shared \(entry.file.lastPathComponent) couldn't be imported: \(error)")
            }
            SharedImportInbox.remove(entry.folder)
        }
    }

    private static func exportAudio(from source: URL, to destination: URL) async throws {
        let asset = AVURLAsset(url: source)
        let tracks = (try? await asset.loadTracks(withMediaType: .audio)) ?? []
        guard !tracks.isEmpty else { throw AudioImportError.noAudioTrack }
        guard let session = AVAssetExportSession(asset: asset, presetName: AVAssetExportPresetAppleM4A) else {
            throw AudioImportError.exportFailed("no m4a export for this file")
        }
        session.outputURL = destination
        session.outputFileType = .m4a
        await session.export()
        if session.status != .completed {
            throw AudioImportError.exportFailed(session.error?.localizedDescription ?? "export \(session.status.rawValue)")
        }
    }
}

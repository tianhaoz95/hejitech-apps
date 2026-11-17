import Foundation
import AVFoundation

/// One piece of a watch recording, waiting on the iPhone to be joined with the others.
public struct WatchSessionPiece: Codable, Equatable, Sendable {
    public let id: UUID
    public let index: Int
    public let createdAt: Date
    public let duration: TimeInterval
    public let source: NoteSource
    public let fileName: String
}

/// Where the pieces of a watch recording wait until all of them have arrived.
///
/// The watch saves a long recording as a run of short files and sends them one by one, then a
/// list of which pieces make up the recording (`WatchSessionManifest`). They are kept here, apart
/// from the notes' audio, until the note for the whole recording has its transcript.
///
/// Every piece and the list are separate files written whole, so deliveries arriving on
/// WatchConnectivity's queue and reads on the main actor never share a file being written.
public struct WatchSessionStore: Sendable {
    public static let shared = WatchSessionStore()

    private let baseDirectory: URL

    public init(baseDirectory: URL? = nil) {
        self.baseDirectory = baseDirectory ?? FileManager.default
            .urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("WatchSessions", isDirectory: true)
    }

    private func directory(for sessionId: UUID) -> URL {
        baseDirectory.appendingPathComponent(sessionId.uuidString, isDirectory: true)
    }

    private func manifestURL(for sessionId: UUID) -> URL {
        directory(for: sessionId).appendingPathComponent("manifest.json")
    }

    // MARK: - Writing

    /// Copies an arriving piece in. Synchronous, because WatchConnectivity deletes the delivered
    /// file as soon as its delegate method returns.
    public func stagePiece(from sourceURL: URL, payload: WatchSyncPayload, sessionId: UUID) throws {
        let directory = directory(for: sessionId)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let fileName = "\(payload.noteId.uuidString).\(AudioConstants.fileExtension)"
        let target = directory.appendingPathComponent(fileName)
        try? FileManager.default.removeItem(at: target)
        try FileManager.default.copyItem(at: sourceURL, to: target)

        let piece = WatchSessionPiece(
            id: payload.noteId,
            index: payload.segmentIndex ?? 0,
            createdAt: payload.createdAt,
            duration: payload.duration,
            source: payload.source,
            fileName: fileName
        )
        let data = try JSONEncoder().encode(piece)
        try data.write(to: directory.appendingPathComponent("\(payload.noteId.uuidString).json"), options: .atomic)
    }

    public func saveManifest(_ manifest: WatchSessionManifest) throws {
        let directory = directory(for: manifest.sessionId)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        try JSONEncoder().encode(manifest).write(to: manifestURL(for: manifest.sessionId), options: .atomic)
    }

    /// Marks a recording as turned into a note. It is never built a second time, so deleting the
    /// note does not bring it back from pieces still waiting here.
    public func markAssembled(_ sessionId: UUID) {
        let directory = directory(for: sessionId)
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        try? Data().write(to: directory.appendingPathComponent("assembled"))
    }

    public func isAssembled(_ sessionId: UUID) -> Bool {
        FileManager.default.fileExists(atPath: directory(for: sessionId).appendingPathComponent("assembled").path)
    }

    // MARK: - Reading

    public func sessionIds() -> [UUID] {
        let names = (try? FileManager.default.contentsOfDirectory(atPath: baseDirectory.path)) ?? []
        return names.compactMap(UUID.init(uuidString:))
    }

    public func manifest(for sessionId: UUID) -> WatchSessionManifest? {
        guard let data = try? Data(contentsOf: manifestURL(for: sessionId)) else { return nil }
        return try? JSONDecoder().decode(WatchSessionManifest.self, from: data)
    }

    /// Every piece that has arrived, in recording order.
    public func stagedPieces(for sessionId: UUID) -> [WatchSessionPiece] {
        let directory = directory(for: sessionId)
        let names = (try? FileManager.default.contentsOfDirectory(atPath: directory.path)) ?? []
        let pieces: [WatchSessionPiece] = names
            .filter { $0.hasSuffix(".json") && $0 != "manifest.json" }
            .compactMap { name in
                guard let data = try? Data(contentsOf: directory.appendingPathComponent(name)),
                      let piece = try? JSONDecoder().decode(WatchSessionPiece.self, from: data),
                      FileManager.default.fileExists(atPath: directory.appendingPathComponent(piece.fileName).path) else { return nil }
                return piece
            }
        return Self.ordered(pieces)
    }

    /// The pieces the note is built from: the ones the watch listed once the list is known,
    /// otherwise everything that has arrived.
    public func pieces(for sessionId: UUID) -> [WatchSessionPiece] {
        let staged = stagedPieces(for: sessionId)
        guard let manifest = manifest(for: sessionId) else { return staged }
        let listed = Set(manifest.pieceIds)
        return staged.filter { listed.contains($0.id) }
    }

    /// True once the watch has said which pieces there are and every one of them is here.
    public func isComplete(_ sessionId: UUID) -> Bool {
        guard let manifest = manifest(for: sessionId) else { return false }
        return Self.isComplete(staged: Set(stagedPieces(for: sessionId).map(\.id)), listed: manifest.pieceIds)
    }

    public func url(for piece: WatchSessionPiece, sessionId: UUID) -> URL {
        directory(for: sessionId).appendingPathComponent(piece.fileName)
    }

    /// When the newest piece arrived: how long a recording has waited for the rest.
    public func newestArrival(for sessionId: UUID) -> Date? {
        stagedPieces(for: sessionId).compactMap { piece in
            (try? url(for: piece, sessionId: sessionId).resourceValues(forKeys: [.contentModificationDateKey]))?.contentModificationDate
        }.max()
    }

    // MARK: - Removing

    /// Removes pieces that have been used, and the recording's folder once no piece is left in it
    /// (a piece that arrived late stays, to be picked up on its own).
    public func remove(pieces: [WatchSessionPiece], sessionId: UUID) {
        let directory = directory(for: sessionId)
        for piece in pieces {
            try? FileManager.default.removeItem(at: directory.appendingPathComponent(piece.fileName))
            try? FileManager.default.removeItem(at: directory.appendingPathComponent("\(piece.id.uuidString).json"))
        }
        if stagedPieces(for: sessionId).isEmpty {
            try? FileManager.default.removeItem(at: directory)
        }
    }

    public func removeSession(_ sessionId: UUID) {
        try? FileManager.default.removeItem(at: directory(for: sessionId))
    }

    // MARK: - Pure rules

    static func ordered(_ pieces: [WatchSessionPiece]) -> [WatchSessionPiece] {
        pieces.sorted { ($0.index, $0.createdAt) < ($1.index, $1.createdAt) }
    }

    static func isComplete(staged: Set<UUID>, listed: [UUID]) -> Bool {
        listed.allSatisfy(staged.contains)
    }

    /// Shifts a piece's transcript timings to where the piece sits in the whole recording.
    static func offset(_ segments: [TranscriptTimingSegment], by seconds: TimeInterval) -> [TranscriptTimingSegment] {
        segments.map { TranscriptTimingSegment(start: $0.start + seconds, end: $0.end + seconds, text: $0.text) }
    }

    // MARK: - Joining audio

    /// Writes the pieces end to end as one audio file at `destination`, without re-encoding when
    /// the pieces allow it. A single piece is simply copied.
    public static func combineAudio(urls: [URL], to destination: URL) async throws {
        guard !urls.isEmpty else { throw CombineError.nothingToCombine }
        let fileManager = FileManager.default
        let temporary = destination.deletingLastPathComponent()
            .appendingPathComponent("joining-\(UUID().uuidString).\(AudioConstants.fileExtension)")
        defer { try? fileManager.removeItem(at: temporary) }

        if urls.count == 1 {
            try fileManager.copyItem(at: urls[0], to: temporary)
        } else {
            let composition = AVMutableComposition()
            guard let track = composition.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid) else {
                throw CombineError.exportFailed("Could not create an audio track.")
            }
            var cursor = CMTime.zero
            for url in urls {
                let asset = AVURLAsset(url: url)
                guard let source = try await asset.loadTracks(withMediaType: .audio).first else { continue }
                let duration = try await asset.load(.duration)
                try track.insertTimeRange(CMTimeRange(start: .zero, duration: duration), of: source, at: cursor)
                cursor = cursor + duration
            }
            guard cursor > .zero else { throw CombineError.nothingToCombine }

            do {
                try await export(composition, preset: AVAssetExportPresetPassthrough, to: temporary)
            } catch {
                // Pieces that can't be joined as they are (different formats) are re-encoded.
                try? fileManager.removeItem(at: temporary)
                try await export(composition, preset: AVAssetExportPresetAppleM4A, to: temporary)
            }
        }

        try? fileManager.removeItem(at: destination)
        try fileManager.moveItem(at: temporary, to: destination)
    }

    private static func export(_ composition: AVComposition, preset: String, to url: URL) async throws {
        guard let session = AVAssetExportSession(asset: composition, presetName: preset) else {
            throw CombineError.exportFailed("No exporter for \(preset).")
        }
        session.outputURL = url
        session.outputFileType = .m4a
        await session.export()
        guard session.status == .completed else {
            throw CombineError.exportFailed(session.error?.localizedDescription ?? "Export did not finish.")
        }
    }

    public enum CombineError: LocalizedError {
        case nothingToCombine
        case exportFailed(String)

        public var errorDescription: String? {
            switch self {
            case .nothingToCombine: return "The recording has no audio to join."
            case .exportFailed(let reason): return "Could not join the recording's pieces: \(reason)"
            }
        }
    }
}

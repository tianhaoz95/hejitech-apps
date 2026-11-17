import Foundation

/// Defines keys and helpers for WatchConnectivity file and metadata transfers
public struct SyncConstants {
    public static let keyNoteId = "note_id"
    public static let keyCreatedAt = "created_at"
    public static let keyDuration = "duration"
    public static let keySource = "source"
    public static let keyAudioFileName = "audio_filename"
    public static let keyAction = "action"
    /// The recording a piece belongs to, and the piece's place in it. Absent on files from watch
    /// builds that sent every recording as one file.
    public static let keySessionId = "session_id"
    public static let keySegmentIndex = "segment_index"
    public static let keyPieceIds = "piece_ids"
    
    // Actions
    public static let actionAudioTransfer = "audio_transfer"
    public static let actionPing = "ping"
    public static let actionAck = "ack"
    public static let actionRequestSync = "request_sync"
    /// Sent (as user info) once a recording is over: the full list of its pieces, so the iPhone
    /// knows when it has them all and can build the one note.
    public static let actionSessionComplete = "session_complete"
}

public struct WatchSyncPayload: Codable, Sendable {
    public let noteId: UUID
    public let createdAt: Date
    public let duration: TimeInterval
    public let source: NoteSource
    public let audioFileName: String
    public let sessionId: UUID?
    public let segmentIndex: Int?
    
    public init(noteId: UUID, createdAt: Date, duration: TimeInterval, source: NoteSource, audioFileName: String, sessionId: UUID? = nil, segmentIndex: Int? = nil) {
        self.noteId = noteId
        self.createdAt = createdAt
        self.duration = duration
        self.source = source
        self.audioFileName = audioFileName
        self.sessionId = sessionId
        self.segmentIndex = segmentIndex
    }
    
    public var dictionaryRepresentation: [String: Any] {
        var dictionary = baseDictionary
        if let sessionId { dictionary[SyncConstants.keySessionId] = sessionId.uuidString }
        if let segmentIndex { dictionary[SyncConstants.keySegmentIndex] = segmentIndex }
        return dictionary
    }

    private var baseDictionary: [String: Any] {
        return [
            SyncConstants.keyAction: SyncConstants.actionAudioTransfer,
            SyncConstants.keyNoteId: noteId.uuidString,
            SyncConstants.keyCreatedAt: createdAt.timeIntervalSince1970,
            SyncConstants.keyDuration: duration,
            SyncConstants.keySource: source.rawValue,
            SyncConstants.keyAudioFileName: audioFileName
        ]
    }
    
    public static func from(dictionary: [String: Any]) -> WatchSyncPayload? {
        guard let idString = dictionary[SyncConstants.keyNoteId] as? String,
              let id = UUID(uuidString: idString),
              let timestamp = dictionary[SyncConstants.keyCreatedAt] as? TimeInterval,
              let duration = dictionary[SyncConstants.keyDuration] as? TimeInterval,
              let sourceRaw = dictionary[SyncConstants.keySource] as? String,
              let source = NoteSource(rawValue: sourceRaw),
              let audioFileName = dictionary[SyncConstants.keyAudioFileName] as? String else {
            return nil
        }
        return WatchSyncPayload(
            noteId: id,
            createdAt: Date(timeIntervalSince1970: timestamp),
            duration: duration,
            source: source,
            audioFileName: audioFileName,
            sessionId: (dictionary[SyncConstants.keySessionId] as? String).flatMap(UUID.init(uuidString:)),
            segmentIndex: dictionary[SyncConstants.keySegmentIndex] as? Int
        )
    }
}

/// The list of pieces that make up one finished watch recording.
public struct WatchSessionManifest: Codable, Equatable, Sendable {
    public let sessionId: UUID
    public let pieceIds: [UUID]

    public init(sessionId: UUID, pieceIds: [UUID]) {
        self.sessionId = sessionId
        self.pieceIds = pieceIds
    }

    public var dictionaryRepresentation: [String: Any] {
        [
            SyncConstants.keyAction: SyncConstants.actionSessionComplete,
            SyncConstants.keySessionId: sessionId.uuidString,
            SyncConstants.keyPieceIds: pieceIds.map(\.uuidString)
        ]
    }

    public static func from(dictionary: [String: Any]) -> WatchSessionManifest? {
        guard dictionary[SyncConstants.keyAction] as? String == SyncConstants.actionSessionComplete,
              let idString = dictionary[SyncConstants.keySessionId] as? String,
              let id = UUID(uuidString: idString),
              let pieces = dictionary[SyncConstants.keyPieceIds] as? [String] else {
            return nil
        }
        return WatchSessionManifest(sessionId: id, pieceIds: pieces.compactMap(UUID.init(uuidString:)))
    }
}

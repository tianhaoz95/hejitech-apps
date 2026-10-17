import ContempoCore
import Foundation
@preconcurrency import Supabase

public struct PendingAudioCapture: Sendable, Identifiable, Equatable {
    public let id: String
    public let storagePath: String
    public let capturedAt: Timestamp
    public let lat: Double?
    public let lng: Double?
    /// Which Whisper checkpoint to transcribe with.
    public let language: CaptureLanguage

    public init(id: String, storagePath: String, capturedAt: Timestamp, lat: Double?, lng: Double?, language: CaptureLanguage = .auto) {
        self.id = id
        self.storagePath = storagePath
        self.capturedAt = capturedAt
        self.lat = lat
        self.lng = lng
        self.language = language
    }
}

/// Audio recorded on a device that can't transcribe it (the watch), waiting for the phone:
/// contempo.audio_captures, with the audio itself in Storage at `storagePath`.
public final class AudioCaptureQueue: Sendable {
    public init() {}

    private struct Row: Codable, Sendable {
        let id: String
        var user_id: String?
        let storage_path: String
        let captured_at: Timestamp
        let lat: Double?
        let lng: Double?
        let language: String?

        var pending: PendingAudioCapture {
            PendingAudioCapture(id: id, storagePath: storage_path, capturedAt: captured_at, lat: lat, lng: lng,
                                language: language.map(CaptureLanguage.init(firestoreValue:)) ?? .auto)
        }
    }

    @discardableResult
    public func enqueue(storagePath: String, capturedAt: Timestamp, lat: Double?, lng: Double?, language: CaptureLanguage = .auto) async throws -> String {
        let id = ContempoBackend.newId()
        try await ContempoBackend.client.from("audio_captures").insert(
            Row(id: id, user_id: try ContempoBackend.requireUid(), storage_path: storagePath, captured_at: capturedAt, lat: lat, lng: lng, language: language.firestoreValue)
        ).execute()
        return id
    }

    public func listPending() async throws -> [PendingAudioCapture] {
        let rows: [Row] = try await ContempoBackend.client.from("audio_captures").select().order("captured_at", ascending: true).execute().value
        return rows.map(\.pending)
    }

    public func observePending() -> AsyncThrowingStream<[PendingAudioCapture], Error> {
        let rows = ContempoBackend.liveRows("audio_captures", orderBy: "captured_at", ascending: true, as: Row.self)
        return AsyncThrowingStream { continuation in
            let task = Task {
                do {
                    for try await batch in rows { continuation.yield(batch.map(\.pending)) }
                    continuation.finish()
                } catch { continuation.finish(throwing: error) }
            }
            continuation.onTermination = { _ in task.cancel() }
        }
    }

    public func remove(captureId: String) async throws {
        try await ContempoBackend.client.from("audio_captures").delete().eq("id", value: captureId).execute()
    }
}

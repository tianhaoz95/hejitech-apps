import Foundation
@preconcurrency import Supabase

/// The watch's half of the audio queue: after uploading a recording to Storage, it adds a row to
/// contempo.audio_captures for the phone to transcribe and parse (AudioCaptureProcessor).
public final class WatchAudioCaptureQueueWriter: Sendable {
    public init() {}

    private struct Row: Encodable {
        let id: String
        let user_id: String
        let storage_path: String
        let captured_at: Timestamp
        let lat: Double?
        let lng: Double?
        let language: String
    }

    @discardableResult
    public func enqueue(storagePath: String, capturedAt: Date, lat: Double?, lng: Double?, language: CaptureLanguage = .auto) async throws -> String {
        guard let uid = ContempoBackend.uid else { throw WatchAudioCaptureQueueWriterError.notSignedIn }
        let id = ContempoBackend.newId()
        do {
            try await ContempoBackend.client.from("audio_captures").insert(
                Row(id: id, user_id: uid, storage_path: storagePath, captured_at: Timestamp(date: capturedAt), lat: lat, lng: lng, language: language.firestoreValue)
            ).execute()
        } catch {
            throw WatchAudioCaptureQueueWriterError.requestFailed(error.localizedDescription)
        }
        return id
    }
}

public enum WatchAudioCaptureQueueWriterError: Error, Sendable {
    case notSignedIn
    case requestFailed(String)
    case malformedResponse
}

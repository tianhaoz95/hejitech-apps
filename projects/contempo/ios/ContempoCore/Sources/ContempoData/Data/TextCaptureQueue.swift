import ContempoCore
import Foundation
@preconcurrency import Supabase

public struct PendingTextCapture: Sendable, Identifiable, Equatable {
    public let id: String
    public let rawText: String
    public let capturedAt: Timestamp
    public let lat: Double?
    public let lng: Double?

    public init(id: String, rawText: String, capturedAt: Timestamp, lat: Double?, lng: Double?) {
        self.id = id
        self.rawText = rawText
        self.capturedAt = capturedAt
        self.lat = lat
        self.lng = lng
    }
}

/// Quick Capture's typed text, saved immediately and parsed in the background: contempo.text_captures.
public final class TextCaptureQueue: Sendable {
    public init() {}

    private struct Row: Codable, Sendable {
        let id: String
        var user_id: String?
        let raw_text: String
        let captured_at: Timestamp
        let lat: Double?
        let lng: Double?

        var pending: PendingTextCapture { PendingTextCapture(id: id, rawText: raw_text, capturedAt: captured_at, lat: lat, lng: lng) }
    }

    @discardableResult
    public func enqueue(rawText: String, capturedAt: Timestamp = Timestamp(date: Date()), lat: Double?, lng: Double?) async throws -> String {
        let id = ContempoBackend.newId()
        try await ContempoBackend.client.from("text_captures").insert(
            Row(id: id, user_id: try ContempoBackend.requireUid(), raw_text: rawText, captured_at: capturedAt, lat: lat, lng: lng)
        ).execute()
        return id
    }

    public func listPending() async throws -> [PendingTextCapture] {
        let rows: [Row] = try await ContempoBackend.client.from("text_captures").select().order("captured_at", ascending: true).execute().value
        return rows.map(\.pending)
    }

    public func observePending() -> AsyncThrowingStream<[PendingTextCapture], Error> {
        let rows = ContempoBackend.liveRows("text_captures", orderBy: "captured_at", ascending: true, as: Row.self)
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
        try await ContempoBackend.client.from("text_captures").delete().eq("id", value: captureId).execute()
    }
}

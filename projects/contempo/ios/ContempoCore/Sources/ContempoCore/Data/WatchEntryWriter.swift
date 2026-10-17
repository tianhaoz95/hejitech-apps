import Foundation
@preconcurrency import Supabase

public enum WatchEntryWriterError: Error, Sendable {
    case notSignedIn
    case requestFailed(String)
    case malformedResponse
}

/// Writes a finished, confirmed entry straight from the watch (a work timer or GPS trip stopped
/// on the wrist) into contempo.entries.
public final class WatchEntryWriter: Sendable {
    public init() {}

    private struct Row: Encodable {
        let id: String
        let user_id: String
        let task: String
        let duration_minutes: Int
        let category: String
        let status: String
        let source: String
        let activity_date: Timestamp
        let logged_at: Timestamp
        let confirmed_at: Timestamp
        let is_trip: Bool
        let mileage_capture_method: String
        let stopped_at: Timestamp
    }

    @discardableResult
    public func saveConfirmedEntry(
        task: String,
        durationMinutes: Int,
        category: String = EntryCategory.admin.firestoreValue,
        isTrip: Bool = false,
        source: String = CaptureSource.manual.firestoreValue,
        startedAt: Date,
        stoppedAt: Date = Date()
    ) async throws -> String {
        guard let uid = ContempoBackend.uid else { throw WatchEntryWriterError.notSignedIn }
        let id = ContempoBackend.newId()
        let stopped = Timestamp(date: stoppedAt)
        do {
            try await ContempoBackend.client.from("entries").insert(
                Row(
                    id: id, user_id: uid, task: task, duration_minutes: durationMinutes, category: category,
                    status: EntryStatus.confirmed.firestoreValue, source: source,
                    activity_date: Timestamp(date: startedAt), logged_at: stopped, confirmed_at: stopped,
                    is_trip: isTrip, mileage_capture_method: isTrip ? "gps" : "", stopped_at: stopped
                )
            ).execute()
        } catch {
            throw WatchEntryWriterError.requestFailed(error.localizedDescription)
        }
        return id
    }
}

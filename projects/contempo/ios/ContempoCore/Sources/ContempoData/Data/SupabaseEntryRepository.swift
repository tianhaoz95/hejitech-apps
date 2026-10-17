import ContempoCore
import Foundation
@preconcurrency import Supabase

/// EntryRepository on Supabase (schema contempo, bucket contempo), replacing
/// FirestoreEntryRepository. Rows are scoped to the signed-in user by RLS (user_id defaults to
/// auth.uid()); files live under `<uid>/…` in the private bucket and are shown through long-lived
/// signed URLs stored on the row, the way Firestore stored download URLs.
public final class SupabaseEntryRepository: EntryRepository, Sendable {
    public init() {}

    private var db: SupabaseClient { ContempoBackend.client }

    private struct NamedRow: Encodable { let id: String; let name: String }
    private struct NameOnly: Encodable { let name: String }

    public func observeEntries() -> AsyncThrowingStream<[Entry], Error> {
        ContempoBackend.liveRows("entries", orderBy: "activity_date", ascending: false)
    }

    public func observeProperties() -> AsyncThrowingStream<[Property], Error> {
        ContempoBackend.liveRows("properties", orderBy: "created_at", ascending: true)
    }

    public func createProperty(name: String) async throws -> Property {
        try await db.from("properties").insert(NamedRow(id: ContempoBackend.newId(), name: name)).select().single().execute().value
    }

    public func deleteProperty(propertyId: String) async throws {
        try await db.from("properties").delete().eq("id", value: propertyId).execute()
    }

    public func observeRoles() -> AsyncThrowingStream<[ParticipantRole], Error> {
        ContempoBackend.liveRows("roles", orderBy: "created_at", ascending: true)
    }

    public func createRole(name: String) async throws -> ParticipantRole {
        try await db.from("roles").insert(NamedRow(id: ContempoBackend.newId(), name: name)).select().single().execute().value
    }

    public func renameRole(roleId: String, name: String) async throws {
        try await db.from("roles").update(NameOnly(name: name)).eq("id", value: roleId).execute()
    }

    public func deleteRole(roleId: String) async throws {
        try await db.from("roles").delete().eq("id", value: roleId).execute()
    }

    public func observeCategories() -> AsyncThrowingStream<[CustomCategory], Error> {
        ContempoBackend.liveRows("categories", orderBy: "created_at", ascending: true)
    }

    public func createCategory(name: String) async throws -> CustomCategory {
        try await db.from("categories").insert(NamedRow(id: ContempoBackend.newId(), name: name)).select().single().execute().value
    }

    private struct UsageParams: Encodable {
        let p_week_id: String
        let p_week_start: Timestamp
        let p_input: Int
        let p_output: Int
    }

    public func observeDeviceTokenUsage() -> AsyncThrowingStream<TokenUsageWeek?, Error> { observeTokenUsage(kind: "device") }

    public func recordOnDeviceTokenUsage(inputTokens: Int, outputTokens: Int) async throws {
        try await db.rpc(
            "record_device_token_usage",
            params: UsageParams(p_week_id: currentIsoWeekId(), p_week_start: currentIsoWeekStart(), p_input: inputTokens, p_output: outputTokens)
        ).execute()
    }

    private struct UsageRow: Decodable, Sendable {
        let kind: String
        let week_id: String
        let input_tokens: Int
        let output_tokens: Int
        let request_count: Int
        let week_start: Timestamp?
        let updated_at: Timestamp?
    }

    private func observeTokenUsage(kind: String) -> AsyncThrowingStream<TokenUsageWeek?, Error> {
        let week = currentIsoWeekId()
        let rows = ContempoBackend.liveRows("token_usage", orderBy: "week_id", ascending: true, as: UsageRow.self)
        return AsyncThrowingStream { continuation in
            let task = Task {
                do {
                    for try await batch in rows {
                        let row = batch.first { $0.kind == kind && $0.week_id == week }
                        continuation.yield(row.map {
                            TokenUsageWeek(inputTokens: $0.input_tokens, outputTokens: $0.output_tokens, requestCount: $0.request_count, weekStart: $0.week_start, updatedAt: $0.updated_at)
                        })
                    }
                    continuation.finish()
                } catch { continuation.finish(throwing: error) }
            }
            continuation.onTermination = { _ in task.cancel() }
        }
    }

    public func createEntry(_ entry: Entry) async throws -> String {
        var row = entry
        let id = entry.id ?? newEntryId()
        row.id = id
        try await db.from("entries").insert(row).execute()
        return id
    }

    public func newEntryId() -> String { ContempoBackend.newId() }

    public func getEntry(entryId: String) async throws -> Entry? {
        let rows: [Entry] = try await db.from("entries").select().eq("id", value: entryId).execute().value
        return rows.first
    }

    public func findOpenEntry(isTrip: Bool) async throws -> Entry? {
        let rows: [Entry] = try await db.from("entries").select()
            .eq("in_progress", value: true)
            .eq("is_trip", value: isTrip)
            .limit(1)
            .execute().value
        return rows.first
    }

    /// Full replace, like Firestore's setData: an upsert keeps "create with a known id" working too.
    public func updateEntry(entryId: String, entry: Entry) async throws {
        var row = entry
        row.id = entryId
        try await db.from("entries").upsert(row).execute()
    }

    public func deleteEntry(entryId: String) async throws {
        try await db.from("entries").delete().eq("id", value: entryId).execute()
    }

    public func deleteEntries(entryIds: [String]) async throws {
        var start = 0
        while start < entryIds.count {
            let chunk = Array(entryIds[start..<min(start + 200, entryIds.count)])
            try await db.from("entries").delete().in("id", values: chunk).execute()
            start += 200
        }
    }

    private struct PhotoUrls: Encodable { let photo_urls: [String] }

    public func attachPhoto(entryId: String, imageData: Data) async throws -> String {
        let uid = try ContempoBackend.requireUid()
        let path = "\(uid)/entries/\(entryId)/\(Int(Date().timeIntervalSince1970 * 1000)).jpg"
        let url = try await ContempoBackend.uploadFile(path: path, data: imageData, contentType: "image/jpeg")
        let current = try await getEntry(entryId: entryId)?.photoUrls ?? []
        try await db.from("entries").update(PhotoUrls(photo_urls: current + [url])).eq("id", value: entryId).execute()
        return url
    }

    private struct CorrectionRow: Encodable {
        let id: String
        let entry_id: String
        let field_name: String
        let ai_value: String
        let final_value: String
    }

    public func recordCorrection(entryId: String, fieldName: String, aiValue: String, finalValue: String) async throws {
        try await db.from("corrections").insert(
            CorrectionRow(id: ContempoBackend.newId(), entry_id: entryId, field_name: fieldName, ai_value: aiValue, final_value: finalValue)
        ).execute()
    }

    public func listAttachments(entryId: String) async throws -> [Attachment] {
        try await db.from("attachments").select().eq("entry_id", value: entryId).order("uploaded_at", ascending: true).execute().value
    }

    private struct AttachmentRow: Encodable {
        let id: String
        let entry_id: String
        let file_name: String
        let content_type: String
        let file_size: Int64
        let storage_path: String
        let download_url: String
        let note: String
    }

    public func uploadAttachment(
        entryId: String,
        fileURL: URL,
        fileName: String,
        contentType: String,
        onProgress: @escaping @Sendable (Double) -> Void
    ) async throws -> Attachment {
        let uid = try ContempoBackend.requireUid()
        onProgress(0)
        let data = try Data(contentsOf: fileURL)
        let storagePath = "\(uid)/entries/\(entryId)/attachments/\(Int(Date().timeIntervalSince1970 * 1000))_\(Self.sanitizeFileNameComponent(fileName))"
        let url = try await ContempoBackend.uploadFile(path: storagePath, data: data, contentType: contentType)
        onProgress(1)
        return try await db.from("attachments").insert(
            AttachmentRow(id: ContempoBackend.newId(), entry_id: entryId, file_name: fileName, content_type: contentType,
                          file_size: Int64(data.count), storage_path: storagePath, download_url: url, note: "")
        ).select().single().execute().value
    }

    public func deleteAttachment(entryId: String, attachment: Attachment) async throws {
        try? await ContempoBackend.removeFile(path: attachment.storagePath)
        if let id = attachment.id {
            try await db.from("attachments").delete().eq("id", value: id).execute()
        }
    }

    public func downloadAttachment(
        entryId: String,
        attachment: Attachment,
        onProgress: @escaping @Sendable (Double) -> Void
    ) async throws -> URL {
        let cacheDirectory = FileManager.default.temporaryDirectory.appendingPathComponent("attachments", isDirectory: true)
        try FileManager.default.createDirectory(at: cacheDirectory, withIntermediateDirectories: true)
        let localURL = cacheDirectory.appendingPathComponent("\(attachment.id ?? UUID().uuidString)_\(Self.sanitizeFileNameComponent(attachment.fileName))")
        if FileManager.default.fileExists(atPath: localURL.path) { return localURL }
        onProgress(0)
        let data = try await ContempoBackend.downloadFile(path: attachment.storagePath)
        try data.write(to: localURL)
        onProgress(1)
        return localURL
    }

    private struct NoteOnly: Encodable { let note: String }

    public func updateAttachmentNote(entryId: String, attachmentId: String, note: String) async throws {
        try await db.from("attachments").update(NoteOnly(note: note)).eq("id", value: attachmentId).execute()
    }

    private static func sanitizeFileNameComponent(_ fileName: String) -> String {
        fileName.replacingOccurrences(of: "[^A-Za-z0-9.\\-_]", with: "_", options: .regularExpression)
    }
}

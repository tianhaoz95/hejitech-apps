import Foundation
import ContempoCore

/// Firestore document shape for `users/{uid}/entries/{entryId}/attachments/{attachmentId}`
/// — an arbitrary-type file attached to an entry, parallel to (not a
/// replacement for) `Entry.photoUrls`. Immutable once written except for
/// `note` — see FirestoreEntryRepository.updateAttachmentNote and
/// firestore.rules' isValidNoteUpdate — a changed file is a new attachment
/// doc, not an overwrite of this one.
public struct Attachment: Codable, Identifiable, Equatable, Sendable {
    public var id: String?
    public var fileName: String
    public var contentType: String
    public var fileSize: Int64
    /// Stored explicitly (rather than derived from `downloadURL`) so
    /// delete/re-download can build a `StorageReference` directly instead
    /// of parsing a signed URL back into a path.
    public var storagePath: String
    public var downloadURL: String
    public var uploadedAt: Timestamp
    /// Free-form user note — what this evidence is for, or anything else
    /// worth recording alongside it. The one field on this doc that can be
    /// edited after creation. Optional (rather than a defaulted "") so
    /// decoding an attachment doc written before this field existed doesn't
    /// throw and silently drop it from the list.
    public var note: String?

    enum CodingKeys: String, CodingKey {
        case id = "id"
        case fileName = "file_name"
        case contentType = "content_type"
        case fileSize = "file_size"
        case storagePath = "storage_path"
        case downloadURL = "download_url"
        case uploadedAt = "uploaded_at"
        case note = "note"
    }

    /// Missing or null columns fall back to the model's defaults (Postgres nulls, older rows).
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decodeIfPresent(String.self, forKey: .id)
        fileName = try c.decodeIfPresent(String.self, forKey: .fileName) ?? ""
        contentType = try c.decodeIfPresent(String.self, forKey: .contentType) ?? ""
        fileSize = try c.decodeIfPresent(Int64.self, forKey: .fileSize) ?? 0
        storagePath = try c.decodeIfPresent(String.self, forKey: .storagePath) ?? ""
        downloadURL = try c.decodeIfPresent(String.self, forKey: .downloadURL) ?? ""
        uploadedAt = try c.decodeIfPresent(Timestamp.self, forKey: .uploadedAt) ?? Timestamp(date: Date())
        note = try c.decodeIfPresent(String.self, forKey: .note)
    }

    public init(
        id: String? = nil,
        fileName: String = "",
        contentType: String = "",
        fileSize: Int64 = 0,
        storagePath: String = "",
        downloadURL: String = "",
        uploadedAt: Timestamp = Timestamp(date: Date()),
        note: String? = nil
    ) {
        self.id = id
        self.fileName = fileName
        self.contentType = contentType
        self.fileSize = fileSize
        self.storagePath = storagePath
        self.downloadURL = downloadURL
        self.uploadedAt = uploadedAt
        self.note = note
    }
}

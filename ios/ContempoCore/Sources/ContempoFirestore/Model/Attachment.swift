@preconcurrency import FirebaseFirestore

/// Firestore document shape for `users/{uid}/entries/{entryId}/attachments/{attachmentId}`
/// — an arbitrary-type file attached to an entry, parallel to (not a
/// replacement for) `Entry.photoUrls`. Immutable once written: a changed
/// file is a new attachment doc, not an overwrite of this one.
public struct Attachment: Codable, Identifiable, Equatable, Sendable {
    @DocumentID public var id: String?
    public var fileName: String
    public var contentType: String
    public var fileSize: Int64
    /// Stored explicitly (rather than derived from `downloadURL`) so
    /// delete/re-download can build a `StorageReference` directly instead
    /// of parsing a signed URL back into a path.
    public var storagePath: String
    public var downloadURL: String
    public var uploadedAt: Timestamp

    public init(
        id: String? = nil,
        fileName: String = "",
        contentType: String = "",
        fileSize: Int64 = 0,
        storagePath: String = "",
        downloadURL: String = "",
        uploadedAt: Timestamp = Timestamp(date: Date())
    ) {
        self.id = id
        self.fileName = fileName
        self.contentType = contentType
        self.fileSize = fileSize
        self.storagePath = storagePath
        self.downloadURL = downloadURL
        self.uploadedAt = uploadedAt
    }
}

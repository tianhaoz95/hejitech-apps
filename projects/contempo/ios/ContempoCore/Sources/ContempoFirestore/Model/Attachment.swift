@preconcurrency import FirebaseFirestore

/// Firestore document shape for `users/{uid}/entries/{entryId}/attachments/{attachmentId}`
/// — an arbitrary-type file attached to an entry, parallel to (not a
/// replacement for) `Entry.photoUrls`. Immutable once written except for
/// `note` — see FirestoreEntryRepository.updateAttachmentNote and
/// firestore.rules' isValidNoteUpdate — a changed file is a new attachment
/// doc, not an overwrite of this one.
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
    /// Free-form user note — what this evidence is for, or anything else
    /// worth recording alongside it. The one field on this doc that can be
    /// edited after creation. Optional (rather than a defaulted "") so
    /// decoding an attachment doc written before this field existed doesn't
    /// throw and silently drop it from the list.
    public var note: String?

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

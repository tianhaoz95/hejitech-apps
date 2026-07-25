import Foundation

public protocol EntryRepository: Sendable {
    /// Live stream of all entries for the current user, newest activity first.
    func observeEntries() -> AsyncThrowingStream<[Entry], Error>

    func observeProperties() -> AsyncThrowingStream<[Property], Error>

    func createProperty(name: String) async throws -> Property

    /// Writes a new entry (typically status = pending_review) and returns its assigned id.
    func createEntry(_ entry: Entry) async throws -> String

    /// Allocates a new entry id locally, with no network call — lets a caller
    /// commit to an id up front (e.g. ConfirmViewModel) so a retry after a
    /// timed-out write becomes an idempotent overwrite via `updateEntry`
    /// instead of risking a second document from a second `createEntry` call.
    func newEntryId() -> String

    /// Looks up a single entry by id — used when resuming a pending_review
    /// entry into Confirm, to preserve its original loggedAt (the
    /// contemporaneity anchor) and photoUrls across the update rather than
    /// clobbering them with updateEntry's full-document overwrite.
    func getEntry(entryId: String) async throws -> Entry?

    /// The single open entry of the given kind for this user, if any — scoped
    /// by `isTrip` so a work timer and a mileage trip can be open
    /// simultaneously without either auto-closing the other.
    func findOpenEntry(isTrip: Bool) async throws -> Entry?

    /// Applies edits and/or flips status to confirmed. Full-document overwrite.
    func updateEntry(entryId: String, entry: Entry) async throws

    func deleteEntry(entryId: String) async throws

    /// Bulk delete — see Dashboard's multi-select. Chunked at Firestore's
    /// 500-write batch limit.
    func deleteEntries(entryIds: [String]) async throws

    /// Uploads a locally-captured photo to Storage under this entry and adds
    /// its download URL to the entry's photoUrls. Returns the download URL.
    func attachPhoto(entryId: String, imageData: Data) async throws -> String

    /// Records a correction for the feedback pipeline — captured from day one
    /// even though nothing consumes it yet (see reports/mvp-scope-v0.html
    /// Section 8).
    func recordCorrection(entryId: String, fieldName: String, aiValue: String, finalValue: String) async throws

    /// One-shot fetch of an entry's attachments, oldest first.
    func listAttachments(entryId: String) async throws -> [Attachment]

    /// Uploads an arbitrary local file to Storage under this entry's
    /// attachments/ path and records it in Firestore. `onProgress` reports
    /// fractional completion (0...1) for a progress UI.
    func uploadAttachment(entryId: String, fileURL: URL, fileName: String, contentType: String, onProgress: @escaping @Sendable (Double) -> Void) async throws -> Attachment

    /// Deletes both the Storage object and its Firestore doc.
    func deleteAttachment(entryId: String, attachment: Attachment) async throws

    /// Downloads an attachment to a local file for in-app viewing/sharing,
    /// skipping the download if already cached locally. Returns the local file URL.
    func downloadAttachment(entryId: String, attachment: Attachment, onProgress: @escaping @Sendable (Double) -> Void) async throws -> URL

    /// Updates just the `note` field on an already-uploaded attachment —
    /// the one field on that doc that isn't immutable, see `Attachment.note`.
    func updateAttachmentNote(entryId: String, attachmentId: String, note: String) async throws
}

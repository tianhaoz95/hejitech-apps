import ContempoCore
import ContempoFirestore
import Foundation
import Observation

struct UploadingAttachment: Identifiable {
    let id: UUID
    let fileName: String
    var progress: Double
}

@Observable
@MainActor
final class EntryDetailViewModel {
    private let entryRepository = ServiceLocator.entryRepository
    private let entryId: String

    var entry: Entry?
    var isLoading = true
    var isDeleting = false
    var deleteError: String?

    var attachments: [Attachment] = []
    var uploadingItems: [UploadingAttachment] = []
    var attachmentError: String?

    // Quick inline edit of property/task/duration, without leaving this
    // screen — see saveFields().
    var isEditingFields = false
    var editProperty = ""
    var editTask = ""
    var editDurationMinutes = ""
    var isSavingFields = false
    var fieldSaveError: String?

    init(entryId: String) {
        self.entryId = entryId
        Task {
            entry = try? await entryRepository.getEntry(entryId: entryId)
            isLoading = false
        }
        Task {
            attachments = (try? await entryRepository.listAttachments(entryId: entryId)) ?? []
        }
    }

    func delete(onDeleted: @escaping () -> Void) {
        isDeleting = true
        deleteError = nil
        Task {
            do {
                try await entryRepository.deleteEntry(entryId: entryId)
                onDeleted()
            } catch {
                isDeleting = false
                deleteError = error.localizedDescription
            }
        }
    }

    func dismissDeleteError() {
        deleteError = nil
    }

    /// Seeds the inline edit fields from the currently-loaded entry and switches into edit mode.
    func startEditingFields() {
        guard let entry else { return }
        editProperty = entry.propertyName
        editTask = entry.task
        editDurationMinutes = entry.durationMinutes > 0 ? String(entry.durationMinutes) : ""
        fieldSaveError = nil
        isEditingFields = true
    }

    func cancelEditingFields() {
        isEditingFields = false
        fieldSaveError = nil
    }

    /// No validation — same "save whatever's currently filled" policy as
    /// ConfirmViewModel.saveForLater, just without leaving this screen.
    /// Status is left untouched (confirming an entry stays an explicit
    /// action via the Confirm screen's "Complete" button) — this only
    /// updates the three fields, so a still-blank one keeps the entry's
    /// missingFields (computed from these same fields, see Entry.missingFields)
    /// non-empty.
    func saveFields() {
        guard var updated = entry else { return }
        let duration = Int(editDurationMinutes) ?? 0
        isSavingFields = true
        fieldSaveError = nil
        updated.propertyName = editProperty
        updated.task = editTask
        updated.durationMinutes = duration
        Task {
            do {
                try await entryRepository.updateEntry(entryId: entryId, entry: updated)
                entry = updated
                isEditingFields = false
                isSavingFields = false
            } catch {
                isSavingFields = false
                fieldSaveError = error.localizedDescription
            }
        }
    }

    func dismissFieldSaveError() {
        fieldSaveError = nil
    }

    func addAttachment(fileURL: URL, fileName: String, contentType: String) {
        // Keyed by a stable id, not array position — multi-selecting several
        // files fires concurrent uploads whose completion order isn't
        // guaranteed to match start order, and an earlier upload's removal
        // would otherwise shift a later upload's captured index out from
        // under it (crashing `remove(at:)` or updating the wrong row).
        let uploadId = UUID()
        uploadingItems.append(UploadingAttachment(id: uploadId, fileName: fileName, progress: 0))
        Task {
            do {
                let attachment = try await entryRepository.uploadAttachment(
                    entryId: entryId,
                    fileURL: fileURL,
                    fileName: fileName,
                    contentType: contentType
                ) { [weak self] progress in
                    Task { @MainActor in
                        guard let self else { return }
                        if let index = self.uploadingItems.firstIndex(where: { $0.id == uploadId }) {
                            self.uploadingItems[index].progress = progress
                        }
                    }
                }
                uploadingItems.removeAll { $0.id == uploadId }
                attachments.append(attachment)
            } catch {
                uploadingItems.removeAll { $0.id == uploadId }
                attachmentError = error.localizedDescription
            }
        }
    }

    func deleteAttachment(_ attachment: Attachment) {
        Task {
            do {
                try await entryRepository.deleteAttachment(entryId: entryId, attachment: attachment)
                attachments.removeAll { $0.id == attachment.id }
            } catch {
                attachmentError = error.localizedDescription
            }
        }
    }

    func dismissAttachmentError() {
        attachmentError = nil
    }

    func localFileURL(for attachment: Attachment) async throws -> URL {
        try await entryRepository.downloadAttachment(entryId: entryId, attachment: attachment) { _ in }
    }

    func updateNote(_ attachment: Attachment, note: String) {
        guard let attachmentId = attachment.id else { return }
        Task {
            do {
                try await entryRepository.updateAttachmentNote(entryId: entryId, attachmentId: attachmentId, note: note)
                if let index = attachments.firstIndex(where: { $0.id == attachmentId }) {
                    attachments[index].note = note
                }
            } catch {
                attachmentError = error.localizedDescription
            }
        }
    }
}

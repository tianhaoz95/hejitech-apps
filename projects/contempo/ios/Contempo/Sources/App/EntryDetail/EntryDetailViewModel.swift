import ContempoCore
import ContempoData
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
    private let agentClient = ServiceLocator.agentClient
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
    var editActivityDate = Date()
    /// A raw category value — either one of `EntryCategory`'s built-in
    /// `firestoreValue`s, or a free-form name from the user's own
    /// `users/{uid}/categories` roster (see `CustomCategory` and
    /// `ConfirmViewModel.category`'s doc comment — same reasoning) — added
    /// in place from this screen via `onAddNewCategoryClicked`/
    /// `onConfirmNewCategory` below, same as Confirm.
    var editCategory: String = EntryCategory.other.firestoreValue
    var isSavingFields = false
    var fieldSaveError: String?

    /// See `detectCategory()`.
    var isDetectingCategory = false
    var categoryDetectError: String?

    var categories: [CustomCategory] = []
    var isAddingNewCategory = false
    var newCategoryName = ""

    init(entryId: String) {
        self.entryId = entryId
        let repository = entryRepository
        // Live, not a one-shot getEntry() — this screen is reached right
        // back from Confirm after completing/editing this same entry, and
        // with a one-shot fetch the already-alive view model behind that
        // popped-back destination never re-reads, so "Complete" would show
        // the entry as still pending until the whole screen was torn down
        // and recreated (navigate away and back). A live listener picks up
        // that write immediately, same reasoning as CaptureViewModel's
        // openTripEntry/openTimerEntry.
        Task { [weak self] in
            let stream = AuthAwareStream.make(
                fallback: { [] },
                onAuthFailure: { try? await ServiceLocator.authManager.signOut() },
                factory: { repository.observeEntries() }
            )
            do {
                for try await entries in stream {
                    guard let self else { return }
                    self.entry = entries.first { $0.id == entryId }
                    self.isLoading = false
                }
            } catch {
                // Stream ended with a non-auth error — nothing else to do here.
            }
        }
        Task {
            attachments = (try? await entryRepository.listAttachments(entryId: entryId)) ?? []
        }
        Task { [weak self] in
            let stream = AuthAwareStream.make(
                fallback: { [] },
                onAuthFailure: { try? await ServiceLocator.authManager.signOut() },
                factory: { repository.observeCategories() }
            )
            do {
                for try await categories in stream {
                    guard let self else { return }
                    self.categories = categories
                }
            } catch {
                // Stream ended with a non-auth error — nothing else to do here.
            }
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
        editActivityDate = entry.activityDate.dateValue()
        editCategory = entry.category
        fieldSaveError = nil
        categoryDetectError = nil
        isEditingFields = true
    }

    func cancelEditingFields() {
        isEditingFields = false
        fieldSaveError = nil
    }

    /// On-device auto-detect for the category picker — a correctable
    /// suggestion, not a silent commit: the result just overwrites
    /// `editCategory`, which stays a normal editable picker the host can
    /// freely change afterward, same "AI fills it in, user can still edit"
    /// pattern as Confirm's photo-intent reclassify toggle (see
    /// `ConfirmViewModel.onTripModeToggled`).
    func detectCategory() {
        isDetectingCategory = true
        categoryDetectError = nil
        Task {
            switch await agentClient.suggestCategory(propertyName: editProperty, task: editTask) {
            case .success(let category, _):
                isDetectingCategory = false
                editCategory = category.firestoreValue
            case .failure(let message):
                isDetectingCategory = false
                categoryDetectError = message
            }
        }
    }

    /// Lets a category be created without leaving this screen — mirrors
    /// `ConfirmViewModel.onAddNewCategoryClicked`/`onConfirmNewCategory`
    /// exactly. Create-only, same as roles; there's no rename/delete UI for
    /// a category roster.
    func onAddNewCategoryClicked() {
        isAddingNewCategory = true
        newCategoryName = ""
    }

    func onCancelAddNewCategory() {
        isAddingNewCategory = false
        newCategoryName = ""
    }

    func onConfirmNewCategory() {
        let name = newCategoryName.trimmingCharacters(in: .whitespaces)
        guard !name.isEmpty else { return }
        Task {
            let created = try? await entryRepository.createCategory(name: name)
            editCategory = created?.name ?? name
            isAddingNewCategory = false
            newCategoryName = ""
        }
    }

    /// No validation — same "save whatever's currently filled" policy as
    /// ConfirmViewModel.saveForLater, just without leaving this screen.
    /// Status is left untouched (confirming an entry stays an explicit
    /// action via the Confirm screen's "Complete" button) — property/task/
    /// duration are the only fields missingFields tracks, so a still-blank
    /// one there keeps the entry's missingFields (see Entry.missingFields)
    /// non-empty; category is saved alongside them but isn't part of that
    /// check.
    func saveFields() {
        guard var updated = entry else { return }
        let duration = Int(editDurationMinutes) ?? 0
        isSavingFields = true
        fieldSaveError = nil
        updated.propertyName = editProperty
        updated.task = editTask
        updated.durationMinutes = duration
        updated.activityDate = Timestamp(date: editActivityDate)
        updated.category = editCategory
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

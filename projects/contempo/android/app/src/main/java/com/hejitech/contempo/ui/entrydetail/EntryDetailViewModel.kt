package com.hejitech.contempo.ui.entrydetail

import android.content.Context
import android.net.Uri
import android.provider.OpenableColumns
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.hejitech.core.model.Timestamp
import com.hejitech.contempo.agent.CategoryOutcome
import com.hejitech.contempo.data.ServiceLocator
import com.hejitech.contempo.data.recoverFromAuthRaceOrSignOut
import com.hejitech.core.model.Attachment
import com.hejitech.core.model.Category
import com.hejitech.core.model.Entry
import com.hejitech.core.model.EntryCategory
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.launchIn
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.onEach
import kotlinx.coroutines.launch
import java.io.File
import java.util.Date
import java.util.UUID

/** A not-yet-finished upload shown as a progress row — see [EntryDetailViewModel.addAttachment]. */
data class UploadingAttachment(
    val localId: String,
    val fileName: String,
    val progress: Float,
)

data class EntryDetailUiState(
    val entry: Entry? = null,
    val isLoading: Boolean = true,
    val isDeleting: Boolean = false,
    val deleteError: String? = null,
    val attachments: List<Attachment> = emptyList(),
    val uploadingItems: List<UploadingAttachment> = emptyList(),
    val attachmentError: String? = null,
    /** Quick inline edit of property/task/duration, without leaving this screen — see [EntryDetailViewModel.saveFields]. */
    val isEditingFields: Boolean = false,
    val editProperty: String = "",
    val editTask: String = "",
    val editDurationMinutes: String = "",
    val editActivityDateMillis: Long = 0L,
    /** See ConfirmUiState.category's kdoc — same "raw value, built-in or custom" shape, same [EntryCategory.displayName] rendering. */
    val editCategory: String = EntryCategory.OTHER.firestoreValue,
    val isSavingFields: Boolean = false,
    val fieldSaveError: String? = null,
    /** See [EntryDetailViewModel.detectCategory]. */
    val isDetectingCategory: Boolean = false,
    val categoryDetectError: String? = null,
    val categories: List<Category> = emptyList(),
    val isAddingNewCategory: Boolean = false,
    val newCategoryName: String = "",
)

class EntryDetailViewModel(private val entryId: String) : ViewModel() {
    private val entryRepository = ServiceLocator.entryRepository
    private val agentClient = ServiceLocator.agentClient

    private val _uiState = MutableStateFlow(EntryDetailUiState())
    val uiState: StateFlow<EntryDetailUiState> = _uiState.asStateFlow()

    init {
        // Live, not a one-shot getEntry() — this screen is reached right
        // back from Confirm after completing/editing this same entry (see
        // ContempoNavHost's onEditEntry), and with a one-shot fetch the
        // already-alive ViewModel behind that popped-back destination never
        // re-reads, so "Complete" would show the entry as still pending
        // until the whole screen was torn down and recreated (navigate away
        // and back). A live listener picks up that write immediately, same
        // "own StateFlow so it can't go stale" reasoning as CaptureViewModel's
        // openTripEntry/openTimerEntry.
        entryRepository.observeEntries()
            .map { entries -> entries.find { it.id == entryId } }
            .recoverFromAuthRaceOrSignOut { null }
            .onEach { entry -> _uiState.value = _uiState.value.copy(entry = entry, isLoading = false) }
            .launchIn(viewModelScope)

        viewModelScope.launch {
            val attachments = runCatching { entryRepository.listAttachments(entryId) }.getOrDefault(emptyList())
            _uiState.value = _uiState.value.copy(attachments = attachments)
        }

        entryRepository.observeCategories()
            .recoverFromAuthRaceOrSignOut { emptyList() }
            .onEach { categories -> _uiState.value = _uiState.value.copy(categories = categories) }
            .launchIn(viewModelScope)
    }

    fun delete(onDeleted: () -> Unit) {
        _uiState.value = _uiState.value.copy(isDeleting = true, deleteError = null)
        viewModelScope.launch {
            try {
                entryRepository.deleteEntry(entryId)
                onDeleted()
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(isDeleting = false, deleteError = e.message ?: "Couldn't delete — try again.")
            }
        }
    }

    fun dismissDeleteError() {
        _uiState.value = _uiState.value.copy(deleteError = null)
    }

    /** Seeds the inline edit fields from the currently-loaded entry and switches into edit mode. */
    fun startEditingFields() {
        val entry = _uiState.value.entry ?: return
        _uiState.value = _uiState.value.copy(
            isEditingFields = true,
            editProperty = entry.propertyName,
            editTask = entry.task,
            editDurationMinutes = if (entry.durationMinutes > 0) entry.durationMinutes.toString() else "",
            editActivityDateMillis = entry.activityDate.toDate().time,
            editCategory = entry.category,
            fieldSaveError = null,
            categoryDetectError = null,
        )
    }

    fun onEditPropertyChanged(value: String) { _uiState.value = _uiState.value.copy(editProperty = value) }
    fun onEditTaskChanged(value: String) { _uiState.value = _uiState.value.copy(editTask = value) }
    fun onEditDurationChanged(value: String) {
        if (value.all { it.isDigit() }) _uiState.value = _uiState.value.copy(editDurationMinutes = value)
    }
    fun onEditActivityDateTimeChanged(millis: Long) { _uiState.value = _uiState.value.copy(editActivityDateMillis = millis) }
    fun onEditCategoryChanged(value: String) { _uiState.value = _uiState.value.copy(editCategory = value) }

    fun cancelEditingFields() {
        _uiState.value = _uiState.value.copy(isEditingFields = false, fieldSaveError = null)
    }

    /** Lets a category be created in place here too — mirrors ConfirmViewModel.onAddNewCategoryClicked exactly. */
    fun onAddNewCategoryClicked() {
        _uiState.value = _uiState.value.copy(isAddingNewCategory = true, newCategoryName = "")
    }

    fun onCancelAddNewCategory() {
        _uiState.value = _uiState.value.copy(isAddingNewCategory = false, newCategoryName = "")
    }

    fun onNewCategoryNameChanged(value: String) {
        _uiState.value = _uiState.value.copy(newCategoryName = value)
    }

    fun onConfirmNewCategory() {
        val name = _uiState.value.newCategoryName.trim()
        if (name.isEmpty()) return
        viewModelScope.launch {
            val created = runCatching { entryRepository.createCategory(name) }.getOrNull()
            _uiState.value = _uiState.value.copy(
                editCategory = created?.name ?: name,
                isAddingNewCategory = false,
                newCategoryName = "",
            )
        }
    }

    /**
     * On-device auto-detect for the category dropdown — a correctable
     * suggestion, not a silent commit: the result just overwrites
     * [EntryDetailUiState.editCategory], which stays a normal editable
     * dropdown the host can freely change afterward, same "AI fills it in,
     * user can still edit" pattern as Confirm's photo-intent reclassify
     * toggle (see ConfirmViewModel.onTripModeToggled).
     */
    fun detectCategory() {
        val state = _uiState.value
        _uiState.value = state.copy(isDetectingCategory = true, categoryDetectError = null)
        viewModelScope.launch {
            when (val outcome = agentClient.suggestCategory(state.editProperty, state.editTask)) {
                is CategoryOutcome.Success -> _uiState.value = _uiState.value.copy(
                    isDetectingCategory = false,
                    editCategory = outcome.category.firestoreValue,
                )
                is CategoryOutcome.Failure -> _uiState.value = _uiState.value.copy(
                    isDetectingCategory = false,
                    categoryDetectError = outcome.message,
                )
            }
        }
    }

    /**
     * No validation — same "save whatever's currently filled" policy as
     * ConfirmViewModel.saveForLater, just without leaving this screen. Status
     * is left untouched (confirming an entry stays an explicit action via the
     * Confirm screen's "Complete" button) — property/task/duration are the
     * only fields missingFields tracks, so a still-blank one there keeps the
     * entry's missingFields (see Entry.missingFields) non-empty; category is
     * saved alongside them but isn't part of that check.
     */
    fun saveFields() {
        val state = _uiState.value
        val entry = state.entry ?: return
        val duration = state.editDurationMinutes.toIntOrNull() ?: 0
        _uiState.value = state.copy(isSavingFields = true, fieldSaveError = null)
        viewModelScope.launch {
            try {
                val updated = entry.copy(
                    propertyName = state.editProperty,
                    task = state.editTask,
                    durationMinutes = duration,
                    activityDate = Timestamp(Date(state.editActivityDateMillis)),
                    category = state.editCategory,
                )
                entryRepository.updateEntry(entryId, updated)
                _uiState.value = _uiState.value.copy(entry = updated, isEditingFields = false, isSavingFields = false)
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(isSavingFields = false, fieldSaveError = e.message ?: "Couldn't save — try again.")
            }
        }
    }

    fun dismissFieldSaveError() {
        _uiState.value = _uiState.value.copy(fieldSaveError = null)
    }

    /**
     * Resolves [uri]'s display name/MIME type via ContentResolver (only
     * available where a Context is reachable, i.e. the caller — this
     * ViewModel deliberately isn't an AndroidViewModel, see ServiceLocator's
     * kdoc on why FirestoreEntryRepository takes no Context) and uploads it.
     * Tracked as a synthetic [UploadingAttachment] (keyed by a local-only id,
     * not the eventual Firestore doc id, which doesn't exist yet) so the UI
     * can show a progress row until the real [Attachment] replaces it.
     */
    fun addAttachment(context: Context, uri: Uri) {
        val fileName = resolveFileName(context, uri)
        val contentType = context.contentResolver.getType(uri) ?: "application/octet-stream"
        val localId = UUID.randomUUID().toString()

        _uiState.value = _uiState.value.copy(
            uploadingItems = _uiState.value.uploadingItems + UploadingAttachment(localId, fileName, 0f),
        )

        viewModelScope.launch {
            try {
                val attachment = entryRepository.uploadAttachment(entryId, uri, fileName, contentType) { progress ->
                    _uiState.value = _uiState.value.copy(
                        uploadingItems = _uiState.value.uploadingItems.map {
                            if (it.localId == localId) it.copy(progress = progress) else it
                        },
                    )
                }
                _uiState.value = _uiState.value.copy(
                    uploadingItems = _uiState.value.uploadingItems.filterNot { it.localId == localId },
                    attachments = _uiState.value.attachments + attachment,
                )
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    uploadingItems = _uiState.value.uploadingItems.filterNot { it.localId == localId },
                    attachmentError = e.message ?: "Couldn't upload this file — try again.",
                )
            }
        }
    }

    fun deleteAttachment(attachment: Attachment) {
        viewModelScope.launch {
            try {
                entryRepository.deleteAttachment(entryId, attachment)
                _uiState.value = _uiState.value.copy(
                    attachments = _uiState.value.attachments.filterNot { it.id == attachment.id },
                )
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(attachmentError = e.message ?: "Couldn't delete this file — try again.")
            }
        }
    }

    /**
     * Downloads [attachment] into [destinationDir] (a cache subdir the
     * caller owns, since only the Composable/Activity layer has a Context —
     * see class kdoc) and reports the local [File] via [onResult] once
     * ready, so the caller can show a preview Dialog. [onProgress] drives a
     * per-row progress indicator while the download is in flight.
     */
    fun downloadForPreview(
        destinationDir: File,
        attachment: Attachment,
        onProgress: (Float) -> Unit,
        onResult: (Result<File>) -> Unit,
    ) {
        viewModelScope.launch {
            val result = runCatching {
                entryRepository.downloadAttachment(entryId, attachment, destinationDir, onProgress)
            }
            result.onFailure { e ->
                _uiState.value = _uiState.value.copy(attachmentError = e.message ?: "Couldn't download this file — try again.")
            }
            onResult(result)
        }
    }

    fun dismissAttachmentError() {
        _uiState.value = _uiState.value.copy(attachmentError = null)
    }

    fun updateAttachmentNote(attachment: Attachment, note: String) {
        viewModelScope.launch {
            try {
                entryRepository.updateAttachmentNote(entryId, attachment.id, note)
                _uiState.value = _uiState.value.copy(
                    attachments = _uiState.value.attachments.map {
                        if (it.id == attachment.id) it.copy(note = note) else it
                    },
                )
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(attachmentError = e.message ?: "Couldn't save this note — try again.")
            }
        }
    }

    private fun resolveFileName(context: Context, uri: Uri): String {
        val queried = runCatching {
            context.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
                if (cursor.moveToFirst()) cursor.getString(0) else null
            }
        }.getOrNull()
        return queried ?: uri.lastPathSegment ?: "file"
    }

    class Factory(private val entryId: String) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T = EntryDetailViewModel(entryId) as T
    }
}

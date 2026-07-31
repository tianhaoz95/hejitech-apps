package com.hejitech.contempo.ui.entrydetail

import android.content.Context
import android.net.Uri
import android.provider.OpenableColumns
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.hejitech.contempo.data.ServiceLocator
import com.hejitech.core.model.Attachment
import com.hejitech.core.model.Entry
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.io.File
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
    val isSavingFields: Boolean = false,
    val fieldSaveError: String? = null,
)

class EntryDetailViewModel(private val entryId: String) : ViewModel() {
    private val entryRepository = ServiceLocator.entryRepository

    private val _uiState = MutableStateFlow(EntryDetailUiState())
    val uiState: StateFlow<EntryDetailUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            val entry = runCatching { entryRepository.getEntry(entryId) }.getOrNull()
            val attachments = runCatching { entryRepository.listAttachments(entryId) }.getOrDefault(emptyList())
            _uiState.value = EntryDetailUiState(entry = entry, isLoading = false, attachments = attachments)
        }
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
            fieldSaveError = null,
        )
    }

    fun onEditPropertyChanged(value: String) { _uiState.value = _uiState.value.copy(editProperty = value) }
    fun onEditTaskChanged(value: String) { _uiState.value = _uiState.value.copy(editTask = value) }
    fun onEditDurationChanged(value: String) {
        if (value.all { it.isDigit() }) _uiState.value = _uiState.value.copy(editDurationMinutes = value)
    }

    fun cancelEditingFields() {
        _uiState.value = _uiState.value.copy(isEditingFields = false, fieldSaveError = null)
    }

    /**
     * No validation — same "save whatever's currently filled" policy as
     * ConfirmViewModel.saveForLater, just without leaving this screen. Status
     * is left untouched (confirming an entry stays an explicit action via the
     * Confirm screen's "Complete" button) — this only updates the three
     * fields, so a still-blank one keeps the entry's missingFields (computed
     * from these same fields, see Entry.missingFields) non-empty.
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

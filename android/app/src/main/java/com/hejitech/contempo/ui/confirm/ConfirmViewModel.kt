package com.hejitech.contempo.ui.confirm

import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.hejitech.contempo.data.ServiceLocator
import com.hejitech.core.model.CaptureSource
import com.hejitech.core.model.Entry
import com.hejitech.core.model.EntryCategory
import com.hejitech.core.model.EntryStatus
import com.google.firebase.Timestamp
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class ConfirmUiState(
    val property: String = "",
    val task: String = "",
    val durationMinutes: String = "",
    val category: EntryCategory = EntryCategory.OTHER,
    val isSaving: Boolean = false,
    val savedSuccessfully: Boolean = false,
    val errorMessage: String? = null,
)

class ConfirmViewModel(
    initialProperty: String,
    initialTask: String,
    initialDurationMinutes: Int,
    initialCategory: String,
    initialCaptureSource: String,
    private val photoUri: String?,
) : ViewModel() {
    private val entryRepository = ServiceLocator.entryRepository

    // Falls back to inferring MANUAL vs VOICE from whether AI text was
    // present — only relevant for captureSource values from before this
    // field existed; every live call site now passes an explicit one.
    private val captureSource: CaptureSource = CaptureSource.entries.find { it.name == initialCaptureSource }
        ?: if (initialTask.isNotBlank()) CaptureSource.VOICE else CaptureSource.MANUAL

    // Preserved so recordCorrection can diff "what the AI said" vs "what
    // the user actually confirmed" — the correction-feedback pipeline from
    // reports/mvp-scope-v0.html Section 8.
    private val aiOriginal = Triple(initialProperty, initialTask, initialDurationMinutes)

    private val _uiState = MutableStateFlow(
        ConfirmUiState(
            property = initialProperty,
            task = initialTask,
            durationMinutes = if (initialDurationMinutes > 0) initialDurationMinutes.toString() else "",
            category = EntryCategory.fromFirestoreValue(initialCategory),
        )
    )
    val uiState: StateFlow<ConfirmUiState> = _uiState.asStateFlow()

    fun onPropertyChanged(value: String) { _uiState.value = _uiState.value.copy(property = value) }
    fun onTaskChanged(value: String) { _uiState.value = _uiState.value.copy(task = value) }
    fun onDurationChanged(value: String) {
        if (value.all { it.isDigit() }) _uiState.value = _uiState.value.copy(durationMinutes = value)
    }
    fun onCategoryChanged(value: EntryCategory) { _uiState.value = _uiState.value.copy(category = value) }

    fun confirm(onSaved: () -> Unit) {
        val state = _uiState.value
        val duration = state.durationMinutes.toIntOrNull()
        if (state.property.isBlank() || state.task.isBlank() || duration == null || duration <= 0) {
            _uiState.value = state.copy(errorMessage = "Fill in property, task, and a duration greater than zero.")
            return
        }

        _uiState.value = state.copy(isSaving = true, errorMessage = null)

        viewModelScope.launch {
            try {
                val now = Timestamp.now()
                val entry = Entry(
                    propertyName = state.property,
                    task = state.task,
                    durationMinutes = duration,
                    category = state.category.firestoreValue,
                    status = EntryStatus.CONFIRMED.firestoreValue,
                    source = captureSource.firestoreValue,
                    activityDate = now, // MVP: assumes "now" — a date picker for backdating is a fast-follow UI addition
                    loggedAt = now,
                    confirmedAt = now,
                )
                val entryId = entryRepository.createEntry(entry)

                // Best-effort: a failed upload shouldn't block the entry
                // itself from saving — the audit record is the text fields,
                // the photo is supporting evidence on top of it.
                photoUri?.let { uri ->
                    runCatching { entryRepository.attachPhoto(entryId, Uri.parse(uri)) }
                }

                if (aiOriginal.second.isNotBlank() && aiOriginal.second != state.task) {
                    entryRepository.recordCorrection(entryId, "task", aiOriginal.second, state.task)
                }
                if (aiOriginal.first.isNotBlank() && aiOriginal.first != state.property) {
                    entryRepository.recordCorrection(entryId, "property", aiOriginal.first, state.property)
                }
                if (aiOriginal.third > 0 && aiOriginal.third != duration) {
                    entryRepository.recordCorrection(entryId, "durationMinutes", aiOriginal.third.toString(), duration.toString())
                }

                _uiState.value = _uiState.value.copy(isSaving = false, savedSuccessfully = true)
                onSaved()
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(isSaving = false, errorMessage = e.message ?: "Couldn't save — try again.")
            }
        }
    }

    class Factory(
        private val property: String,
        private val task: String,
        private val durationMinutes: Int,
        private val category: String,
        private val captureSource: String,
        private val photoUri: String?,
    ) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            return ConfirmViewModel(property, task, durationMinutes, category, captureSource, photoUri) as T
        }
    }
}

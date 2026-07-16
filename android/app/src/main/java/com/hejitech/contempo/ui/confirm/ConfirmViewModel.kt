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
import com.hejitech.core.model.Property
import com.google.firebase.Timestamp
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Deferred
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.launchIn
import kotlinx.coroutines.flow.onEach
import kotlinx.coroutines.launch

data class ConfirmUiState(
    val property: String = "",
    val task: String = "",
    val durationMinutes: String = "",
    val category: EntryCategory = EntryCategory.OTHER,
    val properties: List<Property> = emptyList(),
    val isAddingNewProperty: Boolean = false,
    val newPropertyName: String = "",
    val isSaving: Boolean = false,
    val isSavingForLater: Boolean = false,
    val savedSuccessfully: Boolean = false,
    val errorMessage: String? = null,
) {
    /** Drives the required-field markers and whether "Complete Later" shows. */
    val isIncomplete: Boolean
        get() = property.isBlank() || task.isBlank() || (durationMinutes.toIntOrNull() ?: 0) <= 0
}

class ConfirmViewModel(
    initialProperty: String,
    initialTask: String,
    initialDurationMinutes: Int,
    initialCategory: String,
    initialCaptureSource: String,
    private val photoUri: String?,
    private val entryId: String,
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

    // Seeded from the existing document when resuming a pending_review entry
    // (entryId non-blank) — updateEntry does a full-document overwrite, so
    // these must be carried through rather than reset, or completing a
    // pending entry would silently reset its contemporaneity anchor
    // (loggedAt) and drop any already-attached photoUrls. save() awaits this
    // rather than reading a var, so a slow lookup can never race a save that
    // fires before it resolves.
    private val existingEntryDeferred: Deferred<Entry?> = if (entryId.isNotBlank()) {
        viewModelScope.async { runCatching { entryRepository.getEntry(entryId) }.getOrNull() }
    } else {
        CompletableDeferred(null)
    }

    private val _uiState = MutableStateFlow(
        ConfirmUiState(
            property = initialProperty,
            task = initialTask,
            durationMinutes = if (initialDurationMinutes > 0) initialDurationMinutes.toString() else "",
            category = EntryCategory.fromFirestoreValue(initialCategory),
        )
    )
    val uiState: StateFlow<ConfirmUiState> = _uiState.asStateFlow()

    init {
        entryRepository.observeProperties()
            .onEach { properties -> _uiState.value = _uiState.value.copy(properties = properties) }
            .launchIn(viewModelScope)
    }

    fun onPropertyChanged(value: String) { _uiState.value = _uiState.value.copy(property = value) }
    fun onTaskChanged(value: String) { _uiState.value = _uiState.value.copy(task = value) }
    fun onDurationChanged(value: String) {
        if (value.all { it.isDigit() }) _uiState.value = _uiState.value.copy(durationMinutes = value)
    }
    fun onCategoryChanged(value: EntryCategory) { _uiState.value = _uiState.value.copy(category = value) }

    fun onPropertySelected(property: Property) {
        _uiState.value = _uiState.value.copy(property = property.name, isAddingNewProperty = false)
    }

    fun onAddNewPropertyClicked() {
        _uiState.value = _uiState.value.copy(isAddingNewProperty = true, newPropertyName = "")
    }

    fun onCancelAddNewProperty() {
        _uiState.value = _uiState.value.copy(isAddingNewProperty = false, newPropertyName = "")
    }

    fun onNewPropertyNameChanged(value: String) {
        _uiState.value = _uiState.value.copy(newPropertyName = value)
    }

    fun onConfirmNewProperty() {
        val name = _uiState.value.newPropertyName.trim()
        if (name.isEmpty()) return
        viewModelScope.launch {
            val created = runCatching { entryRepository.createProperty(name) }.getOrNull()
            _uiState.value = _uiState.value.copy(
                property = created?.name ?: name,
                isAddingNewProperty = false,
                newPropertyName = "",
            )
        }
    }

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
                save(state.copy(durationMinutes = duration.toString()), status = EntryStatus.CONFIRMED, confirmedAt = Timestamp.now())
                _uiState.value = _uiState.value.copy(isSaving = false, savedSuccessfully = true)
                onSaved()
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(isSaving = false, errorMessage = e.message ?: "Couldn't save — try again.")
            }
        }
    }

    /**
     * No validation — saves whatever's currently filled as pending_review so
     * the user can finish it later from the Dashboard's pending badge,
     * rather than being blocked mid-capture when they're in a hurry.
     */
    fun saveForLater(onSaved: () -> Unit) {
        val state = _uiState.value
        _uiState.value = state.copy(isSavingForLater = true, errorMessage = null)

        viewModelScope.launch {
            try {
                save(state, status = EntryStatus.PENDING_REVIEW, confirmedAt = null)
                _uiState.value = _uiState.value.copy(isSavingForLater = false, savedSuccessfully = true)
                onSaved()
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(isSavingForLater = false, errorMessage = e.message ?: "Couldn't save — try again.")
            }
        }
    }

    private suspend fun save(state: ConfirmUiState, status: EntryStatus, confirmedAt: Timestamp?) {
        val now = Timestamp.now()
        val duration = state.durationMinutes.toIntOrNull() ?: 0
        val existing = existingEntryDeferred.await()
        val entry = Entry(
            propertyName = state.property,
            task = state.task,
            durationMinutes = duration,
            category = state.category.firestoreValue,
            status = status.firestoreValue,
            source = captureSource.firestoreValue,
            // MVP: assumes "now" for a fresh capture — a date picker for
            // backdating is a fast-follow UI addition. Resuming a pending
            // entry preserves its original activityDate/loggedAt instead.
            activityDate = existing?.activityDate ?: now,
            loggedAt = existing?.loggedAt ?: now,
            confirmedAt = confirmedAt,
            photoUrls = existing?.photoUrls ?: emptyList(),
        )
        val savedEntryId = if (entryId.isNotBlank()) {
            entryRepository.updateEntry(entryId, entry)
            entryId
        } else {
            entryRepository.createEntry(entry)
        }

        // Best-effort: a failed upload shouldn't block the entry itself
        // from saving — the audit record is the text fields, the photo is
        // supporting evidence on top of it.
        photoUri?.let { uri ->
            runCatching { entryRepository.attachPhoto(savedEntryId, Uri.parse(uri)) }
        }

        if (aiOriginal.second.isNotBlank() && aiOriginal.second != state.task) {
            entryRepository.recordCorrection(savedEntryId, "task", aiOriginal.second, state.task)
        }
        if (aiOriginal.first.isNotBlank() && aiOriginal.first != state.property) {
            entryRepository.recordCorrection(savedEntryId, "property", aiOriginal.first, state.property)
        }
        if (aiOriginal.third > 0 && aiOriginal.third != duration) {
            entryRepository.recordCorrection(savedEntryId, "durationMinutes", aiOriginal.third.toString(), duration.toString())
        }
    }

    class Factory(
        private val property: String,
        private val task: String,
        private val durationMinutes: Int,
        private val category: String,
        private val captureSource: String,
        private val photoUri: String?,
        private val entryId: String = "",
    ) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            return ConfirmViewModel(property, task, durationMinutes, category, captureSource, photoUri, entryId) as T
        }
    }
}

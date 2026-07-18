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
import com.google.firebase.Firebase
import com.google.firebase.Timestamp
import com.google.firebase.firestore.FirebaseFirestoreException
import com.google.firebase.firestore.firestore
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Deferred
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.launchIn
import kotlinx.coroutines.flow.onEach
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withTimeout

// A stalled Firestore stream (e.g. a gRPC reconnect after the emulator/network
// drops the channel, or a real mobile-network hiccup — reproduced live on a
// real device against production Firestore, not just the emulator) leaves
// the write's Task never completing — without a bound here, isSaving/
// isSavingForLater would stay true forever with no way for the user to
// retry. Kept short (not the original 20s) so a genuine stall reads as "try
// again" quickly rather than looking hung.
private const val SAVE_TIMEOUT_MS = 10_000L

data class ConfirmUiState(
    val property: String = "",
    val task: String = "",
    val durationMinutes: String = "",
    val category: EntryCategory = EntryCategory.OTHER,
    /** Business miles driven — always optional, unlike duration, since most entries have none. */
    val miles: String = "",
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
    initialMiles: Double,
    private val photoUri: String?,
    private val entryId: String,
    private val initialCaptureLat: Double?,
    private val initialCaptureLng: Double?,
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
    private val aiOriginalMiles = initialMiles

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

    // Allocated once (locally — no network call) and reused across retries,
    // so a save that times out and gets retried always writes the same
    // document via updateEntry's set() rather than createEntry's add()
    // creating a second one if the first write actually lands late.
    private val resolvedEntryId: String = entryId.ifBlank { entryRepository.newEntryId() }

    private val _uiState = MutableStateFlow(
        ConfirmUiState(
            property = initialProperty,
            task = initialTask,
            durationMinutes = if (initialDurationMinutes > 0) initialDurationMinutes.toString() else "",
            category = EntryCategory.fromFirestoreValue(initialCategory),
            miles = if (initialMiles > 0) initialMiles.toCleanString() else "",
        )
    )
    val uiState: StateFlow<ConfirmUiState> = _uiState.asStateFlow()

    init {
        entryRepository.observeProperties()
            // See CaptureViewModel.openTripEntry's comment — same crash risk
            // here since this listener is attached unconditionally in init.
            .catch { e ->
                if (e is FirebaseFirestoreException &&
                    (e.code == FirebaseFirestoreException.Code.PERMISSION_DENIED ||
                        e.code == FirebaseFirestoreException.Code.UNAUTHENTICATED)
                ) {
                    ServiceLocator.authManager.signOut()
                }
            }
            .onEach { properties -> _uiState.value = _uiState.value.copy(properties = properties) }
            .launchIn(viewModelScope)
    }

    fun onPropertyChanged(value: String) { _uiState.value = _uiState.value.copy(property = value) }
    fun onTaskChanged(value: String) { _uiState.value = _uiState.value.copy(task = value) }
    fun onDurationChanged(value: String) {
        if (value.all { it.isDigit() }) _uiState.value = _uiState.value.copy(durationMinutes = value)
    }
    fun onCategoryChanged(value: EntryCategory) { _uiState.value = _uiState.value.copy(category = value) }
    fun onMilesChanged(value: String) {
        if (value.isEmpty() || value.matches(Regex("""\d*\.?\d*"""))) {
            _uiState.value = _uiState.value.copy(miles = value)
        }
    }

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
                withTimeout(SAVE_TIMEOUT_MS) {
                    save(state.copy(durationMinutes = duration.toString()), status = EntryStatus.CONFIRMED, confirmedAt = Timestamp.now())
                }
                _uiState.value = _uiState.value.copy(isSaving = false, savedSuccessfully = true)
                onSaved()
            } catch (e: TimeoutCancellationException) {
                resetFirestoreConnection()
                _uiState.value = _uiState.value.copy(isSaving = false, errorMessage = "Taking too long to save — check your connection and try again.")
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
                withTimeout(SAVE_TIMEOUT_MS) {
                    save(state, status = EntryStatus.PENDING_REVIEW, confirmedAt = null)
                }
                _uiState.value = _uiState.value.copy(isSavingForLater = false, savedSuccessfully = true)
                onSaved()
            } catch (e: TimeoutCancellationException) {
                resetFirestoreConnection()
                _uiState.value = _uiState.value.copy(isSavingForLater = false, errorMessage = "Taking too long to save — check your connection and try again.")
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(isSavingForLater = false, errorMessage = e.message ?: "Couldn't save — try again.")
            }
        }
    }

    /**
     * A timed-out write usually means the SDK's underlying gRPC stream is
     * stuck (observed live on a real device against production Firestore,
     * not just the emulator — see firestore_emulator_goaway memory for the
     * dev-only variant of this). withTimeout only stops *waiting* on it; the
     * stream itself stays wedged and every retry on it fails the same way.
     * Toggling the network forces Firestore to tear down and reopen its
     * connections, so the next attempt gets a fresh stream instead of
     * queueing behind the same stuck one.
     */
    private fun resetFirestoreConnection() {
        viewModelScope.launch {
            runCatching {
                Firebase.firestore.disableNetwork().await()
                Firebase.firestore.enableNetwork().await()
            }
        }
    }

    private suspend fun save(state: ConfirmUiState, status: EntryStatus, confirmedAt: Timestamp?) {
        val now = Timestamp.now()
        val duration = state.durationMinutes.toIntOrNull() ?: 0
        val miles = state.miles.toDoubleOrNull() ?: 0.0
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
            miles = miles,
            // Trip-specific fields aren't editable here (no UI for them,
            // this screen only lets the user correct the final miles
            // number) — carried forward untouched so editing/confirming a
            // trip entry (or any entry with a photo/GPS capture method)
            // doesn't silently wipe its evidence fields via updateEntry's
            // full-document overwrite, same reasoning as photoUrls above.
            isTrip = existing?.isTrip ?: false,
            mileageCaptureMethod = existing?.mileageCaptureMethod ?: "",
            odometerStart = existing?.odometerStart,
            odometerEnd = existing?.odometerEnd,
            tripStartLat = existing?.tripStartLat,
            tripStartLng = existing?.tripStartLng,
            tripEndLat = existing?.tripEndLat,
            tripEndLng = existing?.tripEndLng,
            // General "captured from here" evidence — from this capture if
            // fresh (a new voice/manual/photo entry), otherwise carried
            // forward from the existing document (same reasoning as the
            // trip fields above: don't let a resumed pending entry silently
            // lose it via updateEntry's full-document overwrite).
            captureLat = initialCaptureLat ?: existing?.captureLat,
            captureLng = initialCaptureLng ?: existing?.captureLng,
        )
        // set()-based, so re-running this after a timed-out attempt (same
        // resolvedEntryId every time) overwrites the same document instead
        // of risking a duplicate via createEntry's add().
        entryRepository.updateEntry(resolvedEntryId, entry)
        val savedEntryId = resolvedEntryId

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
        if (aiOriginalMiles > 0 && aiOriginalMiles != miles) {
            entryRepository.recordCorrection(savedEntryId, "miles", aiOriginalMiles.toString(), miles.toString())
        }
    }

    class Factory(
        private val property: String,
        private val task: String,
        private val durationMinutes: Int,
        private val category: String,
        private val captureSource: String,
        private val miles: Double,
        private val photoUri: String?,
        private val entryId: String = "",
        private val captureLat: Double? = null,
        private val captureLng: Double? = null,
    ) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            return ConfirmViewModel(
                property, task, durationMinutes, category, captureSource, miles, photoUri, entryId, captureLat, captureLng,
            ) as T
        }
    }
}

/** "12.0" reads worse than "12" in a text field the user might not even touch. */
private fun Double.toCleanString(): String =
    if (this == this.toLong().toDouble()) this.toLong().toString() else this.toString()

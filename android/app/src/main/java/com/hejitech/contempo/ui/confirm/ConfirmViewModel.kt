package com.hejitech.contempo.ui.confirm

import android.net.Uri
import androidx.core.net.toUri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.hejitech.contempo.agent.CategoryClassifier
import com.hejitech.contempo.agent.CategoryOutcome
import com.hejitech.contempo.agent.OdometerReadOutcome
import com.hejitech.contempo.agent.ParseOutcome
import com.hejitech.contempo.data.ServiceLocator
import com.hejitech.contempo.data.recoverFromAuthRaceOrSignOut
import com.hejitech.contempo.data.traced
import com.hejitech.contempo.util.PhotoUtils
import com.hejitech.core.model.CaptureSource
import com.hejitech.core.model.Category
import com.hejitech.core.model.Entry
import com.hejitech.core.model.EntryCategory
import com.hejitech.core.model.EntryFieldValidation
import com.hejitech.core.model.EntryStatus
import com.hejitech.core.model.Property
import com.hejitech.core.model.Role
import com.google.firebase.Firebase
import com.google.firebase.Timestamp
import com.google.firebase.firestore.firestore
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Deferred
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.launchIn
import kotlinx.coroutines.flow.onEach
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withTimeout
import java.util.Date

/** Higher fidelity than Confirm's small photo preview — worth it since this feeds the vision model, not just a thumbnail. */
private const val RECLASSIFY_PHOTO_MAX_DIMENSION_PX = 1024

// A stalled Firestore stream (e.g. a gRPC reconnect after the emulator/network
// drops the channel, or a real mobile-network hiccup — reproduced live on a
// real device against production Firestore, not just the emulator) leaves
// the write's Task never completing — without a bound here, isSaving/
// isSavingForLater would stay true forever with no way for the user to
// retry. Kept short (not the original 20s) so a genuine stall reads as "try
// again" quickly rather than looking hung.
private const val SAVE_TIMEOUT_MS = 10_000L

// existingEntryDeferred (below) is kicked off once, early, so its lookup has
// a head start by the time the user taps Save — but that also means a
// retry-after-timeout would otherwise re-await the exact same already-stuck
// Deferred instead of trying anything fresh. This bounds the *first* wait
// short enough that a stuck lookup still leaves real time for a fresh,
// independent fetch (see save()'s fallback) within the overall
// SAVE_TIMEOUT_MS budget.
private const val EXISTING_ENTRY_TIMEOUT_MS = 4_000L

data class ConfirmUiState(
    val property: String = "",
    val task: String = "",
    val durationMinutes: String = "",
    /**
     * A raw category value — either one of [EntryCategory]'s built-in
     * [EntryCategory.firestoreValue]s, or a free-form name from the user's
     * own `users/{uid}/categories` roster (see [Category], added in place
     * the same way [Role]s are — [onAddNewCategoryClicked]/
     * [onConfirmNewCategory] below). Not typed as [EntryCategory] itself
     * since that enum can't represent a custom value without silently
     * collapsing it to OTHER (see [EntryCategory.fromFirestoreValue]) — use
     * [EntryCategory.displayName] to render this for display.
     */
    val category: String = EntryCategory.OTHER.firestoreValue,
    /** True once the user has explicitly picked a category — stops CategoryClassifier's auto-suggestion from overriding it. */
    val categoryManuallySet: Boolean = false,
    /** See [ConfirmViewModel.detectCategory] — on-device auto-detect, available regardless of whether a category is already set (editing an existing entry always has one). */
    val isDetectingCategory: Boolean = false,
    val categoryDetectError: String? = null,
    val categories: List<Category> = emptyList(),
    val isAddingNewCategory: Boolean = false,
    val newCategoryName: String = "",
    /** Business miles driven — always optional, unlike duration, since most entries have none. */
    val miles: String = "",
    /**
     * When the work actually happened, shown/editable via the date+time
     * picker — always concrete (defaults to "now" at construction), unlike
     * the AI-sourced field it may have been seeded from. Epoch millis for
     * direct interop with Material3's DatePicker/TimePicker state.
     */
    val activityDateMillis: Long = System.currentTimeMillis(),
    val properties: List<Property> = emptyList(),
    val isAddingNewProperty: Boolean = false,
    val newPropertyName: String = "",
    val roles: List<Role> = emptyList(),
    /** null = "Me" (the owner) — the implicit default for every entry. */
    val selectedRoleId: String? = null,
    val isAddingNewRole: Boolean = false,
    val newRoleName: String = "",
    val isSaving: Boolean = false,
    val isSavingForLater: Boolean = false,
    val savedSuccessfully: Boolean = false,
    val errorMessage: String? = null,
    /**
     * Whether this photo was classified (or, after a toggle, corrected) as
     * an odometer reading rather than work evidence — see
     * CaptureViewModel.processCapturedPhoto and [onTripModeToggled]. Swaps
     * ConfirmScreen's usual work-entry fields for a single odometer-reading
     * field and routes [confirm] through [saveTrip] instead of the normal
     * entry save.
     */
    val isTripMode: Boolean = false,
    val odometerReading: String = "",
    /** True while a toggle is re-running the other AgentClient photo call against the held photo — see [onTripModeToggled]. */
    val isReclassifying: Boolean = false,
) {
    /** Which required fields are still unset — see EntryFieldValidation. */
    val missingFields: List<String>
        get() = EntryFieldValidation.missingFields(property, task, durationMinutes.toIntOrNull() ?: 0)

    /** Drives the required-field markers and whether "Complete Later" shows. */
    val isIncomplete: Boolean
        get() = missingFields.isNotEmpty()
}

class ConfirmViewModel(
    initialProperty: String,
    initialTask: String,
    initialDurationMinutes: Int,
    initialCategory: String,
    initialCaptureSource: String,
    initialMiles: Double,
    initialResolvedActivityDateIso: String?,
    private val photoUri: String?,
    private val entryId: String,
    private val initialCaptureLat: Double?,
    private val initialCaptureLng: Double?,
    initialIsTripCapture: Boolean,
    initialOdometerReading: Double?,
) : ViewModel() {
    private val entryRepository = ServiceLocator.entryRepository
    private val mileageTripCoordinator = ServiceLocator.mileageTripCoordinator
    private val agentClient = ServiceLocator.agentClient

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
    private val aiOriginalIsTripMode = initialIsTripCapture
    private val aiOriginalOdometerReading = initialOdometerReading

    // Null genuinely means "the AI proposed nothing" (no time reference in the
    // utterance) — distinct from any concrete millis value, so this can't
    // reuse the ">0 means unset" convention the other aiOriginal* fields use.
    private val aiOriginalActivityDateMillis: Long? = resolveValidatedMillis(initialResolvedActivityDateIso)

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
            category = initialCategory.ifBlank { EntryCategory.OTHER.firestoreValue },
            miles = if (initialMiles > 0) initialMiles.toCleanString() else "",
            activityDateMillis = aiOriginalActivityDateMillis ?: System.currentTimeMillis(),
            isTripMode = initialIsTripCapture,
            odometerReading = initialOdometerReading?.toCleanString() ?: "",
        )
    )
    val uiState: StateFlow<ConfirmUiState> = _uiState.asStateFlow()

    init {
        entryRepository.observeProperties()
            // See CaptureViewModel.openTripEntry's comment — same crash risk
            // here since this listener is attached unconditionally in init.
            .recoverFromAuthRaceOrSignOut { emptyList() }
            .onEach { properties -> _uiState.value = _uiState.value.copy(properties = properties) }
            .launchIn(viewModelScope)

        entryRepository.observeRoles()
            .recoverFromAuthRaceOrSignOut { emptyList() }
            .onEach { roles -> _uiState.value = _uiState.value.copy(roles = roles) }
            .launchIn(viewModelScope)

        entryRepository.observeCategories()
            .recoverFromAuthRaceOrSignOut { emptyList() }
            .onEach { categories -> _uiState.value = _uiState.value.copy(categories = categories) }
            .launchIn(viewModelScope)

        // Resuming an existing (e.g. pending) entry should reflect its
        // actual current role — a fresh entry's existingEntryDeferred
        // resolves to null almost immediately, correctly leaving
        // selectedRoleId at its "Me" default.
        viewModelScope.launch {
            existingEntryDeferred.await()?.let { existing ->
                _uiState.value = _uiState.value.copy(selectedRoleId = existing.roleId.ifEmpty { null })
            }
        }
    }

    fun onRoleSelected(roleId: String?) {
        _uiState.value = _uiState.value.copy(selectedRoleId = roleId)
    }

    fun onPropertyChanged(value: String) { _uiState.value = _uiState.value.copy(property = value) }

    /**
     * Auto-suggests a category from the task text via CategoryClassifier
     * when nothing has classified this entry yet (still OTHER, and the user
     * hasn't manually picked one) — see CategoryClassifier's kdoc for why
     * this only fills the gap for capture paths that skip the LLM (Manual
     * Entry, a manually-started timer) rather than ever overriding a real
     * LLM-inferred category.
     */
    fun onTaskChanged(value: String) {
        val state = _uiState.value
        val suggestedCategory = if (!state.categoryManuallySet && state.category == EntryCategory.OTHER.firestoreValue) {
            CategoryClassifier.classify(value)?.firestoreValue ?: state.category
        } else {
            state.category
        }
        _uiState.value = state.copy(task = value, category = suggestedCategory)
    }

    fun onDurationChanged(value: String) {
        if (value.all { it.isDigit() }) _uiState.value = _uiState.value.copy(durationMinutes = value)
    }
    fun onCategoryChanged(value: String) {
        _uiState.value = _uiState.value.copy(category = value, categoryManuallySet = true)
    }

    /**
     * On-device auto-detect for the category dropdown — deliberately
     * available regardless of what's already selected there (including when
     * editing an already-confirmed entry, which always arrives with a real
     * category, not just fresh captures) since it's a correctable
     * suggestion, not a silent commit: the result just overwrites
     * [ConfirmUiState.category] the same way [onCategoryChanged] would,
     * marking it manually set so CategoryClassifier's task-text auto-suggest
     * in [onTaskChanged] won't later stomp on it.
     */
    fun detectCategory() {
        val state = _uiState.value
        _uiState.value = state.copy(isDetectingCategory = true, categoryDetectError = null)
        viewModelScope.launch {
            when (val outcome = agentClient.suggestCategory(state.property, state.task)) {
                is CategoryOutcome.Success -> _uiState.value = _uiState.value.copy(
                    isDetectingCategory = false,
                    category = outcome.category.firestoreValue,
                    categoryManuallySet = true,
                )
                is CategoryOutcome.Failure -> _uiState.value = _uiState.value.copy(
                    isDetectingCategory = false,
                    categoryDetectError = outcome.message,
                )
            }
        }
    }
    fun onMilesChanged(value: String) {
        if (value.isEmpty() || value.matches(Regex("""\d*\.?\d*"""))) {
            _uiState.value = _uiState.value.copy(miles = value)
        }
    }
    fun onActivityDateTimeChanged(millis: Long) { _uiState.value = _uiState.value.copy(activityDateMillis = millis) }

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

    /**
     * Lets a role be created without leaving Confirm for Settings — mirrors
     * [onAddNewPropertyClicked]/[onConfirmNewProperty] above. Renaming/
     * deleting a role still only happens in Settings; this is create-only.
     */
    fun onAddNewRoleClicked() {
        _uiState.value = _uiState.value.copy(isAddingNewRole = true, newRoleName = "")
    }

    fun onCancelAddNewRole() {
        _uiState.value = _uiState.value.copy(isAddingNewRole = false, newRoleName = "")
    }

    fun onNewRoleNameChanged(value: String) {
        _uiState.value = _uiState.value.copy(newRoleName = value)
    }

    fun onConfirmNewRole() {
        val name = _uiState.value.newRoleName.trim()
        if (name.isEmpty()) return
        viewModelScope.launch {
            val created = runCatching { entryRepository.createRole(name) }.getOrNull()
            _uiState.value = _uiState.value.copy(
                selectedRoleId = created?.id ?: _uiState.value.selectedRoleId,
                isAddingNewRole = false,
                newRoleName = "",
            )
        }
    }

    /**
     * Lets a category be created without leaving Confirm — mirrors
     * [onAddNewRoleClicked]/[onConfirmNewRole] above exactly. Create-only,
     * same as roles; there's no rename/delete UI for a category roster
     * (only the "built-in" [EntryCategory] entries are more than a name,
     * and even those aren't renameable).
     */
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
                category = created?.name ?: name,
                categoryManuallySet = true,
                isAddingNewCategory = false,
                newCategoryName = "",
            )
        }
    }

    /**
     * Flips between the two photo-capture shapes when the vision model's
     * classification (see AgentClient.classifyPhotoIntent) looks wrong to
     * the user — a one-tap fix instead of forcing a retake. Re-runs the
     * *other* existing AgentClient photo method against the already-held
     * photo (no new prompt) so the just-toggled-to fields are populated,
     * not left blank.
     */
    fun onTripModeToggled(newValue: Boolean) {
        if (newValue == _uiState.value.isTripMode) return
        _uiState.value = _uiState.value.copy(isTripMode = newValue, isReclassifying = true)
        viewModelScope.launch {
            val bitmap = photoUri?.let { uri ->
                runCatching {
                    PhotoUtils.decodeSampledBitmap(ServiceLocator.appContext, uri.toUri(), RECLASSIFY_PHOTO_MAX_DIMENSION_PX)
                }.getOrNull()
            }
            if (bitmap == null) {
                // No photo to re-run against — shouldn't happen (a photo
                // capture always carries photoUri), but leave the
                // just-toggled-to fields blank/editable rather than getting stuck.
                _uiState.value = _uiState.value.copy(isReclassifying = false)
                return@launch
            }
            if (newValue) {
                when (val outcome = agentClient.readOdometerFromPhoto(bitmap)) {
                    is OdometerReadOutcome.Success ->
                        _uiState.value = _uiState.value.copy(odometerReading = outcome.miles.toCleanString(), isReclassifying = false)
                    is OdometerReadOutcome.Failure ->
                        _uiState.value = _uiState.value.copy(isReclassifying = false)
                }
            } else {
                val knownProperties = runCatching {
                    entryRepository.observeProperties().first().map { it.name }
                }.getOrDefault(emptyList())
                when (val outcome = agentClient.draftEntryFromPhoto(bitmap, knownProperties)) {
                    is ParseOutcome.Success -> {
                        val draft = outcome.result.draft
                        _uiState.value = _uiState.value.copy(
                            property = draft.property.orEmpty(),
                            task = draft.task.orEmpty(),
                            durationMinutes = draft.durationMinutes?.takeIf { it > 0 }?.toString() ?: "",
                            category = draft.category ?: EntryCategory.OTHER.firestoreValue,
                            isReclassifying = false,
                        )
                    }
                    is ParseOutcome.Failure -> _uiState.value = _uiState.value.copy(isReclassifying = false)
                }
            }
        }
    }

    fun onOdometerReadingChanged(value: String) {
        if (value.isEmpty() || value.matches(Regex("""\d*\.?\d*"""))) {
            _uiState.value = _uiState.value.copy(odometerReading = value)
        }
    }

    fun confirm(onSaved: () -> Unit) {
        val state = _uiState.value
        if (state.isTripMode) {
            val reading = state.odometerReading.toDoubleOrNull()
            if (reading == null || reading <= 0) {
                _uiState.value = state.copy(errorMessage = "Enter the odometer reading before continuing.")
                return
            }
            _uiState.value = state.copy(isSaving = true, errorMessage = null)
            viewModelScope.launch {
                try {
                    withSaveRetry { saveTrip(reading) }
                    _uiState.value = _uiState.value.copy(isSaving = false, savedSuccessfully = true)
                    onSaved()
                } catch (e: TimeoutCancellationException) {
                    resetFirestoreConnection()
                    _uiState.value = _uiState.value.copy(isSaving = false, errorMessage = "Taking too long to save — check your connection and try again.")
                } catch (e: Exception) {
                    _uiState.value = _uiState.value.copy(isSaving = false, errorMessage = e.message ?: "Couldn't save — try again.")
                }
            }
            return
        }

        val duration = state.durationMinutes.toIntOrNull()
        if (state.property.isBlank() || state.task.isBlank() || duration == null || duration <= 0) {
            _uiState.value = state.copy(errorMessage = "Fill in property, task, and a duration greater than zero.")
            return
        }

        _uiState.value = state.copy(isSaving = true, errorMessage = null)

        viewModelScope.launch {
            try {
                withSaveRetry {
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
                withSaveRetry {
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
     * queueing behind the same stuck one. A real suspend fun (not fire-
     * and-forget) so [withSaveRetry] can retry immediately after this
     * actually completes, instead of racing it.
     */
    private suspend fun resetFirestoreConnection() {
        runCatching {
            Firebase.firestore.disableNetwork().await()
            Firebase.firestore.enableNetwork().await()
        }
    }

    /**
     * One bounded auto-retry after a stuck-stream timeout —
     * resetFirestoreConnection exists specifically to make the *next*
     * attempt succeed, so retrying once here recovers from the common
     * one-off stall transparently instead of always pushing that retry onto
     * the user via a re-tap of Confirm (reported live: a user hit exactly
     * this — a save that timed out and never got retried, so the entry was
     * simply never saved). A second timeout still propagates to the
     * caller's own catch, so a genuinely persistent failure surfaces the
     * same "try again" messaging as before — this only removes the silent,
     * avoidable failure for the common transient case.
     */
    private suspend fun <T> withSaveRetry(block: suspend () -> T): T =
        try {
            withTimeout(SAVE_TIMEOUT_MS) { block() }
        } catch (e: TimeoutCancellationException) {
            resetFirestoreConnection()
            withTimeout(SAVE_TIMEOUT_MS) { block() }
        }

    /**
     * Validates the model's resolved-time guess: unparsable -> null (caller
     * falls back to now), future-relative-to-device-now -> clamp to now (work
     * can't happen in the future). Deliberately no arbitrary "reasonable
     * window" beyond that — trust the LLM's resolution given it was handed
     * current time as context, rather than hand-coding what's plausible.
     */
    private fun resolveValidatedMillis(iso: String?): Long? {
        val instant = iso?.let { runCatching { java.time.Instant.parse(it) }.getOrNull() } ?: return null
        val now = java.time.Instant.now()
        return if (instant.isAfter(now)) now.toEpochMilli() else instant.toEpochMilli()
    }

    private suspend fun save(state: ConfirmUiState, status: EntryStatus, confirmedAt: Timestamp?) {
        val now = Timestamp.now()
        val duration = state.durationMinutes.toIntOrNull() ?: 0
        val miles = state.miles.toDoubleOrNull() ?: 0.0
        // Root-caused live: a plain DocumentReference.get() (what backs
        // existingEntryDeferred) can hang indefinitely on some devices,
        // while listener-based reads on the same connection keep working
        // fine — this isn't the write path at all, and a save() retry was
        // previously re-awaiting this exact same stuck Deferred forever
        // instead of trying anything fresh. Bound the wait, then fall back
        // to one independent, freshly-issued fetch rather than silently
        // giving up on it — losing this lookup would overwrite an existing
        // pending entry's photoUrls/audioUrl/trip fields with blanks (see
        // the Entry construction below), so it's worth one real retry
        // before accepting that risk.
        val existing = try {
            withTimeout(EXISTING_ENTRY_TIMEOUT_MS) { existingEntryDeferred.await() }
        } catch (e: TimeoutCancellationException) {
            if (entryId.isBlank()) {
                null
            } else {
                runCatching { withTimeout(EXISTING_ENTRY_TIMEOUT_MS) { entryRepository.getEntry(entryId) } }.getOrNull()
            }
        }
        val entry = Entry(
            propertyName = state.property,
            task = state.task,
            durationMinutes = duration,
            category = state.category,
            status = status.firestoreValue,
            source = captureSource.firestoreValue,
            // Resuming a pending entry preserves its original
            // activityDate/loggedAt; a fresh capture uses whatever the user
            // confirmed in the date+time picker (seeded from the AI's
            // resolved-time guess, or "now" if it resolved nothing).
            activityDate = existing?.activityDate ?: Timestamp(Date(state.activityDateMillis)),
            loggedAt = existing?.loggedAt ?: now,
            confirmedAt = confirmedAt,
            photoUrls = existing?.photoUrls ?: emptyList(),
            // No UI here to edit this — carried forward untouched so
            // confirming/editing a voice-captured pending entry doesn't
            // silently wipe it via this full-document overwrite, same
            // reasoning as photoUrls above.
            audioUrl = existing?.audioUrl ?: "",
            rawTranscript = existing?.rawTranscript ?: "",
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
            roleId = state.selectedRoleId ?: "",
            roleName = state.roles.find { it.id == state.selectedRoleId }?.name ?: "",
        )
        // set()-based, so re-running this after a timed-out attempt (same
        // resolvedEntryId every time) overwrites the same document instead
        // of risking a duplicate via createEntry's add(). Traced by itself
        // (not the whole save() call, which also does local Entry
        // construction and the best-effort photo upload below) since this
        // write is the exact operation SAVE_TIMEOUT_MS/
        // resetFirestoreConnection exist for — the known-flaky one worth
        // isolated visibility into.
        traced("entry_save", mapOf("status" to status.name)) {
            entryRepository.updateEntry(resolvedEntryId, entry)
        }
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
        if (aiOriginalActivityDateMillis != null && aiOriginalActivityDateMillis != state.activityDateMillis) {
            entryRepository.recordCorrection(
                savedEntryId,
                "activityDate",
                java.time.Instant.ofEpochMilli(aiOriginalActivityDateMillis).toString(),
                java.time.Instant.ofEpochMilli(state.activityDateMillis).toString(),
            )
        }
    }

    /**
     * Saves a photo-classified trip start/end — see [confirm]'s isTripMode
     * branch. Re-derives open/close authoritatively at save time via
     * findOpenEntry (not any state captured back when Confirm first opened,
     * which may now be stale), same reasoning as the old
     * CaptureViewModel.logOdometerPhoto had. handleStartTrip is safe to call
     * even if a trip unexpectedly turns out to already be open — it
     * auto-abandons the previous one rather than erroring.
     */
    private suspend fun saveTrip(reading: Double) {
        val openTrip = entryRepository.findOpenEntry(isTrip = true)
        val savedEntryId = if (openTrip == null) {
            mileageTripCoordinator.handleStartTrip(
                property = null,
                task = null,
                category = null,
                source = captureSource,
                startedAt = Timestamp.now(),
                captureMethod = "photo",
                odometerStart = reading,
            ).entryId
        } else {
            (
                mileageTripCoordinator.handleEndTrip(
                    endedAt = Timestamp.now(),
                    captureMethod = "photo",
                    odometerEnd = reading,
                ) ?: throw IllegalStateException("Couldn't close the trip — try again.")
                ).entryId
        }

        // Best-effort, same reasoning as the work-entry save() below — the
        // audit record is the odometer reading itself, the photo is
        // supporting evidence on top of it.
        photoUri?.let { uri ->
            runCatching { entryRepository.attachPhoto(savedEntryId, Uri.parse(uri)) }
        }

        if (aiOriginalOdometerReading != null && aiOriginalOdometerReading != reading) {
            entryRepository.recordCorrection(savedEntryId, "odometerReading", aiOriginalOdometerReading.toString(), reading.toString())
        }
        if (aiOriginalIsTripMode != _uiState.value.isTripMode) {
            entryRepository.recordCorrection(
                savedEntryId,
                "photoIntent",
                if (aiOriginalIsTripMode) "odometer" else "work",
                if (_uiState.value.isTripMode) "odometer" else "work",
            )
        }
    }

    class Factory(
        private val property: String,
        private val task: String,
        private val durationMinutes: Int,
        private val category: String,
        private val captureSource: String,
        private val miles: Double,
        private val resolvedActivityDateIso: String?,
        private val photoUri: String?,
        private val entryId: String = "",
        private val captureLat: Double? = null,
        private val captureLng: Double? = null,
        private val isTripCapture: Boolean = false,
        private val odometerReading: Double? = null,
    ) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            return ConfirmViewModel(
                property, task, durationMinutes, category, captureSource, miles, resolvedActivityDateIso,
                photoUri, entryId, captureLat, captureLng, isTripCapture, odometerReading,
            ) as T
        }
    }
}

/** "12.0" reads worse than "12" in a text field the user might not even touch. */
private fun Double.toCleanString(): String =
    if (this == this.toLong().toDouble()) this.toLong().toString() else this.toString()

package com.hejitech.contempo.ui.capture

import android.Manifest
import android.content.pm.PackageManager
import android.graphics.Bitmap
import androidx.core.content.ContextCompat
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.OutOfQuotaPolicy
import androidx.work.WorkManager
import com.hejitech.contempo.agent.AiAvailability
import com.hejitech.contempo.agent.CaptureResult
import com.hejitech.contempo.agent.EntryDraft
import com.hejitech.contempo.agent.OdometerReadOutcome
import com.hejitech.contempo.agent.ParseOutcome
import com.hejitech.contempo.agent.ParseSource
import com.hejitech.contempo.agent.PhotoIntent
import com.hejitech.contempo.agent.PhotoIntentOutcome
import com.hejitech.contempo.agent.ParsingStage
import com.hejitech.contempo.agent.TimerIntent
import com.hejitech.contempo.agent.TimerIntentClassifier
import com.hejitech.contempo.agent.TripIntent
import com.hejitech.contempo.agent.TripIntentClassifier
import com.hejitech.contempo.agent.WhisperTranscriber
import com.hejitech.contempo.agent.aiAvailability
import com.hejitech.contempo.capture.PendingCaptureSyncWorker
import com.hejitech.contempo.data.ServiceLocator
import com.hejitech.contempo.data.recoverFromAuthRaceOrSignOut
import com.hejitech.contempo.mileage.MileageTrackingService
import com.hejitech.contempo.timer.OngoingWorkNotificationService
import com.hejitech.contempo.wear.AudioCaptureProcessor
import com.hejitech.contempo.wear.AudioProcessingStage
import com.hejitech.contempo.wear.PendingAudioProcessWorker
import com.hejitech.core.audio.WavAudio
import com.hejitech.core.model.CaptureLanguage
import com.hejitech.core.model.CaptureSource
import com.hejitech.core.model.Entry
import com.hejitech.core.model.EntryStatus
import com.hejitech.core.model.MaterialParticipationTest
import com.google.android.gms.location.LocationServices
import com.hejitech.core.model.Timestamp
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.launchIn
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.onEach
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withTimeoutOrNull

/**
 * Quick Capture's status summary for today, shown on the Capture tab (see
 * CaptureScreen's QuickCaptureStatusRow) — combines the phone's own
 * not-yet-uploaded local queue (PendingCaptureStore), the shared Firestore
 * audioCaptures queue (uploaded but not yet processed — populated by both
 * this phone's Quick Capture and any paired watch), and the live processing
 * stage (at most one item at a time — see AudioCaptureProcessor). All three
 * counts are scoped to today only, matching the feature's actual value
 * proposition ("did today's quick notes make it in"), not a running total
 * that could include stale backlog from days ago.
 */
data class QuickCaptureStatusUiState(
    val pendingCount: Int = 0,
    val processingStage: AudioProcessingStage? = null,
    val completedTodayCount: Int = 0,
) {
    val hasAnything: Boolean get() = pendingCount > 0 || processingStage != null || completedTodayCount > 0
}

private fun isToday(timestamp: Timestamp): Boolean =
    Instant.ofEpochSecond(timestamp.seconds, timestamp.nanoseconds.toLong())
        .atZone(ZoneId.systemDefault())
        .toLocalDate() == LocalDate.now()

data class CaptureUiState(
    val inputText: String = "",
    val isRecording: Boolean = false,
    val isTranscribing: Boolean = false,
    val isParsing: Boolean = false,
    // Covers the whole classify -> dispatch sequence for a just-taken photo
    // (see processCapturedPhoto) — one busy state for one camera launch,
    // regardless of which of the two downstream paths (odometer/work) the
    // classifier picks.
    val isProcessingPhoto: Boolean = false,
    val errorMessage: String? = null,
    val aiAvailability: AiAvailability = AiAvailability.Ready,
    // Set when photo drafting fails, so the photo is still attached as
    // evidence if the user falls back to typing/voice or manual entry —
    // see parseAndProceed's captureSource override and manualEntry().
    val pendingPhotoUri: String? = null,
    // Transient "here's what we heard" beat shown right after a voice
    // capture finishes transcribing/cleanup, before parsing starts.
    val finalizedTranscript: String? = null,
    val parsingStage: ParsingStage = ParsingStage.IDLE,
    // Transient "started/stopped tracking" confirmation shown after a
    // start/stop timer utterance, or a voice-triggered GPS trip start/stop
    // (see parseAndProceed/handleTimerEvent) — these write straight to
    // Firestore and skip Confirm entirely, so this is the only feedback the
    // user gets. Photo-based capture no longer uses this (see
    // processCapturedPhoto) — it always resolves to Confirm instead.
    val timerMessage: String? = null,
    val tripMessage: String? = null,
    // Persisted (see QuickCaptureSettingsStore), app-level from Settings —
    // when on, stopping a recording skips transcribe/parse/Confirm entirely:
    // audio + location + time are saved and queued for later background
    // processing, and the screen returns to idle immediately. See
    // stopQuickCaptureAndSave. No UI control for this on Capture itself
    // anymore (see SettingsScreen) — simplifying the capture screen was the
    // whole point of making this app-level instead of per-capture.
    val quickCaptureEnabled: Boolean = false,
    // Persisted (see CaptureLanguageStore), app-level from Settings — which
    // Whisper checkpoint the next recording uses. Read at the moment
    // recording stops (both the live path and Quick Capture's
    // save-for-later path), not re-read later, so switching this before the
    // *next* capture never changes how an already-recorded one gets
    // transcribed. No UI control for this on Capture itself anymore (see
    // SettingsScreen), same reasoning as quickCaptureEnabled above.
    val captureLanguage: CaptureLanguage = CaptureLanguage.AUTO,
)

/** See CaptureViewModel.hoursProgress's kdoc. */
data class CaptureHoursProgress(
    val confirmedHours: Double = 0.0,
    val thresholdHours: Int = MaterialParticipationTest.THRESHOLD_HOURS,
) {
    val fraction: Float get() = (confirmedHours / thresholdHours).toFloat().coerceIn(0f, 1f)
}

/** Best-effort only — never worth delaying a capture over. */
private const val LOCATION_TIMEOUT_MS = 1_500L

class CaptureViewModel : ViewModel() {
    private val agentClient = ServiceLocator.agentClient
    private val entryRepository = ServiceLocator.entryRepository
    private val aiSettingsStore = ServiceLocator.aiSettingsStore
    private val onDeviceLlm = ServiceLocator.onDeviceLlm
    private val audioRecorder = ServiceLocator.audioRecorder
    private val whisperTranscriber = ServiceLocator.whisperTranscriber
    private val timerEntryCoordinator = ServiceLocator.timerEntryCoordinator
    private val mileageTripCoordinator = ServiceLocator.mileageTripCoordinator
    private val quickCaptureSettingsStore = ServiceLocator.quickCaptureSettingsStore
    private val captureLanguageStore = ServiceLocator.captureLanguageStore
    private val captureModeStore = ServiceLocator.captureModeStore

    // Set by parseAndProceed's holdForManualConfirm branch (voice path only)
    // once parsing succeeds, and released by confirmTranscript on the user's
    // tap — see stopRecordingAndProcess/confirmTranscript.
    private var pendingVoiceResult: CaptureResult? = null

    val recordingAmplitude = audioRecorder.amplitude

    private val _uiState = MutableStateFlow(CaptureUiState())
    val uiState: StateFlow<CaptureUiState> = combine(
        _uiState,
        aiSettingsStore.preference,
        onDeviceLlm.status,
        quickCaptureSettingsStore.enabled,
        captureLanguageStore.selected,
    ) { state, preference, modelStatus, quickCaptureEnabled, captureLanguage ->
        state.copy(
            aiAvailability = aiAvailability(preference, modelStatus),
            quickCaptureEnabled = quickCaptureEnabled,
            captureLanguage = captureLanguage,
        )
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), CaptureUiState())

    // Live open mileage trip, if any — drives the odometer-photo/GPS trip
    // button's label. Deliberately its own StateFlow rather than a
    // CaptureUiState field: several flows above reset _uiState wholesale
    // (`_uiState.value = CaptureUiState()`) after a normal capture, which
    // would wrongly blank this until the next real Firestore change if it
    // lived there — a work timer and a trip can both be open at once (see
    // MileageTripCoordinator), so this has to survive those resets.
    val openTripEntry: StateFlow<Entry?> = entryRepository.observeEntries()
        .map { entries -> entries.find { it.inProgress && it.isTrip } }
        // A stale/invalid session (e.g. a corrupted local auth cache) makes
        // Firestore reject this listener with PERMISSION_DENIED, which
        // otherwise propagates as an uncaught exception in viewModelScope
        // and crashes the whole app. See recoverFromAuthRaceOrSignOut's kdoc
        // for why this retries once before signing out — a genuinely stale
        // session still degrades to "no open trip" the same as before.
        .recoverFromAuthRaceOrSignOut { null }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), null)

    /**
     * Live open work timer, if any — mirrors [openTripEntry] above (same
     * "own StateFlow so a wholesale _uiState reset can't blank it" reasoning)
     * so the Capture tab can show "work in progress, tap to complete" and
     * let a tap finish the entry without requiring the user to say "stop."
     */
    val openTimerEntry: StateFlow<Entry?> = entryRepository.observeEntries()
        .map { entries -> entries.find { it.inProgress && !it.isTrip } }
        .recoverFromAuthRaceOrSignOut { null }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), null)

    /**
     * Confirmed hours + fraction toward [MaterialParticipationTest.THRESHOLD_HOURS],
     * for the animated title on CaptureScreen (see TitleWordmark — both the
     * fill sweep and the "X / 100 hrs" caption read off this). Same
     * confirmed-hours math as DashboardViewModel's `confirmedHours` —
     * owner-only (see [Entry.isOwnerHours]) confirmed minutes summed —
     * duplicated rather than shared from there since DashboardViewModel is
     * screen-scoped, not an app-wide singleton (matches the wear
     * complication and iOS widgets, which independently recompute the same
     * figure for the same reason — see their kdocs).
     */
    val hoursProgress: StateFlow<CaptureHoursProgress> = entryRepository.observeEntries()
        .map { entries ->
            val confirmedMinutes = entries
                .filter { it.statusEnum == EntryStatus.CONFIRMED && it.isOwnerHours }
                .sumOf { it.durationMinutes }
            CaptureHoursProgress(confirmedHours = confirmedMinutes / 60.0)
        }
        .recoverFromAuthRaceOrSignOut { CaptureHoursProgress() }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), CaptureHoursProgress())

    // The current *session's* capture mode (Audio-first vs. Typing) — live-
    // follows captureModeStore's persisted default (so changing it in
    // Settings takes effect immediately, no app restart needed) until the
    // user manually toggles mode via setCaptureMode below, at which point
    // this session's choice takes over and stops following the store for
    // the rest of the session — see setCaptureMode. Deliberately its own
    // StateFlow rather than a CaptureUiState field, same as openTripEntry/
    // openTimerEntry above, so the wholesale `_uiState.value =
    // CaptureUiState()` resets scattered through this class
    // (confirmTranscript, manualEntry, handleWorkPhoto, handleTimerStart,
    // etc.) can't silently snap it back to the default the moment the user
    // submits anything. setCaptureMode never calls
    // captureModeStore.setDefaultMode — only Settings is allowed to change
    // the persisted default (see CaptureModeStore's kdoc).
    private var captureModeManuallyOverridden = false
    private val _captureMode = MutableStateFlow(captureModeStore.defaultMode.value)
    val captureMode: StateFlow<CaptureMode> = _captureMode.asStateFlow()

    /**
     * Left-to-right order for [CaptureModeToggle] — the user's chosen
     * default leads. Live-follows the store the same way [captureMode]
     * does above (and freezes at the same point, once the user manually
     * toggles), rather than continuously reordering on every
     * [setCaptureMode] call — reordering the control while the user is
     * actively tapping it would move it out from under their thumb.
     */
    private val _captureModeOrder = MutableStateFlow(captureModeOrderFor(captureModeStore.defaultMode.value))
    val captureModeOrder: StateFlow<List<CaptureMode>> = _captureModeOrder.asStateFlow()

    init {
        captureModeStore.defaultMode
            .onEach { default ->
                if (!captureModeManuallyOverridden) {
                    _captureMode.value = default
                    _captureModeOrder.value = captureModeOrderFor(default)
                }
            }
            .launchIn(viewModelScope)
    }

    fun setCaptureMode(mode: CaptureMode) {
        captureModeManuallyOverridden = true
        _captureMode.value = mode
    }

    private fun captureModeOrderFor(default: CaptureMode): List<CaptureMode> =
        listOf(default) + CaptureMode.entries.filter { it != default }

    /** See QuickCaptureStatusUiState's kdoc. */
    val quickCaptureStatus: StateFlow<QuickCaptureStatusUiState> = combine(
        ServiceLocator.pendingCaptureStore.pendingTodayCount,
        ServiceLocator.audioCaptureQueue.observePending(),
        ServiceLocator.textCaptureQueue.observePending(),
        AudioCaptureProcessor.currentlyProcessing,
        ServiceLocator.quickCaptureStatsStore.completedToday,
    ) { localPendingToday, queuedCaptures, queuedTextCaptures, processingStage, completedToday ->
        val queuedTodayCount = queuedCaptures.count { isToday(it.capturedAt) } +
            queuedTextCaptures.count { isToday(it.capturedAt) }
        // The one item currently being processed (if any) is still present
        // in queuedCaptures until it's fully done — subtract it out of
        // "pending" so it isn't counted in both buckets at once.
        val activeOffset = if (processingStage != null) 1 else 0
        QuickCaptureStatusUiState(
            pendingCount = (localPendingToday + queuedTodayCount - activeOffset).coerceAtLeast(0),
            processingStage = processingStage,
            completedTodayCount = completedToday,
        )
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), QuickCaptureStatusUiState())

    fun onInputChanged(text: String) {
        _uiState.value = _uiState.value.copy(inputText = text, errorMessage = null)
    }

    fun hasRecordAudioPermission(): Boolean = audioRecorder.hasPermission()

    /**
     * Manual "process now" for the QuickCaptureStatusRow's sync button —
     * otherwise the backlog only drains on app foreground (MainActivity's
     * resumed-loop) or the 15-minute PendingAudioProcessWorker schedule (see
     * ContempoApp), which can leave a host staring at "3 waiting" with no way
     * to make it happen sooner. Expedited one-time request, same pattern as
     * enqueueExpeditedPendingCaptureUpload() below — this only *enqueues* the
     * work; quickCaptureStatus's processingStage reflects when it actually runs.
     */
    fun processQuickCaptureBacklogNow() {
        val request = OneTimeWorkRequestBuilder<PendingAudioProcessWorker>()
            .setExpedited(OutOfQuotaPolicy.RUN_AS_NON_EXPEDITED_WORK_REQUEST)
            .build()
        WorkManager.getInstance(ServiceLocator.appContext)
            .enqueueUniqueWork("pending-audio-process-now", ExistingWorkPolicy.APPEND_OR_REPLACE, request)
    }

    fun startRecording() {
        if (_uiState.value.isRecording || !audioRecorder.hasPermission()) return
        _uiState.value = _uiState.value.copy(isRecording = true, errorMessage = null)
        audioRecorder.start(viewModelScope)
    }

    /**
     * Quick Capture: stop -> WAV-encode -> save locally -> done. Deliberately
     * skips transcribe/parse/Confirm and shows nothing beyond the mic
     * returning to idle — the point is that the user can walk away the
     * instant they stop talking, with the actual Whisper transcription and
     * parsing happening later in the background (see
     * app/wear/AudioCaptureProcessor.kt, which already drains this same
     * queue for the watch's captures — this reuses that exact pipeline). A
     * one-time expedited WorkManager request kicks the Storage upload off
     * right away; capture/PendingCaptureSyncWorker's periodic job is the
     * fallback for whenever this phone has no connectivity at record time.
     */
    fun stopQuickCaptureAndSave() {
        if (!_uiState.value.isRecording) return
        // Captured now, not re-read later — see CaptureUiState.captureLanguage's
        // kdoc on why this travels with the specific recording.
        val language = _uiState.value.captureLanguage
        _uiState.value = _uiState.value.copy(isRecording = false)

        viewModelScope.launch {
            val samples = audioRecorder.stop()
            if (samples.isEmpty()) return@launch
            val wav = WavAudio.encode(samples, WhisperTranscriber.SAMPLE_RATE_HZ)
            val location = captureLocation()
            ServiceLocator.pendingCaptureStore.save(wav, location?.first, location?.second, language)
            enqueueExpeditedPendingCaptureUpload()
        }
    }

    private fun enqueueExpeditedPendingCaptureUpload() {
        val request = OneTimeWorkRequestBuilder<PendingCaptureSyncWorker>()
            .setExpedited(OutOfQuotaPolicy.RUN_AS_NON_EXPEDITED_WORK_REQUEST)
            .build()
        WorkManager.getInstance(ServiceLocator.appContext)
            .enqueueUniqueWork("pending-capture-upload-now", ExistingWorkPolicy.APPEND_OR_REPLACE, request)
    }

    /**
     * Stop -> on-device Whisper transcribe -> straight into parseAndProceed
     * (its prompt itself strips filler words/dictation errors and extracts
     * the structured draft — see AgentClient.buildEntryPrompt), but holds the
     * result rather than handing it to onDraftReady: the cleaned-up task text
     * is shown on the "here's what we heard" card for the user to check, and
     * only a manual tap (see confirmTranscript) actually proceeds to Confirm.
     */
    fun stopRecordingAndProcess(onDraftReady: (CaptureResult) -> Unit) {
        if (!_uiState.value.isRecording) return
        val language = _uiState.value.captureLanguage
        _uiState.value = _uiState.value.copy(isRecording = false, isTranscribing = true)

        viewModelScope.launch {
            val samples = audioRecorder.stop()
            val rawTranscript = runCatching { whisperTranscriber.transcribe(samples, language) }.getOrDefault("")

            if (rawTranscript.isBlank()) {
                _uiState.value = _uiState.value.copy(
                    isTranscribing = false,
                    errorMessage = "Didn't catch that — try again.",
                )
                return@launch
            }

            _uiState.value = _uiState.value.copy(inputText = rawTranscript, isTranscribing = false)
            parseAndProceed(rawTranscript, CaptureSource.VOICE, onDraftReady, holdForManualConfirm = true)
        }
    }

    /**
     * The manual "looks right, continue" step after stopRecordingAndProcess
     * — tapping the finalized-transcript card releases the already-parsed
     * result to onDraftReady (navigating to Confirm); nothing after
     * transcription happens automatically.
     */
    fun confirmTranscript(onDraftReady: (CaptureResult) -> Unit) {
        val result = pendingVoiceResult ?: return
        pendingVoiceResult = null
        _uiState.value = CaptureUiState()
        onDraftReady(result)
    }

    /**
     * Capture is fast, not a conversation: any successful parse — even one
     * with several fields left null — proceeds straight to the Confirm
     * screen. The user fills gaps there, on their own time, instead of
     * being blocked by a clarifying question mid-capture.
     */
    fun submit(onDraftReady: (CaptureResult) -> Unit) {
        val text = _uiState.value.inputText.trim()
        if (text.isEmpty() || uiState.value.aiAvailability != AiAvailability.Ready) return
        if (_uiState.value.quickCaptureEnabled) {
            stopQuickCaptureAndSaveText(text)
            return
        }
        viewModelScope.launch { parseAndProceed(text, CaptureSource.TEXT, onDraftReady) }
    }

    /**
     * Quick Capture's typed-text counterpart to stopQuickCaptureAndSave —
     * same "save now, parse later in the background" treatment: the raw
     * text + location are queued immediately (see TextCaptureQueue) and the
     * input clears right away, with no navigation to Confirm — there's no
     * draft to confirm yet. Unlike audio there's no Storage upload stage in
     * the way, so the background parse is kicked off directly rather than
     * via a WorkManager request (it'll also get picked up by the periodic
     * PendingAudioProcessWorker/manual "process now" button either way, as
     * a fallback if this direct attempt doesn't finish, e.g. the app gets
     * backgrounded mid-parse).
     */
    private fun stopQuickCaptureAndSaveText(text: String) {
        _uiState.value = _uiState.value.copy(inputText = "", errorMessage = null)
        viewModelScope.launch {
            val location = captureLocation()
            ServiceLocator.textCaptureQueue.enqueue(text, Timestamp.now(), location?.first, location?.second)
            AudioCaptureProcessor.processPendingTextCaptures()
        }
    }

    /**
     * A just-taken photo — the single entry point for both photo-capture
     * paths. Classifies the photo (see AgentClient.classifyPhotoIntent) and
     * dispatches to whichever of the two existing, unchanged AgentClient
     * methods applies, so the host no longer has to pick "Photo" vs.
     * "Odometer" before taking the picture. Unlike text/voice this doesn't
     * check aiAvailability up front — each downstream call already produces
     * an honest per-preference failure message on its own, and the photo is
     * still worth keeping as evidence even when understanding isn't
     * available.
     */
    fun processCapturedPhoto(bitmap: Bitmap, photoUri: String, onDraftReady: (CaptureResult) -> Unit) {
        _uiState.value = _uiState.value.copy(
            isProcessingPhoto = true,
            errorMessage = null,
            pendingPhotoUri = photoUri,
        )

        viewModelScope.launch {
            when (val outcome = agentClient.classifyPhotoIntent(bitmap)) {
                is PhotoIntentOutcome.Success -> when (outcome.intent) {
                    PhotoIntent.ODOMETER -> handleOdometerPhoto(bitmap, photoUri, onDraftReady)
                    PhotoIntent.WORK -> handleWorkPhoto(bitmap, photoUri, onDraftReady)
                }
                // Classification itself failed (model unavailable/unclear) —
                // fall back to the general work-entry draft path rather than
                // stranding the user; that path already has a robust
                // "couldn't draft, still attached as evidence, fill in
                // manually" story.
                is PhotoIntentOutcome.Failure -> handleWorkPhoto(bitmap, photoUri, onDraftReady)
            }
        }
    }

    private suspend fun handleWorkPhoto(bitmap: Bitmap, photoUri: String, onDraftReady: (CaptureResult) -> Unit) {
        val knownProperties = runCatching {
            entryRepository.observeProperties().first().map { it.name }
        }.getOrDefault(emptyList())

        when (val outcome = agentClient.draftEntryFromPhoto(bitmap, knownProperties)) {
            is ParseOutcome.Success -> {
                val draft = outcome.result.draft
                val source = if (outcome.result.source == ParseSource.ON_DEVICE) "on_device" else "cloud"
                val location = captureLocation()
                _uiState.value = CaptureUiState()
                onDraftReady(CaptureResult(draft, source, CaptureSource.PHOTO, photoUri, location?.first, location?.second))
            }
            is ParseOutcome.Failure -> {
                // pendingPhotoUri (set by processCapturedPhoto) stays, so the
                // photo is still attached as evidence if the user falls back
                // to typing/voice (see parseAndProceed) or manual entry.
                _uiState.value = _uiState.value.copy(
                    isProcessingPhoto = false,
                    errorMessage = outcome.message,
                )
            }
        }
    }

    /**
     * A photo classified as an odometer reading. Unlike the old
     * logOdometerPhoto, this never writes to Firestore directly — it always
     * routes to Confirm (in trip mode) so a wrong classification is
     * correctable there instead of a silent hard commit. Start vs. end is
     * still auto-detected the same way as before: no open trip -> this
     * reading is the start; one already open -> this reading closes it.
     * Checks findOpenEntry directly (authoritative) rather than the cached
     * openTripEntry StateFlow, so a stale snapshot can't misclassify which
     * side of the trip this photo is on — Confirm's saveTrip() re-derives
     * this again at save time regardless, since time may have passed while
     * the user was reviewing.
     */
    private suspend fun handleOdometerPhoto(bitmap: Bitmap, photoUri: String, onDraftReady: (CaptureResult) -> Unit) {
        val openTrip = entryRepository.findOpenEntry(isTrip = true)
        val readOutcome = agentClient.readOdometerFromPhoto(bitmap)
        val reading = (readOutcome as? OdometerReadOutcome.Success)?.miles
        // OCR failing doesn't dead-end here (unlike the old direct-write
        // path's error toast) — the classifier still said "odometer," so
        // Confirm opens in trip mode with a blank, manually-fillable reading.
        val location = captureLocation()
        _uiState.value = CaptureUiState()
        onDraftReady(
            CaptureResult(
                draft = EntryDraft(),
                parseSource = "on_device",
                captureSource = CaptureSource.PHOTO,
                photoUri = photoUri,
                captureLat = location?.first,
                captureLng = location?.second,
                isTripCapture = true,
                tripIsEndingExistingTrip = openTrip != null,
                odometerReading = reading,
            )
        )
    }

    fun manualEntry(onDraftReady: (CaptureResult) -> Unit) {
        val photoUri = _uiState.value.pendingPhotoUri
        val captureSource = if (photoUri != null) CaptureSource.PHOTO else CaptureSource.MANUAL
        _uiState.value = CaptureUiState()
        viewModelScope.launch {
            val location = captureLocation()
            onDraftReady(CaptureResult(EntryDraft(), "", captureSource, photoUri, location?.first, location?.second))
        }
    }

    /**
     * General "said/captured from here" evidence, distinct from the
     * trip-specific GPS/odometer fields MileageTripCoordinator already
     * tracks — a quick cached-location read (not a fresh GPS fix), capped so
     * a missing/slow fix never delays handing off to Confirm. Same approach
     * as the watch's capture path (see WearCaptureViewModel.captureLocation).
     */
    private suspend fun captureLocation(): Pair<Double, Double>? {
        val context = ServiceLocator.appContext
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            return null
        }
        return runCatching {
            withTimeoutOrNull(LOCATION_TIMEOUT_MS) {
                LocationServices.getFusedLocationProviderClient(context).lastLocation.await()
                    ?.let { it.latitude to it.longitude }
            }
        }.getOrNull()
    }

    private suspend fun parseAndProceed(
        text: String,
        captureSource: CaptureSource,
        onDraftReady: (CaptureResult) -> Unit,
        holdForManualConfirm: Boolean = false,
    ) {
        // Trip start/stop needs no parsed fields — MileageTrackingService
        // owns property/task-free trip creation — so it's checked before
        // ever calling parseEntry, unlike the timer intent below which needs
        // the parsed draft's property/task for handleTimerStart.
        val tripIntent = TripIntentClassifier.classify(text)
        if (tripIntent == TripIntent.START) {
            MileageTrackingService.start(ServiceLocator.appContext)
            _uiState.value = CaptureUiState(tripMessage = "Trip started — tracking your drive")
            return
        }
        if (tripIntent == TripIntent.STOP) {
            val openGpsTrip = entryRepository.findOpenEntry(isTrip = true)?.takeIf { it.mileageCaptureMethod == "gps" }
            if (openGpsTrip != null) {
                MileageTrackingService.stop(ServiceLocator.appContext)
                _uiState.value = CaptureUiState(tripMessage = "Trip ended — logged automatically")
                return
            }
            // No GPS trip was open — fall through and treat this like a
            // normal capture rather than silently dropping it.
        }

        _uiState.value = _uiState.value.copy(isParsing = true, errorMessage = null, parsingStage = ParsingStage.READING)

        // Best-effort — an empty list is a fine fallback, the model just
        // won't have existing property names to match against.
        val knownProperties = runCatching {
            entryRepository.observeProperties().first().map { it.name }
        }.getOrDefault(emptyList())

        val outcome = agentClient.parseEntry(text, knownProperties) { stage ->
            _uiState.value = _uiState.value.copy(parsingStage = stage)
        }
        when (outcome) {
            is ParseOutcome.Success -> {
                val draft = outcome.result.draft
                // Deterministic keyword pass is tried first and is
                // authoritative when it fires (see TimerIntentClassifier's
                // kdoc); the LLM's own eventType only matters for phrasing
                // the keyword list doesn't cover.
                val intent = TimerIntentClassifier.classify(text) ?: when (draft.eventType) {
                    "start" -> TimerIntent.START
                    "stop" -> TimerIntent.STOP
                    else -> null
                }
                if (intent == TimerIntent.START) {
                    handleTimerStart(draft)
                    return
                }
                if (intent == TimerIntent.STOP) {
                    val stopLocation = captureLocation()
                    val stopped = timerEntryCoordinator.handleStop(
                        draft.property, draft.task, Timestamp.now(), stopLocation?.first, stopLocation?.second,
                    )
                    if (stopped != null) {
                        _uiState.value = CaptureUiState()
                        return
                    }
                    // Nothing was open to close — fall through and treat this
                    // like a normal capture rather than silently dropping it.
                }

                val source = if (outcome.result.source == ParseSource.ON_DEVICE) "on_device" else "cloud"
                // A photo captured earlier in this session failed to draft
                // (see processPhoto's Failure branch) and the user is
                // completing the entry by typing/speaking instead — the
                // entry's true capture source is still PHOTO, and the photo
                // still needs to be attached as evidence.
                val pendingPhotoUri = _uiState.value.pendingPhotoUri
                val effectiveCaptureSource = if (pendingPhotoUri != null) CaptureSource.PHOTO else captureSource
                val location = captureLocation()
                val result = CaptureResult(draft, source, effectiveCaptureSource, pendingPhotoUri, location?.first, location?.second)
                if (holdForManualConfirm) {
                    // Voice path only: hold the already-parsed result and show
                    // its cleaned-up task text for the user to check — see
                    // confirmTranscript, which releases this on a manual tap
                    // rather than navigating to Confirm automatically.
                    pendingVoiceResult = result
                    _uiState.value = _uiState.value.copy(
                        isParsing = false,
                        parsingStage = ParsingStage.IDLE,
                        finalizedTranscript = draft.task?.takeIf { it.isNotBlank() } ?: text,
                    )
                } else {
                    _uiState.value = CaptureUiState() // reset for next capture
                    onDraftReady(result)
                }
            }
            is ParseOutcome.Failure -> {
                _uiState.value = _uiState.value.copy(
                    isParsing = false,
                    errorMessage = outcome.message,
                    parsingStage = ParsingStage.IDLE,
                )
            }
        }
    }

    /**
     * A "start" timer utterance writes straight to Firestore and skips
     * Confirm entirely — matches how the watch-relay path already writes
     * directly with no human tap in between, keeping starting the clock
     * truly hands-free (see TimerEntryCoordinator's kdoc). "Stop" is handled
     * inline in parseAndProceed instead, since a miss (nothing open) needs
     * to fall through to the normal Confirm flow rather than short-circuit.
     */
    private suspend fun handleTimerStart(draft: EntryDraft) {
        val location = captureLocation()
        timerEntryCoordinator.handleStart(
            property = draft.property,
            task = draft.task,
            category = draft.category,
            source = CaptureSource.VOICE,
            startedAt = Timestamp.now(),
            captureLat = location?.first,
            captureLng = location?.second,
        )
        // Persistent notification so the timer can be marked done without
        // reopening the app — see OngoingWorkNotificationService's kdoc.
        // Decorative, never worth failing the actual timer start over.
        runCatching { OngoingWorkNotificationService.start(ServiceLocator.appContext) }
        // No bottom confirmation text here — the "in progress" banner at the
        // top of the screen (driven by openTimerEntry) already shows the
        // clock is running the moment this suspends, live duration included.
        _uiState.value = CaptureUiState()
    }

    /**
     * Manual "Start new work" from the "Other" menu — the tap-triggered
     * equivalent of a "starting to work on X" voice utterance (see
     * [handleTimerStart] above), for a host who'd rather tap than talk to
     * open the clock. Same as a start-trip button tap: property/task are
     * left blank (filled in later via the "tap to complete" banner ->
     * Confirm, see [completeOpenTimer]), and TimerEntryCoordinator.handleStart
     * already auto-closes whatever timer was previously open, so this is
     * safe to call unconditionally even if one happens to already be running.
     */
    fun startNewWork() {
        viewModelScope.launch {
            val location = captureLocation()
            timerEntryCoordinator.handleStart(
                property = null,
                task = null,
                category = null,
                source = CaptureSource.MANUAL,
                startedAt = Timestamp.now(),
                captureLat = location?.first,
                captureLng = location?.second,
            )
            runCatching { OngoingWorkNotificationService.start(ServiceLocator.appContext) }
            // Same reasoning as handleTimerStart above — the top banner is
            // the confirmation, no separate bottom message needed.
            _uiState.value = CaptureUiState()
        }
    }

    /**
     * Tap-to-complete for the "work in progress" indicator (see
     * [openTimerEntry]) — the manual-tap equivalent of saying "stop,"
     * recording the completion time/location the exact same way a voice
     * stop does rather than leaving those fields null just because no
     * utterance was involved.
     */
    fun completeOpenTimer() {
        viewModelScope.launch {
            val stopLocation = captureLocation()
            val stopped = timerEntryCoordinator.handleStop(null, null, Timestamp.now(), stopLocation?.first, stopLocation?.second)
            if (stopped != null) {
                // No bottom confirmation — the "in progress" banner simply
                // disappears once openTimerEntry goes null, which is
                // confirmation enough (see the "start" side, same reasoning).
                _uiState.value = CaptureUiState()
            }
        }
    }

    fun dismissTimerMessage() {
        _uiState.value = _uiState.value.copy(timerMessage = null)
    }

    /**
     * Discards the open work timer entirely — for a "started by mistake" /
     * changed-my-mind cancel, distinct from [completeOpenTimer] which always
     * finalizes an entry. OngoingWorkNotificationService's own Firestore
     * listener picks up the entry disappearing and tears itself down the
     * same way it does on a normal completion, so no separate service call
     * is needed here.
     */
    fun cancelWork() {
        viewModelScope.launch {
            timerEntryCoordinator.handleCancel()
            _uiState.value = CaptureUiState()
        }
    }

    /** Pause/resume the open work timer — see TimerEntryCoordinator.handlePause/handleResume. */
    fun pauseWork() {
        viewModelScope.launch { timerEntryCoordinator.handlePause(Timestamp.now()) }
    }

    fun resumeWork() {
        viewModelScope.launch { timerEntryCoordinator.handleResume(Timestamp.now()) }
    }

    /**
     * Pause/resume the open trip. A GPS trip's distance is accumulated
     * locally inside MileageTrackingService (see its locationCallback), so
     * pausing must go through the service itself rather than the coordinator
     * directly — otherwise the service keeps summing distance covered while
     * "paused" and re-writes it on the next fix, silently undoing the pause.
     * An odometer trip has no running service to relay through, so it's safe
     * to call the coordinator directly there.
     */
    fun pauseTrip() {
        viewModelScope.launch {
            val open = entryRepository.findOpenEntry(isTrip = true) ?: return@launch
            if (open.mileageCaptureMethod == "gps") {
                MileageTrackingService.pause(ServiceLocator.appContext)
            } else {
                mileageTripCoordinator.handlePauseTrip(Timestamp.now())
            }
        }
    }

    fun resumeTrip() {
        viewModelScope.launch {
            val open = entryRepository.findOpenEntry(isTrip = true) ?: return@launch
            if (open.mileageCaptureMethod == "gps") {
                MileageTrackingService.resume(ServiceLocator.appContext)
            } else {
                mileageTripCoordinator.handleResumeTrip(Timestamp.now())
            }
        }
    }

    /**
     * Discards the open trip entirely — a GPS trip must route through
     * MileageTrackingService.cancel() so its onDestroy skips writing a
     * finalized entry (see [pauseTrip]'s kdoc for why GPS trips can't be
     * mutated directly while the service owns them); an odometer trip has
     * no running service, so the coordinator is called directly.
     */
    fun cancelTrip() {
        viewModelScope.launch {
            val open = entryRepository.findOpenEntry(isTrip = true) ?: return@launch
            if (open.mileageCaptureMethod == "gps") {
                MileageTrackingService.cancel(ServiceLocator.appContext)
            } else {
                mileageTripCoordinator.handleCancelTrip()
            }
        }
    }

    fun dismissTripMessage() {
        _uiState.value = _uiState.value.copy(tripMessage = null)
    }
}

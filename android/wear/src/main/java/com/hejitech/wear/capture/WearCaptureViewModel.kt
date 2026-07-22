package com.hejitech.wear.capture

import android.Manifest
import android.content.pm.PackageManager
import androidx.core.content.ContextCompat
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.OutOfQuotaPolicy
import androidx.work.WorkManager
import com.hejitech.wear.data.WearServiceLocator
import com.hejitech.core.audio.WavAudio
import com.hejitech.core.model.EntryStatus
import com.google.android.gms.location.LocationServices
import com.google.firebase.Firebase
import com.google.firebase.auth.auth
import com.google.firebase.firestore.FirebaseFirestoreException
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.launchIn
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.onEach
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withTimeoutOrNull

import com.hejitech.wear.timer.WearGpsTripStore
import com.hejitech.wear.timer.WearTimerNotificationManager
import com.hejitech.wear.timer.WearWorkTimerStore
import kotlinx.coroutines.Job

data class WearUiState(
    val isSignedIn: Boolean = false,
    val isSigningIn: Boolean = false,
    val isRecording: Boolean = false,
    val confirmedHours: Double = 0.0,
    val lastSavedSummary: String? = null,
    val errorMessage: String? = null,
    /** Recordings saved locally but not yet durably uploaded to Storage. */
    val pendingCount: Int = 0,
    /** Recordings successfully uploaded today (resets daily) — see UploadStatsStore. */
    val uploadedTodayCount: Int = 0,
    /** True while a manually-triggered upload (see [WearCaptureViewModel.uploadPendingNow]) is in flight. */
    val isUploadingPending: Boolean = false,
    val isTimerRunning: Boolean = false,
    val timerTask: String = "STR General Work",
    val elapsedSeconds: Int = 0,
    val isTripActive: Boolean = false,
    val tripElapsedSeconds: Int = 0,
)

/** How often the pending/uploaded-today counters refresh while this screen is visible. */
private const val STATS_POLL_INTERVAL_MS = 3_000L

/** Best-effort cap on waiting for a cached location fix — never worth delaying the "Saved" feedback for. */
private const val LOCATION_TIMEOUT_MS = 1_500L

class WearCaptureViewModel : ViewModel() {
    private val entryRepository = WearServiceLocator.entryRepository
    private val authManager = WearServiceLocator.authManager
    private val audioRecorder = WearServiceLocator.audioRecorder
    private val pendingCaptureStore = WearServiceLocator.pendingCaptureStore
    private val uploadStatsStore = WearServiceLocator.uploadStatsStore
    private val appContext = WearServiceLocator.appContext
    private val timerStore = WearWorkTimerStore(appContext)
    private val tripStore = WearGpsTripStore(appContext)
    private val notificationManager = WearTimerNotificationManager(appContext)

    val recordingAmplitude = audioRecorder.amplitude

    private val _uiState = MutableStateFlow(WearUiState(isSignedIn = Firebase.auth.currentUser != null))
    val uiState: StateFlow<WearUiState> = _uiState.asStateFlow()

    private var timerTickerJob: Job? = null
    private var tripTickerJob: Job? = null

    init {
        if (_uiState.value.isSignedIn) observeProgress()
        pollUploadStats()
        refreshTimerState()
        refreshTripState()
    }

    fun startWorkTimer(task: String = "STR General Work") {
        timerStore.startTimer(task)
        refreshTimerState()
    }

    fun startGpsTrip() {
        tripStore.startTrip()
        refreshTripState()
    }

    fun stopGpsTrip() {
        val completed = tripStore.stopAndCompleteTrip()
        refreshTripState()

        if (completed != null) {
            _uiState.update {
                it.copy(
                    lastSavedSummary = "GPS Trip Logged — ${completed.durationMinutes} mins!",
                )
            }
        }
    }

    fun stopAndCompleteWorkTimer() {
        val completed = timerStore.stopAndCompleteTimer()
        notificationManager.cancelNotification()
        refreshTimerState()

        if (completed != null) {
            val dummyWav = ByteArray(44)
            pendingCaptureStore.save(dummyWav, null, null)
            enqueueExpeditedUpload()

            _uiState.update {
                it.copy(
                    lastSavedSummary = "Work Logged — ${completed.durationMinutes} min confirmed!",
                    confirmedHours = it.confirmedHours + (completed.durationMinutes / 60.0),
                    pendingCount = pendingCaptureStore.listPending().size,
                )
            }
        }
    }

    private fun refreshTimerState() {
        val isRunning = timerStore.isTimerRunning()
        val task = timerStore.getTask()
        val elapsed = timerStore.getElapsedSeconds()

        _uiState.update {
            it.copy(
                isTimerRunning = isRunning,
                timerTask = task,
                elapsedSeconds = elapsed,
            )
        }

        timerTickerJob?.cancel()
        if (isRunning) {
            timerTickerJob = viewModelScope.launch {
                while (true) {
                    delay(1_000L)
                    val updatedSec = timerStore.getElapsedSeconds()
                    val elapsedMin = updatedSec / 60
                    _uiState.update { it.copy(elapsedSeconds = updatedSec) }
                    notificationManager.showOngoingTimerNotification(task, elapsedMin)
                }
            }
        }
    }

    private fun refreshTripState() {
        val isRunning = tripStore.isTripActive()
        val elapsed = tripStore.getElapsedSeconds()

        _uiState.update {
            it.copy(
                isTripActive = isRunning,
                tripElapsedSeconds = elapsed,
            )
        }

        tripTickerJob?.cancel()
        if (isRunning) {
            tripTickerJob = viewModelScope.launch {
                while (true) {
                    delay(1_000L)
                    val updatedSec = tripStore.getElapsedSeconds()
                    _uiState.update { it.copy(tripElapsedSeconds = updatedSec) }
                }
            }
        }
    }

    private fun observeProgress() {
        entryRepository.observeEntries()
            .map { entries ->
                entries.filter { it.statusEnum == EntryStatus.CONFIRMED }.sumOf { it.durationMinutes } / 60.0
            }
            // A stale/invalid session (e.g. a corrupted local auth cache, or
            // the emulator-token-not-yet-propagated race right after a fresh
            // sign-in) makes Firestore reject this listener with
            // PERMISSION_DENIED, which otherwise propagates as an uncaught
            // exception in viewModelScope and crashes the whole watch
            // process — same failure mode already fixed on the phone side
            // (see DashboardViewModel/CaptureViewModel's identical .catch).
            .catch { e ->
                if (e is FirebaseFirestoreException &&
                    (e.code == FirebaseFirestoreException.Code.PERMISSION_DENIED ||
                        e.code == FirebaseFirestoreException.Code.UNAUTHENTICATED)
                ) {
                    authManager.signOut()
                    _uiState.update { it.copy(isSignedIn = false) }
                }
                emit(0.0)
            }
            .onEach { hours -> _uiState.update { it.copy(confirmedHours = hours) } }
            .launchIn(viewModelScope)
    }

    /** Refreshes while this screen is visible — background uploads (WorkManager) aren't otherwise observable from here. */
    private fun pollUploadStats() {
        viewModelScope.launch {
            while (true) {
                _uiState.update {
                    it.copy(
                        pendingCount = pendingCaptureStore.listPending().size,
                        uploadedTodayCount = uploadStatsStore.getUploadedTodayCount(),
                    )
                }
                delay(STATS_POLL_INTERVAL_MS)
            }
        }
    }

    fun signIn() {
        _uiState.update { it.copy(isSigningIn = true, errorMessage = null) }
        viewModelScope.launch {
            authManager.signIn()
                .onSuccess {
                    _uiState.update { it.copy(isSigningIn = false, isSignedIn = true) }
                    observeProgress()
                }
                .onFailure { e ->
                    _uiState.update { it.copy(isSigningIn = false, errorMessage = e.message ?: "Sign-in failed — try again.") }
                }
        }
    }

    fun hasRecordAudioPermission(): Boolean = audioRecorder.hasPermission()

    fun startRecording() {
        if (_uiState.value.isRecording || !audioRecorder.hasPermission()) return
        _uiState.update { it.copy(isRecording = true, errorMessage = null, lastSavedSummary = null) }
        audioRecorder.start(viewModelScope)
    }

    /**
     * Stop -> WAV-encode -> save locally, done. Deliberately does not wait on
     * location or the upload itself — capture stays instant, the recording
     * is safely on disk within milliseconds, and a one-time expedited
     * WorkManager request kicks the actual Storage upload off in the
     * background right away (PendingCaptureSyncWorker's 15-minute periodic
     * job remains the fallback for whenever this watch had no connectivity
     * at record time — see PendingCaptureSyncer's kdoc).
     */
    fun stopRecordingAndSend() {
        if (!_uiState.value.isRecording) return

        viewModelScope.launch {
            val samples = audioRecorder.stop()
            if (samples.isEmpty()) {
                _uiState.update { it.copy(isRecording = false, errorMessage = "Didn't catch that — try again.") }
                return@launch
            }

            val wav = WavAudio.encode(samples, WearAudioRecorder.SAMPLE_RATE_HZ)
            val location = captureLocation()
            pendingCaptureStore.save(wav, location?.first, location?.second)
            enqueueExpeditedUpload()
            _uiState.update {
                it.copy(
                    isRecording = false,
                    lastSavedSummary = "Saved — uploading shortly",
                    pendingCount = pendingCaptureStore.listPending().size,
                )
            }
        }
    }

    /** Cached last-known location only (not a fresh GPS fix) — capped so a missing/slow fix never delays the "Saved" feedback. */
    private suspend fun captureLocation(): Pair<Double, Double>? {
        if (ContextCompat.checkSelfPermission(appContext, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            return null
        }
        return runCatching {
            withTimeoutOrNull(LOCATION_TIMEOUT_MS) {
                LocationServices.getFusedLocationProviderClient(appContext).lastLocation.await()
                    ?.let { it.latitude to it.longitude }
            }
        }.getOrNull()
    }

    /**
     * User-initiated "upload now" — syncs the pending backlog directly
     * (rather than just enqueuing WorkManager, which may sit behind its own
     * scheduling/backoff) so a tap gives immediate, visible feedback instead
     * of relying on the 15-minute periodic fallback or hoping the expedited
     * one-time request runs promptly.
     */
    fun uploadPendingNow() {
        if (_uiState.value.isUploadingPending || _uiState.value.pendingCount == 0) return
        _uiState.update { it.copy(isUploadingPending = true, errorMessage = null, lastSavedSummary = null) }
        viewModelScope.launch {
            PendingCaptureSyncer.syncAll()
            val stillPending = pendingCaptureStore.listPending().size
            _uiState.update {
                it.copy(
                    isUploadingPending = false,
                    pendingCount = stillPending,
                    uploadedTodayCount = uploadStatsStore.getUploadedTodayCount(),
                    lastSavedSummary = if (stillPending == 0) "All uploaded" else null,
                    errorMessage = if (stillPending > 0) "$stillPending still pending — check connection" else null,
                )
            }
        }
    }

    private fun enqueueExpeditedUpload() {
        val request = OneTimeWorkRequestBuilder<PendingCaptureSyncWorker>()
            .setExpedited(OutOfQuotaPolicy.RUN_AS_NON_EXPEDITED_WORK_REQUEST)
            .build()
        WorkManager.getInstance(appContext)
            .enqueueUniqueWork("pending-capture-upload-now", ExistingWorkPolicy.APPEND_OR_REPLACE, request)
    }

    fun dismissMessages() {
        _uiState.update { it.copy(lastSavedSummary = null, errorMessage = null) }
    }
}

package com.hejitech.contempo.ui.feedback

import android.os.Build
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.hejitech.contempo.BuildConfig
import com.hejitech.contempo.data.ServiceLocator
import com.hejitech.contempo.feedback.PendingFeedbackCaptureStore
import com.hejitech.contempo.ui.navigation.CurrentScreenTracker
import com.hejitech.core.model.FeedbackRegion
import java.io.File
import java.util.Locale
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class FeedbackSubmitUiState(
    val description: String = "",
    val isSubmitting: Boolean = false,
    val errorMessage: String? = null,
    val submitted: Boolean = false,
    /**
     * On-device dictation for the description field — same
     * record-then-transcribe pipeline (AudioRecorder + WhisperTranscriber)
     * as Confirm's task field. Appends rather than replaces when the field
     * already has text, same reasoning as ConfirmViewModel.stopRecordingTask.
     */
    val isRecordingDescription: Boolean = false,
    val isTranscribingDescription: Boolean = false,
)

class FeedbackViewModel : ViewModel() {
    private val entryRepository = ServiceLocator.entryRepository
    private val audioRecorder = ServiceLocator.audioRecorder
    private val whisperTranscriber = ServiceLocator.whisperTranscriber
    private val captureLanguageStore = ServiceLocator.captureLanguageStore

    private val _uiState = MutableStateFlow(FeedbackSubmitUiState())
    val uiState: StateFlow<FeedbackSubmitUiState> = _uiState.asStateFlow()

    fun onDescriptionChanged(value: String) {
        _uiState.value = _uiState.value.copy(description = value)
    }

    fun hasRecordAudioPermission(): Boolean = audioRecorder.hasPermission()

    fun startRecordingDescription() {
        if (_uiState.value.isRecordingDescription || !audioRecorder.hasPermission()) return
        _uiState.value = _uiState.value.copy(isRecordingDescription = true, errorMessage = null)
        audioRecorder.start(viewModelScope)
    }

    fun stopRecordingDescription() {
        if (!_uiState.value.isRecordingDescription) return
        _uiState.value = _uiState.value.copy(isRecordingDescription = false, isTranscribingDescription = true)
        viewModelScope.launch {
            val samples = audioRecorder.stop()
            val rawTranscript = runCatching {
                whisperTranscriber.transcribe(samples, captureLanguageStore.selected.value)
            }.getOrDefault("")

            if (rawTranscript.isBlank()) {
                _uiState.value = _uiState.value.copy(
                    isTranscribingDescription = false,
                    errorMessage = "Didn't catch that — try again.",
                )
                return@launch
            }

            val existing = _uiState.value.description
            val merged = when {
                existing.isBlank() -> rawTranscript
                existing.last().isWhitespace() -> "$existing$rawTranscript"
                else -> "$existing $rawTranscript"
            }
            _uiState.value = _uiState.value.copy(description = merged, isTranscribingDescription = false)
        }
    }

    fun submit(imageFile: File, region: FeedbackRegion?, description: String) {
        _uiState.value = FeedbackSubmitUiState(isSubmitting = true)
        viewModelScope.launch {
            runCatching {
                entryRepository.submitFeedback(
                    imageFile = imageFile,
                    region = region,
                    description = description,
                    screenName = CurrentScreenTracker.currentScreen.value,
                    appVersion = BuildConfig.VERSION_NAME,
                    buildNumber = BuildConfig.VERSION_CODE.toString(),
                    osVersion = Build.VERSION.RELEASE ?: "",
                    deviceModel = Build.MODEL ?: "",
                    locale = Locale.getDefault().toLanguageTag(),
                )
            }.onSuccess {
                PendingFeedbackCaptureStore.clear()
                _uiState.value = FeedbackSubmitUiState(submitted = true)
            }.onFailure { e ->
                _uiState.value = _uiState.value.copy(
                    isSubmitting = false,
                    errorMessage = e.message ?: "Couldn't submit feedback — try again.",
                )
            }
        }
    }

    fun cancel() {
        PendingFeedbackCaptureStore.clear()
    }
}

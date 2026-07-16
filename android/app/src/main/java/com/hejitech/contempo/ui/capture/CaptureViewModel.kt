package com.hejitech.contempo.ui.capture

import android.graphics.Bitmap
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.hejitech.contempo.agent.AiAvailability
import com.hejitech.contempo.agent.CaptureResult
import com.hejitech.contempo.agent.EntryDraft
import com.hejitech.contempo.agent.ParseOutcome
import com.hejitech.contempo.agent.ParseSource
import com.hejitech.contempo.agent.ParsingStage
import com.hejitech.contempo.agent.aiAvailability
import com.hejitech.contempo.data.ServiceLocator
import com.hejitech.core.model.CaptureSource
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

data class CaptureUiState(
    val inputText: String = "",
    val isRecording: Boolean = false,
    val isTranscribing: Boolean = false,
    val isParsing: Boolean = false,
    val isDraftingFromPhoto: Boolean = false,
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
)

/** How long the finalized-transcript card holds before parsing starts. */
private const val FINALIZED_TRANSCRIPT_HOLD_MS = 700L

class CaptureViewModel : ViewModel() {
    private val agentClient = ServiceLocator.agentClient
    private val entryRepository = ServiceLocator.entryRepository
    private val aiSettingsStore = ServiceLocator.aiSettingsStore
    private val onDeviceLlm = ServiceLocator.onDeviceLlm
    private val audioRecorder = ServiceLocator.audioRecorder
    private val whisperTranscriber = ServiceLocator.whisperTranscriber

    val recordingAmplitude = audioRecorder.amplitude

    private val _uiState = MutableStateFlow(CaptureUiState())
    val uiState: StateFlow<CaptureUiState> = combine(
        _uiState,
        aiSettingsStore.preference,
        onDeviceLlm.status,
    ) { state, preference, modelStatus ->
        state.copy(aiAvailability = aiAvailability(preference, modelStatus))
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), CaptureUiState())

    fun onInputChanged(text: String) {
        _uiState.value = _uiState.value.copy(inputText = text, errorMessage = null)
    }

    fun hasRecordAudioPermission(): Boolean = audioRecorder.hasPermission()

    fun startRecording() {
        if (_uiState.value.isRecording || !audioRecorder.hasPermission()) return
        _uiState.value = _uiState.value.copy(isRecording = true, errorMessage = null)
        audioRecorder.start(viewModelScope)
    }

    /**
     * Stop -> on-device Whisper transcribe -> on-device cleanup pass (fixes
     * dictation typos/punctuation, see AgentClient.cleanupTranscript) ->
     * straight into the same parse-and-proceed path as typed text, same as
     * the PRD's "no unlock, no-home-screen capture" hands-free intent — the
     * user doesn't need a second manual tap once they've finished speaking.
     * The cleaned text is shown in the field throughout while transcribing.
     */
    fun stopRecordingAndProcess(onDraftReady: (CaptureResult) -> Unit) {
        if (!_uiState.value.isRecording) return
        _uiState.value = _uiState.value.copy(isRecording = false, isTranscribing = true)

        viewModelScope.launch {
            val samples = audioRecorder.stop()
            val rawTranscript = runCatching { whisperTranscriber.transcribe(samples) }.getOrDefault("")

            if (rawTranscript.isBlank()) {
                _uiState.value = _uiState.value.copy(
                    isTranscribing = false,
                    errorMessage = "Didn't catch that — try again.",
                )
                return@launch
            }

            _uiState.value = _uiState.value.copy(inputText = rawTranscript)
            val cleaned = runCatching { agentClient.cleanupTranscript(rawTranscript) }.getOrDefault(rawTranscript)
            _uiState.value = _uiState.value.copy(inputText = cleaned, isTranscribing = false, finalizedTranscript = cleaned)

            // Hold the "here's what we heard" beat briefly before moving on
            // — guarantees it's perceivable even on a fast device, not just
            // whatever's left over after cleanup happens to finish.
            delay(FINALIZED_TRANSCRIPT_HOLD_MS)
            _uiState.value = _uiState.value.copy(finalizedTranscript = null)

            parseAndProceed(cleaned, CaptureSource.VOICE, onDraftReady)
        }
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
        viewModelScope.launch { parseAndProceed(text, CaptureSource.TEXT, onDraftReady) }
    }

    /**
     * A just-taken photo, drafted via the on-device model's vision input
     * (see AgentClient.draftEntryFromPhoto). Unlike text/voice this doesn't
     * check aiAvailability up front — draftEntryFromPhoto already produces
     * an honest per-preference failure message on its own, and the photo is
     * still worth keeping as evidence even when drafting isn't available
     * (photoUri survives into the manual-clarification path below).
     */
    fun processPhoto(bitmap: Bitmap, photoUri: String, onDraftReady: (CaptureResult) -> Unit) {
        _uiState.value = _uiState.value.copy(
            isDraftingFromPhoto = true,
            errorMessage = null,
            pendingPhotoUri = photoUri,
        )

        viewModelScope.launch {
            val knownProperties = runCatching {
                entryRepository.observeProperties().first().map { it.name }
            }.getOrDefault(emptyList())

            when (val outcome = agentClient.draftEntryFromPhoto(bitmap, knownProperties)) {
                is ParseOutcome.Success -> {
                    val draft = outcome.result.draft
                    val source = if (outcome.result.source == ParseSource.ON_DEVICE) "on_device" else "cloud"
                    _uiState.value = CaptureUiState()
                    onDraftReady(CaptureResult(draft, source, CaptureSource.PHOTO, photoUri))
                }
                is ParseOutcome.Failure -> {
                    // pendingPhotoUri (set above) stays, so the photo is
                    // still attached as evidence if the user falls back to
                    // typing/voice (see parseAndProceed) or manual entry.
                    _uiState.value = _uiState.value.copy(
                        isDraftingFromPhoto = false,
                        errorMessage = outcome.message,
                    )
                }
            }
        }
    }

    fun manualEntry(onDraftReady: (CaptureResult) -> Unit) {
        val photoUri = _uiState.value.pendingPhotoUri
        val captureSource = if (photoUri != null) CaptureSource.PHOTO else CaptureSource.MANUAL
        _uiState.value = CaptureUiState()
        onDraftReady(CaptureResult(EntryDraft(), "", captureSource, photoUri))
    }

    private suspend fun parseAndProceed(text: String, captureSource: CaptureSource, onDraftReady: (CaptureResult) -> Unit) {
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
                val source = if (outcome.result.source == ParseSource.ON_DEVICE) "on_device" else "cloud"
                // A photo captured earlier in this session failed to draft
                // (see processPhoto's Failure branch) and the user is
                // completing the entry by typing/speaking instead — the
                // entry's true capture source is still PHOTO, and the photo
                // still needs to be attached as evidence.
                val pendingPhotoUri = _uiState.value.pendingPhotoUri
                val effectiveCaptureSource = if (pendingPhotoUri != null) CaptureSource.PHOTO else captureSource
                _uiState.value = CaptureUiState() // reset for next capture
                onDraftReady(CaptureResult(draft, source, effectiveCaptureSource, pendingPhotoUri))
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
}

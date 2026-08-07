package com.hejitech.contempo.ui.chat

import android.graphics.Bitmap
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.hejitech.contempo.agent.AiAvailability
import com.hejitech.contempo.agent.AskOutcome
import com.hejitech.contempo.agent.ChatMessage
import com.hejitech.contempo.agent.ChatRole
import com.hejitech.contempo.agent.GenerationEvent
import com.hejitech.contempo.agent.UserStats
import com.hejitech.contempo.agent.aiAvailability
import com.hejitech.contempo.data.ServiceLocator
import com.hejitech.core.model.Entry
import com.hejitech.core.model.EntryStatus
import com.hejitech.core.model.MaterialParticipationTest
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

data class ChatUiState(
    val messages: List<ChatMessage> = emptyList(),
    val inputText: String = "",
    val pendingImage: Bitmap? = null,
    /** Entries the host attached via the "@ Attach entry" picker to ask an entry-specific question — cleared after send, same as pendingImage. */
    val pendingEntries: List<Entry> = emptyList(),
    val isSending: Boolean = false,
    val isRecording: Boolean = false,
    val isTranscribing: Boolean = false,
    val errorMessage: String? = null,
    val aiAvailability: AiAvailability = AiAvailability.Ready,
    /** Live on-device generation progress while isSending — see AgentClient.askQuestionStream. Null outside a streamed send (not sending, or a cloud/image answer that never emits events). */
    val streamingStatus: GenerationEvent? = null,
    /** Backs the entry picker sheet — the host's full entry list to search/select from. */
    val showEntryPicker: Boolean = false,
    val availableEntries: List<Entry> = emptyList(),
    /**
     * True when showEntryPicker was opened by typing "@" (see onInputChanged)
     * rather than tapping the attach-entry menu item — only then does
     * attachEntry strip the trailing "@" back out of inputText, so a
     * deliberately-typed "@" left untouched (picker dismissed without
     * picking) isn't silently eaten.
     */
    val entryPickerTriggeredByAtSymbol: Boolean = false,
)

/**
 * History is held only in this ViewModel (in-memory, per the user's explicit
 * call to skip Firestore persistence for this MVP round) — it resets on
 * process death, same as any other unsaved UI state.
 */
class ChatViewModel : ViewModel() {
    private val agentClient = ServiceLocator.agentClient
    private val entryRepository = ServiceLocator.entryRepository
    private val aiSettingsStore = ServiceLocator.aiSettingsStore
    private val onDeviceLlm = ServiceLocator.onDeviceLlm

    // Same shared recorder/transcriber Capture uses — safe to reuse since
    // only one top-level screen is ever visible/interactive at a time.
    private val audioRecorder = ServiceLocator.audioRecorder
    private val whisperTranscriber = ServiceLocator.whisperTranscriber
    // Same language toggle Capture's tab shows — one shared preference for
    // both features rather than a second, independent setting, since it's
    // the same underlying transcription quality question either place.
    private val captureLanguageStore = ServiceLocator.captureLanguageStore
    val recordingAmplitude = audioRecorder.amplitude

    private val _uiState = MutableStateFlow(ChatUiState())
    val uiState: StateFlow<ChatUiState> = combine(
        _uiState,
        aiSettingsStore.preference,
        onDeviceLlm.status,
    ) { state, preference, modelStatus ->
        state.copy(aiAvailability = aiAvailability(preference, modelStatus))
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), ChatUiState())

    /**
     * Typing "@" opens the same entry picker the dedicated attach-entry menu
     * item does — detected as "@" newly appearing as the single just-typed
     * character (length grew by exactly one and it wasn't the last character
     * a moment ago), so pasting a longer string containing "@" mid-text or
     * backspacing into one doesn't retrigger it.
     */
    fun onInputChanged(text: String) {
        val previous = _uiState.value.inputText
        _uiState.value = _uiState.value.copy(inputText = text, errorMessage = null)
        if (text.length == previous.length + 1 && text.endsWith("@") && !previous.endsWith("@")) {
            openEntryPicker(triggeredByAtSymbol = true)
        }
    }

    fun hasRecordAudioPermission(): Boolean = audioRecorder.hasPermission()

    fun startRecording() {
        if (_uiState.value.isRecording || !audioRecorder.hasPermission()) return
        _uiState.value = _uiState.value.copy(isRecording = true, errorMessage = null)
        audioRecorder.start(viewModelScope)
    }

    /**
     * Stop -> on-device Whisper transcribe -> cleanup pass -> auto-send,
     * mirroring Capture's hands-free "speak and it just happens" flow
     * rather than making the user also tap Send after dictating.
     */
    fun stopRecordingAndSend() {
        if (!_uiState.value.isRecording) return
        _uiState.value = _uiState.value.copy(isRecording = false, isTranscribing = true)

        viewModelScope.launch {
            val samples = audioRecorder.stop()
            val rawTranscript = runCatching {
                whisperTranscriber.transcribe(samples, captureLanguageStore.selected.value)
            }.getOrDefault("")

            if (rawTranscript.isBlank()) {
                _uiState.value = _uiState.value.copy(
                    isTranscribing = false,
                    errorMessage = "Didn't catch that — try again.",
                )
                return@launch
            }

            val cleaned = runCatching { agentClient.cleanupTranscript(rawTranscript) }.getOrDefault(rawTranscript)
            _uiState.value = _uiState.value.copy(inputText = cleaned, isTranscribing = false)
            send()
        }
    }

    fun attachImage(bitmap: Bitmap) {
        _uiState.value = _uiState.value.copy(pendingImage = bitmap, errorMessage = null)
    }

    fun clearPendingImage() {
        _uiState.value = _uiState.value.copy(pendingImage = null)
    }

    /** Opens the entry picker sheet, loading the host's entries fresh each time so a just-logged entry is selectable immediately. */
    fun openEntryPicker(triggeredByAtSymbol: Boolean = false) {
        _uiState.value = _uiState.value.copy(showEntryPicker = true, entryPickerTriggeredByAtSymbol = triggeredByAtSymbol)
        viewModelScope.launch {
            val entries = runCatching { entryRepository.observeEntries().first() }.getOrDefault(emptyList())
            _uiState.value = _uiState.value.copy(availableEntries = entries)
        }
    }

    fun dismissEntryPicker() {
        // Deliberately leaves inputText untouched — a typed "@" only gets
        // stripped on a successful attach (see attachEntry), not on dismiss,
        // so backing out of the picker never silently eats what was typed.
        _uiState.value = _uiState.value.copy(showEntryPicker = false, entryPickerTriggeredByAtSymbol = false)
    }

    fun attachEntry(entry: Entry) {
        val state = _uiState.value
        val strippedInput = if (state.entryPickerTriggeredByAtSymbol && state.inputText.endsWith("@")) {
            state.inputText.dropLast(1)
        } else {
            state.inputText
        }
        if (state.pendingEntries.any { it.id == entry.id }) {
            _uiState.value = state.copy(showEntryPicker = false, entryPickerTriggeredByAtSymbol = false, inputText = strippedInput)
            return
        }
        _uiState.value = state.copy(
            pendingEntries = state.pendingEntries + entry,
            showEntryPicker = false,
            entryPickerTriggeredByAtSymbol = false,
            inputText = strippedInput,
        )
    }

    fun removeAttachedEntry(entry: Entry) {
        _uiState.value = _uiState.value.copy(pendingEntries = _uiState.value.pendingEntries.filterNot { it.id == entry.id })
    }

    fun clearHistory() {
        _uiState.value = _uiState.value.copy(messages = emptyList(), errorMessage = null)
    }

    fun send() {
        val question = _uiState.value.inputText.trim()
        val image = _uiState.value.pendingImage
        val attachedEntries = _uiState.value.pendingEntries
        if ((question.isEmpty() && image == null && attachedEntries.isEmpty()) || uiState.value.aiAvailability != AiAvailability.Ready) return
        // A photo/attached-entries-only send with no typed question is still
        // valid (e.g. "what's this?" implied by the photo, or "how many
        // hours is this?" implied by the attached entry) — give the model
        // something to answer.
        val effectiveQuestion = question.ifEmpty {
            if (attachedEntries.isNotEmpty()) "Tell me about the attached entr${if (attachedEntries.size == 1) "y" else "ies"}." else "What do you see in this photo?"
        }
        sendQuestion(effectiveQuestion, image, attachedEntries)
    }

    /** One-tap send for a starter-prompt card (see ChatScreen's empty-state hero) — same path as typing the question and tapping send. */
    fun sendPrompt(prompt: String) {
        if (uiState.value.aiAvailability != AiAvailability.Ready) return
        sendQuestion(prompt, _uiState.value.pendingImage, _uiState.value.pendingEntries)
    }

    private fun sendQuestion(effectiveQuestion: String, image: Bitmap?, attachedEntries: List<Entry> = emptyList()) {
        val history = _uiState.value.messages
        _uiState.value = _uiState.value.copy(
            messages = history + ChatMessage(ChatRole.USER, effectiveQuestion, image),
            inputText = "",
            pendingImage = null,
            pendingEntries = emptyList(),
            isSending = true,
            streamingStatus = null,
            errorMessage = null,
        )

        viewModelScope.launch {
            val stats = runCatching {
                val entries = entryRepository.observeEntries().first()
                val confirmedMinutes = entries
                    .filter { it.statusEnum == EntryStatus.CONFIRMED }
                    .sumOf { it.durationMinutes }
                UserStats(
                    confirmedHours = confirmedMinutes / 60.0,
                    thresholdHours = MaterialParticipationTest.THRESHOLD_HOURS,
                    testName = MaterialParticipationTest.NAME,
                )
            }.getOrDefault(
                UserStats(0.0, MaterialParticipationTest.THRESHOLD_HOURS, MaterialParticipationTest.NAME)
            )

            // Streaming progress only exists for the text-only on-device path
            // (see askQuestionStream's kdoc) — a photo question falls back to
            // the plain non-streaming askQuestion, same as before this feature.
            val outcome = if (image != null) {
                agentClient.askQuestion(history, effectiveQuestion, stats, image, attachedEntries)
            } else {
                agentClient.askQuestionStream(history, effectiveQuestion, stats, attachedEntries) { event ->
                    _uiState.value = _uiState.value.copy(streamingStatus = event)
                }
            }
            when (outcome) {
                is AskOutcome.Success -> {
                    _uiState.value = _uiState.value.copy(
                        messages = _uiState.value.messages + ChatMessage(ChatRole.AGENT, outcome.answer),
                        isSending = false,
                        streamingStatus = null,
                    )
                }
                is AskOutcome.Failure -> {
                    _uiState.value = _uiState.value.copy(isSending = false, streamingStatus = null, errorMessage = outcome.message)
                }
            }
        }
    }
}

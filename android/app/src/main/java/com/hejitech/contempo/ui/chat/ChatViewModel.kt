package com.hejitech.contempo.ui.chat

import android.graphics.Bitmap
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.hejitech.contempo.agent.AiAvailability
import com.hejitech.contempo.agent.AskOutcome
import com.hejitech.contempo.agent.ChatMessage
import com.hejitech.contempo.agent.ChatRole
import com.hejitech.contempo.agent.UserStats
import com.hejitech.contempo.agent.aiAvailability
import com.hejitech.contempo.data.ServiceLocator
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
    val isSending: Boolean = false,
    val errorMessage: String? = null,
    val aiAvailability: AiAvailability = AiAvailability.Ready,
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

    private val _uiState = MutableStateFlow(ChatUiState())
    val uiState: StateFlow<ChatUiState> = combine(
        _uiState,
        aiSettingsStore.preference,
        onDeviceLlm.status,
    ) { state, preference, modelStatus ->
        state.copy(aiAvailability = aiAvailability(preference, modelStatus))
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), ChatUiState())

    fun onInputChanged(text: String) {
        _uiState.value = _uiState.value.copy(inputText = text, errorMessage = null)
    }

    fun attachImage(bitmap: Bitmap) {
        _uiState.value = _uiState.value.copy(pendingImage = bitmap, errorMessage = null)
    }

    fun clearPendingImage() {
        _uiState.value = _uiState.value.copy(pendingImage = null)
    }

    fun send() {
        val question = _uiState.value.inputText.trim()
        val image = _uiState.value.pendingImage
        if ((question.isEmpty() && image == null) || uiState.value.aiAvailability != AiAvailability.Ready) return
        // A photo with no typed question is a valid send (e.g. "what's this?"
        // implied by the photo itself) — give the model something to answer.
        val effectiveQuestion = question.ifEmpty { "What do you see in this photo?" }

        val history = _uiState.value.messages
        _uiState.value = _uiState.value.copy(
            messages = history + ChatMessage(ChatRole.USER, effectiveQuestion, image),
            inputText = "",
            pendingImage = null,
            isSending = true,
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

            when (val outcome = agentClient.askQuestion(history, effectiveQuestion, stats, image)) {
                is AskOutcome.Success -> {
                    _uiState.value = _uiState.value.copy(
                        messages = _uiState.value.messages + ChatMessage(ChatRole.AGENT, outcome.answer),
                        isSending = false,
                    )
                }
                is AskOutcome.Failure -> {
                    _uiState.value = _uiState.value.copy(isSending = false, errorMessage = outcome.message)
                }
            }
        }
    }
}

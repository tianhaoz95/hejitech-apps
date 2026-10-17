package com.hejitech.contempo.agent

import android.graphics.Bitmap

/**
 * Mirrors backend/functions/src/schemas.ts ChatMessageSchema, plus a
 * client-only [image] for multimodal questions — in-memory display only
 * (chat history isn't persisted, see ChatViewModel's kdoc), never sent to the
 * cloud schema.
 */
data class ChatMessage(val role: ChatRole, val text: String, val image: Bitmap? = null)

enum class ChatRole { USER, AGENT }

/** Grounding context passed with every question — see DashboardUiState for the source values. */
data class UserStats(
    val confirmedHours: Double,
    val thresholdHours: Int,
    val testName: String,
)

sealed interface AskOutcome {
    data class Success(val answer: String, val source: ParseSource) : AskOutcome
    data class Failure(val message: String) : AskOutcome
}

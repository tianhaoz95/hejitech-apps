package com.hejitech.contempo.agent

/**
 * Token counts from the most recently completed on-device generate call
 * (prefill = input, decode = output) — see [OnDeviceLlm.lastCallTokenUsage].
 * Ephemeral, not Firestore-persisted (compare [com.hejitech.core.model.TokenUsageWeek],
 * the accumulated-per-week shape this feeds into via
 * [com.hejitech.core.data.EntryRepository.recordOnDeviceTokenUsage]).
 */
data class TokenUsage(
    val inputTokens: Int,
    val outputTokens: Int,
)

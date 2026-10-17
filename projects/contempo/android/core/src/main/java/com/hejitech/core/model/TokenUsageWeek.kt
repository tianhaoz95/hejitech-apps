package com.hejitech.core.model

import com.google.firebase.Timestamp

/**
 * Firestore document shape for `users/{uid}/deviceTokenUsage/{weekId}` and
 * `users/{uid}/cloudTokenUsage/{weekId}` (same shape, two separate
 * collections — see firestore.rules: device counters are client-written,
 * cloud counters are server-only). `weekId` is an ISO-8601 week string
 * ("GGGG-Www", e.g. "2026-W33"), Monday-start, computed in UTC so every
 * device and the backend agree on which week "now" falls in regardless of
 * local timezone.
 */
data class TokenUsageWeek(
    val inputTokens: Int = 0,
    val outputTokens: Int = 0,
    val requestCount: Int = 0,
    val weekStart: Timestamp = Timestamp.now(),
    val updatedAt: Timestamp = Timestamp.now(),
) {
    /**
     * Input tokens cost 1 credit/million, output tokens cost 6 credit/million
     * (decode is the expensive side, on-device and cloud alike) — the single
     * source of truth for turning a week's raw token counts into the
     * "credits" unit shown in Settings' usage progress bars.
     */
    val creditsUsed: Double
        get() = inputTokens / 1_000_000.0 * 1.0 + outputTokens / 1_000_000.0 * 6.0
}

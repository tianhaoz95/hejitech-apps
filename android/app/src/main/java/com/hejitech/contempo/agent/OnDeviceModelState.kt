package com.hejitech.contempo.agent

/**
 * UI-facing view of an on-device LLM's readiness — deliberately generic,
 * shared by every OnDeviceLlm implementation (see OnDeviceLlm.kt) so
 * AgentClient/CaptureViewModel/ChatViewModel/SettingsScreen gate on one
 * shape regardless of which runtime is active underneath (LiteRT-LM today,
 * Firebase AI Logic/Gemini Nano previously — see GeminiNanoLlm). The point
 * is discovering readiness ahead of time, not just an "unavailable" after a
 * failed generation call.
 */
sealed interface OnDeviceModelUiStatus {
    data object Checking : OnDeviceModelUiStatus

    /** Hardware/OS doesn't support on-device inference at all — cloud is the only option here. */
    data object Unavailable : OnDeviceModelUiStatus

    /** Known downloadable but a download hasn't been observed starting yet (brief, transitional). */
    data object NotDownloaded : OnDeviceModelUiStatus

    /**
     * [totalBytes] is 0 if a DownloadStarted event was never observed (e.g. a
     * download already in progress from a prior app session) — render as
     * indeterminate progress in that case. [etaSeconds] is null until enough
     * samples exist to estimate throughput; it's a rough client-computed
     * estimate, not an SDK-provided value (the SDK doesn't expose one).
     */
    data class Downloading(
        val bytesDownloaded: Long,
        val totalBytes: Long,
        val etaSeconds: Long?,
    ) : OnDeviceModelUiStatus

    data object Available : OnDeviceModelUiStatus

    data class Failed(val message: String) : OnDeviceModelUiStatus
}

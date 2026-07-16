package com.hejitech.contempo.agent

import android.graphics.Bitmap
import kotlinx.coroutines.flow.StateFlow

/**
 * Framework-agnostic on-device LLM capability. AgentClient (the only caller)
 * only ever sees this interface — never LiteRT-LM's Engine/Conversation/
 * Content types, nor Firebase AI Logic's GenerativeModel/OnDeviceExtension
 * types. Swapping the underlying runtime means writing a new implementation
 * of this interface and changing one line in ServiceLocator; nothing else in
 * the app should need to change.
 *
 * Two implementations exist:
 *  - LiteRtLlm — the active one, running a downloaded Gemma 4 E2B model via
 *    LiteRT-LM. Chosen over AICore/Gemini Nano for device coverage: AICore
 *    only supports a narrow slice of flagship hardware (confirmed via this
 *    app's own test device, which supports neither), where a bundled/
 *    downloaded model runs on anything meeting a RAM/storage bar instead of
 *    an OS-capability allowlist.
 *  - GeminiNanoLlm — the original Firebase AI Logic/Gemini Nano
 *    implementation. Kept, not deleted, in case AICore's coverage improves
 *    or hybrid cloud-fallback behavior becomes worth it again — currently
 *    unused (not wired into ServiceLocator).
 */
interface OnDeviceLlm {
    val status: StateFlow<OnDeviceModelUiStatus>

    /** Re-checks readiness and (re)starts a stalled/failed download. User-triggered from Settings. */
    fun retry()

    /**
     * Plain text in, plain text out — callers (AgentClient) handle their own
     * prompt construction and response parsing (e.g. JSON extraction), same
     * as before this abstraction existed. Null on any failure: unsupported,
     * not ready, or a generation error — callers already treat null as "on-
     * device unavailable" and either fail loudly (ON_DEVICE_ONLY) or fall
     * back to cloud (PREFER_ON_DEVICE).
     */
    suspend fun generateText(prompt: String): String?

    /** Null if this runtime/model doesn't support image input, isn't ready, or generation fails. */
    suspend fun generateFromImage(bitmap: Bitmap, prompt: String): String?
}

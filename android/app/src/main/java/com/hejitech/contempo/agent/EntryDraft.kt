package com.hejitech.contempo.agent

import com.hejitech.core.model.CaptureSource
import kotlinx.serialization.Serializable

/**
 * Client-side mirror of EntryDraftSchema in
 * backend/functions/src/schemas.ts. @Serializable because the on-device
 * path (AgentClient) has to parse this out of a plain-text model response
 * itself — see that file for why (no responseSchema/function-calling
 * support confirmed for on-device inference as of this writing).
 *
 * Deliberately no "needs clarification" concept: capture is supposed to be
 * fast, not a back-and-forth — the model always fills in whatever it can
 * confidently determine and leaves the rest null, and the app always
 * proceeds straight to Confirm with that partial draft rather than blocking
 * the user with a question. The Confirm screen (not the model) is where
 * gaps get filled in, on the user's own time.
 */
@Serializable
data class EntryDraft(
    val property: String? = null,
    val task: String? = null,
    val durationMinutes: Int? = null,
    val category: String? = null,
)

enum class ParseSource { ON_DEVICE, CLOUD }

data class ParseResult(
    val draft: EntryDraft,
    val source: ParseSource,
)

sealed interface ParseOutcome {
    data class Success(val result: ParseResult) : ParseOutcome
    data class Failure(val message: String) : ParseOutcome
}

/**
 * Bundles everything CaptureScreen hands off to the Confirm screen: the
 * drafted fields, where the parse ran (for the "parsed on-device"/"parsed
 * via cloud" caption), how the capture itself started (manual/text/voice/
 * photo — for the audit-trail source field), and a local content:// URI for
 * the photo if one was taken (Confirm uploads it to Storage on save).
 */
data class CaptureResult(
    val draft: EntryDraft,
    val parseSource: String,
    val captureSource: CaptureSource,
    val photoUri: String? = null,
)

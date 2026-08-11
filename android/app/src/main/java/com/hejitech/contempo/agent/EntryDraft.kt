package com.hejitech.contempo.agent

import com.hejitech.core.model.CaptureSource
import com.hejitech.core.model.EntryCategory
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
    /**
     * Cleaned-up description of the work performed — filler words and
     * dictation errors already stripped by the parse prompt (see
     * AgentClient.buildEntryPrompt / parseEntry.ts on the cloud side).
     * Plain prose for a single task; may be a markdown bullet list ("- "
     * lines) when the host described multiple distinct sub-tasks in one
     * capture, never headers/tables/bold.
     */
    val task: String? = null,
    val durationMinutes: Int? = null,
    val category: String? = null,
    /**
     * "start"/"stop" fallback signal for the voice-timer feature — only
     * consulted when TimerIntentClassifier's deterministic keyword pass
     * (tried first) doesn't recognize the utterance. See EntryDraftSchema in
     * backend/functions/src/schemas.ts for the server-side mirror.
     */
    val eventType: String? = null,
    /**
     * Business miles driven, only when the host actually states a distance
     * — a separate tax deduction from the hours tracked above, riding along
     * on the same parse rather than needing its own capture flow. See
     * EntryDraftSchema in backend/functions/src/schemas.ts for the
     * server-side mirror.
     */
    val miles: Double? = null,
    /**
     * Absolute ISO-8601 timestamp for when the described work actually
     * happened, resolved by the model from any time reference in the
     * host's words relative to "current time" (see
     * AgentClient.buildEntryPrompt / parseEntry.ts). Null means no time
     * reference was mentioned — the consuming code
     * (ConfirmViewModel.save / AudioCaptureProcessor) treats that, and any
     * value that fails to parse or lands in the future, as "use now
     * instead." See EntryDraftSchema in backend/functions/src/schemas.ts
     * for the server-side mirror.
     */
    val resolvedActivityDateIso: String? = null,
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

/** Result of AgentClient.readOdometerFromPhoto — a plain number read, not a structured entry draft. */
sealed interface OdometerReadOutcome {
    data class Success(val miles: Double, val source: ParseSource) : OdometerReadOutcome
    data class Failure(val message: String) : OdometerReadOutcome
}

/** Which of the two photo-capture paths a just-taken photo belongs to — see AgentClient.classifyPhotoIntent. */
enum class PhotoIntent { ODOMETER, WORK }

/**
 * Result of AgentClient.classifyPhotoIntent — a fast odometer-vs-work read
 * that decides which of readOdometerFromPhoto/draftEntryFromPhoto to run
 * next, not the extracted content itself.
 */
sealed interface PhotoIntentOutcome {
    data class Success(val intent: PhotoIntent, val source: ParseSource) : PhotoIntentOutcome
    data class Failure(val message: String) : PhotoIntentOutcome
}

/** Result of AgentClient.suggestCategory — an on-device-only category guess for the entry-detail auto-detect button. */
sealed interface CategoryOutcome {
    data class Success(val category: EntryCategory, val source: ParseSource) : CategoryOutcome
    data class Failure(val message: String) : CategoryOutcome
}

/**
 * Bundles everything CaptureScreen hands off to the Confirm screen: the
 * drafted fields, where the parse ran (for the "parsed on-device"/"parsed
 * via cloud" caption), how the capture itself started (manual/text/voice/
 * photo — for the audit-trail source field), a local content:// URI for
 * the photo if one was taken (Confirm uploads it to Storage on save), and
 * best-effort "said from here" location — see CaptureViewModel's
 * captureLocation(), same non-blocking cached-location approach the watch's
 * capture path already uses.
 *
 * isTripCapture/tripIsEndingExistingTrip/odometerReading are only set when a
 * photo was classified as an odometer reading (see
 * CaptureViewModel.handleOdometerPhoto) — Confirm renders its trip-mode UI
 * instead of the usual work-entry fields when isTripCapture is true.
 */
data class CaptureResult(
    val draft: EntryDraft,
    val parseSource: String,
    val captureSource: CaptureSource,
    val photoUri: String? = null,
    val captureLat: Double? = null,
    val captureLng: Double? = null,
    val isTripCapture: Boolean = false,
    val tripIsEndingExistingTrip: Boolean = false,
    val odometerReading: Double? = null,
)

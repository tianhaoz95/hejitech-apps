package com.hejitech.core.model

import com.google.firebase.Timestamp
import com.google.firebase.firestore.Exclude
import com.google.firebase.firestore.PropertyName

/**
 * Firestore document shape for `users/{uid}/entries/{entryId}`. Mirrors
 * EntrySchema in backend/functions/src/schemas.ts, plus the bookkeeping
 * fields (status, source, timestamps, riskFlags) that only exist client/
 * Firestore-side, not in the parsing schema.
 *
 * All-default-args constructor so Firestore's `toObject()` mapping works.
 */
data class Entry(
    val id: String = "",
    val propertyId: String = "",
    val propertyName: String = "",
    val task: String = "",
    val durationMinutes: Int = 0,
    val category: String = EntryCategory.OTHER.firestoreValue,
    val status: String = EntryStatus.PENDING_REVIEW.firestoreValue,
    val source: String = CaptureSource.MANUAL.firestoreValue,
    /** When the work actually happened — set by the user, not "now." */
    val activityDate: Timestamp = Timestamp.now(),
    /** When this entry was first written to Firestore — the contemporaneity anchor. */
    val loggedAt: Timestamp = Timestamp.now(),
    val confirmedAt: Timestamp? = null,
    // Same Kotlin-Boolean-property Firestore bug documented on isTrip below
    // (getter's "is" prefix stripped on write, not restored on read) —
    // confirmed live via FirestoreEntryRepositoryTest.roundTrip_isVagueAndIsBackfilled_surviveThroughFirestore:
    // without these annotations, an entry correctly flagged vague/backfilled
    // at write time silently reads back as false, undermining the risk-flag
    // feature this whole app is built around. Needs `var` for the same
    // setter-based-reflection reason isTrip does.
    @get:PropertyName("isVague") @set:PropertyName("isVague")
    var isVague: Boolean = false,
    @get:PropertyName("isBackfilled") @set:PropertyName("isBackfilled")
    var isBackfilled: Boolean = false,
    val daysLate: Int = 0,
    val riskReasons: List<String> = emptyList(),
    val photoUrls: List<String> = emptyList(),
    /** True while this entry is an open start/stop timer with no end yet — see TimerEntryCoordinator. */
    val inProgress: Boolean = false,
    /** True while an in-progress entry is paused — see TimerEntryCoordinator.handlePause/handleResume. */
    val isPaused: Boolean = false,
    /** Set when a pause begins, cleared on resume. Null whenever [isPaused] is false. */
    val pausedAt: Timestamp? = null,
    /** Running total of all completed pause spans for this entry, subtracted from elapsed time when computing [durationMinutes]. */
    val pausedDurationSeconds: Int = 0,
    /**
     * Marks this entry as (also) a mileage trip — orthogonal to inProgress/
     * hours, not a replacement: a work timer and a driving trip can be open
     * at the same time (e.g. timing a maintenance visit that includes a
     * supply run), so EntryRepository.findOpenEntry is scoped by this flag
     * rather than there being one global "the one open entry." See
     * MileageTripCoordinator.
     */
    // Firestore's Java-bean reflection strips the "is" prefix off a Kotlin
    // Boolean getter (isTrip() -> derived property "trip"), and — confirmed
    // live, the hard way — its Kotlin data-class deserialization path does
    // NOT symmetrically apply the same stripping when reading a document
    // back, nor does it fall back to matching a literal "isTrip" field
    // either: without these annotations this always silently deserializes
    // to false regardless of what's actually stored, and needs a real
    // setter (hence `var`, unlike every other field on this class) for
    // Firestore's setter-based reflection to have something to call.
    @get:PropertyName("isTrip") @set:PropertyName("isTrip")
    var isTrip: Boolean = false,
    /** "manual" / "photo" / "gps" — how the mileage below was captured, for audit-trail transparency and CSV export. */
    val mileageCaptureMethod: String = "",
    /** Final recorded mileage for this trip — 0.0 = not applicable, same convention as durationMinutes = 0. */
    val miles: Double = 0.0,
    /** Real evidence, not just a diff — populated by the odometer-photo capture method (and optionally manual entry). */
    val odometerStart: Double? = null,
    val odometerEnd: Double? = null,
    /** Populated by the GPS capture method — raw start/end coordinates as supporting evidence. */
    val tripStartLat: Double? = null,
    val tripStartLng: Double? = null,
    val tripEndLat: Double? = null,
    val tripEndLng: Double? = null,
    /**
     * Where this entry was captured (general "said from here" evidence),
     * distinct from the trip-specific tripStart/tripEnd fields above —
     * populated at record time on whichever device captured it, when
     * location is available. See AudioCaptureProcessor/AudioCaptureQueue.
     */
    val captureLat: Double? = null,
    val captureLng: Double? = null,
    /**
     * Permanent Storage download URL for the raw audio behind this entry —
     * kept forever (never deleted), unlike the transient local queue it
     * came through. Populated for voice-captured entries only.
     */
    val audioUrl: String = "",
    /**
     * The verbatim Whisper transcription this entry was parsed from — before
     * AgentClient's cleanup (filler words, dictation-error fixes) produced
     * [task]. Only ever populated alongside [audioUrl] (see
     * AudioCaptureProcessor's saveFromDraft/saveFallback — currently the
     * only capture path that uploads its audio at all), so a blank value
     * here is the normal case for anything not voice-captured via the
     * watch. Surfaced in EntryDetailScreen next to the audio player, for a
     * host who wants to check the AI's parse against what was actually said.
     */
    val rawTranscript: String = "",
    /**
     * When/where a start/stop timer entry (see [inProgress]/TimerEntryCoordinator)
     * was actually stopped — captured at the moment of the "finished"
     * utterance or the Dashboard/Capture tap-to-complete action, distinct
     * from [captureLat]/[captureLng] which records the *start* location.
     * Null while the timer is still open.
     */
    val stoppedAt: Timestamp? = null,
    val stopLat: Double? = null,
    val stopLng: Double? = null,
    /**
     * Who actually did this work — blank means "me" (the owner), the
     * implicit default for every entry, including ones written before this
     * field existed (Firestore's Kotlin mapper applies this default for a
     * missing field, unlike Swift's Codable synthesis — see the iOS Entry
     * model's comment on why roleId/roleName are Optional there instead).
     * Only set when logged under someone else's role — see [Role].
     */
    val roleId: String = "",
    val roleName: String = "",
) {
    /** The only bucket that should count toward the 100-hour/500-hour material participation progress on the Dashboard. */
    @get:Exclude
    val isOwnerHours: Boolean get() = roleId.isEmpty()

    // @get:Exclude — computed, not stored: without this Firestore's reflection-based
    // mapper tries to find a matching field/setter for these and logs a harmless
    // but noisy "No setter/field found" warning on every read.
    @get:Exclude val categoryEnum: EntryCategory get() = EntryCategory.fromFirestoreValue(category)
    @get:Exclude val statusEnum: EntryStatus get() = EntryStatus.fromFirestoreValue(status)
    @get:Exclude val sourceEnum: CaptureSource get() = CaptureSource.fromFirestoreValue(source)
    @get:Exclude val riskFlags: RiskFlags get() = RiskFlags(isVague, isBackfilled, daysLate, riskReasons)
}

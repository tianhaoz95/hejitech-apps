package com.hejitech.core.data

import com.google.firebase.Timestamp
import com.hejitech.core.model.CaptureSource
import com.hejitech.core.model.Entry
import com.hejitech.core.model.EntryCategory
import com.hejitech.core.model.EntryStatus

sealed class TimerEventResult {
    data class Started(val entryId: String) : TimerEventResult()
    data class Stopped(val entryId: String, val durationMinutes: Int) : TimerEventResult()
}

/**
 * Orchestrates the "start work" / "finished work" voice-timer feature: at
 * most one Entry ever has inProgress = true for a given user (enforced here,
 * not by a Firestore rule — see EntryRepository.findOpenEntry's kdoc), since
 * a host can't honestly claim overlapping hours across two simultaneous
 * tasks. Shared by the phone-direct capture path (app module, over
 * ServiceLocator.entryRepository) and the watch-relay path (wear module,
 * over WearServiceLocator.entryRepository) — both point at the same real
 * Firestore/uid, so "the one open entry" is consistent regardless of which
 * module queries it. Lives in core (not app) purely because both of those
 * modules need the identical logic and only core is visible to both.
 */
class TimerEntryCoordinator(private val entryRepository: EntryRepository) {

    /**
     * Opens a new timer, auto-closing whatever was previously open first (no
     * blocking/asking — matches this app's "capture is meant to be fast, not
     * a conversation" principle). [startedAt] is the moment the "start"
     * utterance actually happened, not necessarily now — the watch-relay
     * path can be syncing minutes late, so callers must pass the original
     * capture time, not Timestamp.now(), or the timer anchors late and every
     * later duration computed from it is proportionally wrong.
     */
    suspend fun handleStart(
        property: String?,
        task: String?,
        category: String?,
        source: CaptureSource,
        startedAt: Timestamp,
    ): TimerEventResult.Started {
        entryRepository.findOpenEntry(isTrip = false)?.let { previous -> closeEntry(previous, closedAt = startedAt) }

        val entry = Entry(
            propertyName = property.orEmpty(),
            task = task.orEmpty(),
            durationMinutes = 0,
            category = category?.let { EntryCategory.fromFirestoreValue(it).firestoreValue }
                ?: EntryCategory.OTHER.firestoreValue,
            status = EntryStatus.PENDING_REVIEW.firestoreValue,
            source = source.firestoreValue,
            activityDate = startedAt,
            loggedAt = Timestamp.now(),
            inProgress = true,
        )
        return TimerEventResult.Started(entryRepository.createEntry(entry))
    }

    /**
     * Closes the open timer, if any. [stoppedAt] is the original "finished"
     * capture time for the same late-sync reason as [handleStart]. [stopLat]/
     * [stopLng] are best-effort "where the user was when they finished" —
     * distinct from the entry's [Entry.captureLat]/[Entry.captureLng], which
     * records the *start* location instead. Returns null when nothing was
     * open — callers should fall back to treating the utterance as a normal
     * standalone entry rather than silently dropping it (the user still said
     * something worth capturing).
     */
    suspend fun handleStop(
        property: String?,
        task: String?,
        stoppedAt: Timestamp,
        stopLat: Double? = null,
        stopLng: Double? = null,
    ): TimerEventResult.Stopped? {
        val open = entryRepository.findOpenEntry(isTrip = false) ?: return null
        val duration = closeEntry(open, closedAt = stoppedAt, property = property, task = task, stopLat = stopLat, stopLng = stopLng)
        return TimerEventResult.Stopped(open.id, duration)
    }

    private suspend fun closeEntry(
        open: Entry,
        closedAt: Timestamp,
        property: String? = null,
        task: String? = null,
        stopLat: Double? = null,
        stopLng: Double? = null,
    ): Int {
        val elapsedMinutes = ((closedAt.seconds - open.activityDate.seconds) / 60).toInt().coerceAtLeast(0)
        val isStale = elapsedMinutes > MAX_OPEN_TIMER_MINUTES
        val duration = if (isStale) MAX_OPEN_TIMER_MINUTES else elapsedMinutes

        // Only fill in from the closing utterance if the timer didn't
        // already know it — never clobber what the user said at start time.
        val resolvedProperty = open.propertyName.ifBlank { property.orEmpty() }
        val resolvedTask = open.task.ifBlank { task.orEmpty() }
        val isComplete = resolvedProperty.isNotBlank() && resolvedTask.isNotBlank() && duration > 0

        entryRepository.updateEntry(
            open.id,
            open.copy(
                propertyName = resolvedProperty,
                task = resolvedTask,
                durationMinutes = duration,
                inProgress = false,
                status = (if (isComplete) EntryStatus.CONFIRMED else EntryStatus.PENDING_REVIEW).firestoreValue,
                confirmedAt = if (isComplete) Timestamp.now() else null,
                isVague = open.isVague || isStale,
                riskReasons = if (isStale) {
                    open.riskReasons + "Very long duration between start and stop — please double-check"
                } else {
                    open.riskReasons
                },
                stoppedAt = closedAt,
                stopLat = stopLat,
                stopLng = stopLng,
            ),
        )
        return duration
    }

    companion object {
        /** Beyond this, an elapsed timer is almost certainly a forgotten "stop" — cap and flag rather than trust it. */
        const val MAX_OPEN_TIMER_MINUTES = 12 * 60
    }
}

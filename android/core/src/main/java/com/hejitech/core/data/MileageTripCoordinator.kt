package com.hejitech.core.data

import com.google.firebase.Timestamp
import com.hejitech.core.model.CaptureSource
import com.hejitech.core.model.Entry
import com.hejitech.core.model.EntryCategory
import com.hejitech.core.model.EntryStatus
import kotlin.math.roundToInt

sealed class TripEventResult {
    data class Started(val entryId: String) : TripEventResult()
    data class Ended(val entryId: String, val miles: Double) : TripEventResult()
}

/**
 * Orchestrates the two mileage-capture methods that have a real start/end
 * (odometer photo, GPS tracking) — voice/manual one-shot capture doesn't go
 * through this at all, since a stated total needs no open/close state (see
 * AgentClient's miles field on EntryDraft).
 *
 * Structurally parallel to TimerEntryCoordinator: at most one entry ever has
 * (inProgress = true, isTrip = true) by construction, scoped independently
 * from the work-timer's open entry via EntryRepository.findOpenEntry's
 * isTrip parameter — a host can legitimately be timing a task and driving
 * at the same time, so these must not auto-close each other.
 */
class MileageTripCoordinator(private val entryRepository: EntryRepository) {

    suspend fun handleStartTrip(
        property: String?,
        task: String?,
        category: String?,
        source: CaptureSource,
        startedAt: Timestamp,
        captureMethod: String,
        odometerStart: Double? = null,
        startLat: Double? = null,
        startLng: Double? = null,
    ): TripEventResult.Started {
        // Unlike a work timer, a trip's mileage can't be derived from
        // timestamps alone — if one was already open, there's no data to
        // close it with here, so it's marked abandoned/incomplete rather
        // than silently guessed at. Still fully visible/editable afterward
        // (see EntryDetailScreen's Edit/Delete), just flagged for review.
        entryRepository.findOpenEntry(isTrip = true)?.let { previous ->
            closeTrip(previous, endedAt = startedAt, captureMethod = previous.mileageCaptureMethod, abandoned = true)
        }

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
            isTrip = true,
            mileageCaptureMethod = captureMethod,
            odometerStart = odometerStart,
            tripStartLat = startLat,
            tripStartLng = startLng,
        )
        return TripEventResult.Started(entryRepository.createEntry(entry))
    }

    /**
     * [directMiles] wins when supplied — GPS trips close with their
     * continuously-accumulated total (see MileageTrackingService), not a
     * point-to-point recompute here, since a straight line between start/end
     * coordinates would cut every corner a real route takes and understate
     * the true distance. Otherwise falls back to odometerEnd - odometerStart
     * for the photo method. Returns null when nothing was open, same
     * "caller falls back to a normal capture" contract as
     * TimerEntryCoordinator.handleStop.
     */
    suspend fun handleEndTrip(
        endedAt: Timestamp,
        captureMethod: String,
        odometerEnd: Double? = null,
        endLat: Double? = null,
        endLng: Double? = null,
        directMiles: Double? = null,
    ): TripEventResult.Ended? {
        val open = entryRepository.findOpenEntry(isTrip = true) ?: return null
        val miles = closeTrip(open, endedAt, captureMethod, odometerEnd, endLat, endLng, directMiles)
        return TripEventResult.Ended(open.id, miles)
    }

    /**
     * Checkpoints a GPS trip's continuously-accumulated running total to the
     * open entry without closing it — called on every location fix (see
     * MileageTrackingService) so the trip-so-far distance survives a process
     * death mid-drive and is visible live on the Dashboard. Re-fetches
     * findOpenEntry each call rather than trusting a cached reference, so a
     * concurrent edit elsewhere (e.g. the user editing the entry mid-trip)
     * isn't clobbered by a stale copy. A no-op if the trip was already ended
     * by the time a queued update lands.
     */
    suspend fun updateTripDistance(miles: Double) {
        val open = entryRepository.findOpenEntry(isTrip = true) ?: return
        entryRepository.updateEntry(open.id, open.copy(miles = miles))
    }

    private suspend fun closeTrip(
        open: Entry,
        endedAt: Timestamp,
        captureMethod: String,
        odometerEnd: Double? = null,
        endLat: Double? = null,
        endLng: Double? = null,
        directMiles: Double? = null,
        abandoned: Boolean = false,
    ): Double {
        val rawMiles = when {
            directMiles != null -> directMiles
            odometerEnd != null && open.odometerStart != null -> (odometerEnd - open.odometerStart).coerceAtLeast(0.0)
            else -> 0.0
        }
        val miles = (rawMiles * 100.0).roundToInt() / 100.0

        val isComplete = !abandoned && open.propertyName.isNotBlank() && open.task.isNotBlank() && miles > 0

        entryRepository.updateEntry(
            open.id,
            open.copy(
                inProgress = false,
                miles = miles,
                mileageCaptureMethod = captureMethod,
                odometerEnd = odometerEnd,
                tripEndLat = endLat,
                tripEndLng = endLng,
                status = (if (isComplete) EntryStatus.CONFIRMED else EntryStatus.PENDING_REVIEW).firestoreValue,
                confirmedAt = if (isComplete) Timestamp.now() else null,
                isVague = open.isVague || abandoned,
                riskReasons = if (abandoned) {
                    open.riskReasons + "Trip ended automatically when a new one started — mileage may be missing, please verify or delete."
                } else {
                    open.riskReasons
                },
            ),
        )
        return miles
    }
}

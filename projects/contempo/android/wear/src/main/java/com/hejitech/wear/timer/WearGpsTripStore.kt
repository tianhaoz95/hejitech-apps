package com.hejitech.wear.timer

import android.content.Context
import android.content.SharedPreferences

data class CompletedGpsTrip(
    val startedAtMs: Long,
    val stoppedAtMs: Long,
    val durationMinutes: Int,
)

class WearGpsTripStore(context: Context) {
    private val prefs: SharedPreferences =
        context.getSharedPreferences("wear_gps_trip_prefs", Context.MODE_PRIVATE)

    fun startTrip() {
        prefs.edit()
            .putLong(KEY_STARTED_AT_MS, System.currentTimeMillis())
            .apply()
    }

    fun isTripActive(): Boolean {
        return prefs.getLong(KEY_STARTED_AT_MS, 0L) > 0L
    }

    fun getStartedAtMs(): Long {
        return prefs.getLong(KEY_STARTED_AT_MS, 0L)
    }

    fun getElapsedSeconds(): Int {
        val start = getStartedAtMs()
        if (start == 0L) return 0
        return maxOf(0, ((System.currentTimeMillis() - start) / 1000L).toInt())
    }

    fun getElapsedMinutes(): Int {
        return maxOf(0, getElapsedSeconds() / 60)
    }

    fun stopAndCompleteTrip(): CompletedGpsTrip? {
        val start = getStartedAtMs()
        if (start == 0L) return null

        val stopMs = System.currentTimeMillis()
        val elapsedSec = maxOf(0, ((stopMs - start) / 1000L).toInt())
        val minutes = maxOf(1, minOf(12 * 60, (elapsedSec + 30) / 60))

        clearTrip()

        return CompletedGpsTrip(
            startedAtMs = start,
            stoppedAtMs = stopMs,
            durationMinutes = minutes,
        )
    }

    fun clearTrip() {
        prefs.edit()
            .remove(KEY_STARTED_AT_MS)
            .apply()
    }

    companion object {
        private const val KEY_STARTED_AT_MS = "started_at_ms"
    }
}
